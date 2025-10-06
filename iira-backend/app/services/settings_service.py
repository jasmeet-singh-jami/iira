# iira/app/services/settings_service.py

import psycopg2
from app.config import settings
from typing import Dict

DATABASE_URL = settings.database_url

# A simple in-memory cache to avoid hitting the database on every search request.
_settings_cache = {}

def load_search_thresholds() -> Dict[str, float]:
    """
    Loads search threshold settings from the database.
    Includes default fallbacks and a simple cache.
    """
    global _settings_cache
    
    # Define hardcoded defaults as a fallback
    defaults = {
        "INITIAL_SEARCH_THRESHOLD": 0.55,
        "HYDE_SEARCH_THRESHOLD": 0.50
    }

    # If cache is populated, return it.
    if _settings_cache:
        return _settings_cache

    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute("SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('INITIAL_SEARCH_THRESHOLD', 'HYDE_SEARCH_THRESHOLD');")
        rows = cur.fetchall()
        
        # Overwrite defaults with values from the database
        db_settings = {row[0]: float(row[1]) for row in rows}
        defaults.update(db_settings)
        
        print(f"✅ Loaded search thresholds from database: {defaults}")
        
        # Populate the cache
        _settings_cache = defaults
        return _settings_cache

    except (Exception, psycopg2.DatabaseError) as error:
        print(f"⚠️ Database error while loading settings: {error}. Using default thresholds.")
        # On error, return the hardcoded defaults to ensure the app keeps running.
        return defaults
    finally:
        if conn is not None:
            conn.close()
