# iira/app/services/settings_service.py

import psycopg2
import os
from app.config import settings
from typing import Dict

DATABASE_URL = settings.database_url

# A simple in-memory cache to avoid hitting the database on every request.
_settings_cache = {}

def _get_db_connection():
    """Establishes a new database connection."""
    return psycopg2.connect(DATABASE_URL)

def load_setting(key: str) -> str:
    """
    Loads a specific setting from the database.
    If the DB setting is invalid or missing, it falls back to the default
    from the main application config.
    """
    global _settings_cache
    if key in _settings_cache:
        return _settings_cache[key]

    # 1. Get the hardcoded default from app/config.py as the ultimate fallback
    if key == "EMBEDDING_MODEL_PATH":
        default_value = settings.embedding_model_path
    else:
        # Define other defaults here if needed
        default_value = "" 

    conn = None
    try:
        conn = _get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT setting_value FROM app_settings WHERE setting_key = %s;", (key,))
        row = cur.fetchone()
        
        value_from_db = row[0] if row else None
        
        # 2. Prioritize DB value, but ONLY if it is valid
        if key == "EMBEDDING_MODEL_PATH":
            if value_from_db and os.path.isdir(value_from_db):
                _settings_cache[key] = value_from_db
                print(f"✅ Loaded setting '{key}' from database: '{value_from_db}'")
                return value_from_db
            elif value_from_db:
                # DB value is invalid (e.g., points to a deleted model)
                print(f"⚠️ Warning: Model path '{value_from_db}' from DB not found.")
        
        # 3. If DB value is invalid or missing, fall back to the default
        print(f"Falling back to default for '{key}': '{default_value}'")
        _settings_cache[key] = default_value
        return default_value

    except (Exception, psycopg2.DatabaseError) as error:
        print(f"⚠️ Database error loading setting '{key}': {error}. Using default.")
        _settings_cache[key] = default_value
        return default_value
    finally:
        if conn:
            conn.close()

def update_setting(key: str, value: str):
    """Inserts or updates a setting in the database and clears the cache."""
    global _settings_cache
    conn = None
    try:
        conn = _get_db_connection()
        cur = conn.cursor()
        # --- MODIFIED SQL QUERY ---
        # Explicitly set last_updated = CURRENT_TIMESTAMP in the UPDATE clause
        cur.execute(
            """
            INSERT INTO app_settings (setting_key, setting_value)
            VALUES (%s, %s)
            ON CONFLICT (setting_key) DO UPDATE SET
                setting_value = EXCLUDED.setting_value,
                last_updated = CURRENT_TIMESTAMP;
            """,
            (key, value) # Pass value only once for INSERT
        )
        # --- END MODIFICATION ---
        conn.commit()
        if key in _settings_cache:
            del _settings_cache[key]
        print(f"✅ Setting '{key}' updated in database to '{value}'")
    except (Exception, psycopg2.DatabaseError) as error:
        print(f"❌ Database error while updating setting '{key}': {error}")
        if conn:
            conn.rollback()
        raise

def load_search_thresholds() -> Dict[str, float]:
    """
    Loads search threshold settings from the database.
    Includes default fallbacks and a simple cache.
    """
    global _settings_cache
    
    defaults = {
        "INITIAL_SEARCH_THRESHOLD": 0.55,
        "HYDE_SEARCH_THRESHOLD": 0.50
    }

    if "INITIAL_SEARCH_THRESHOLD" in _settings_cache and "HYDE_SEARCH_THRESHOLD" in _settings_cache:
        return {
            "INITIAL_SEARCH_THRESHOLD": float(_settings_cache["INITIAL_SEARCH_THRESHOLD"]),
            "HYDE_SEARCH_THRESHOLD": float(_settings_cache["HYDE_SEARCH_THRESHOLD"])
        }

    conn = None
    try:
        conn = _get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('INITIAL_SEARCH_THRESHOLD', 'HYDE_SEARCH_THRESHOLD');")
        rows = cur.fetchall()
        
        db_settings = {row[0]: float(row[1]) for row in rows}
        defaults.update(db_settings)
        
        print(f"✅ Loaded search thresholds from database: {defaults}")
        
        _settings_cache.update(defaults)
        return defaults # Return the merged dictionary

    except (Exception, psycopg2.DatabaseError) as error:
        print(f"⚠️ Database error while loading settings: {error}. Using default thresholds.")
        return defaults
    finally:
        if conn is not None:
            conn.close()
