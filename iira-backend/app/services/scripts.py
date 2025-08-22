# iira/app/services/scripts.py

import psycopg2
from app.config import settings
from typing import List, Dict, Optional

# The database connection string for PostgreSQL database.
DATABASE_URL = settings.database_url

def get_scripts_from_db() -> List[Dict]:
    """
    Connects to the PostgreSQL database, queries the 'scripts' and 'script_params' tables,
    and returns a list of scripts with their associated parameters.
    """
    conn = None
    scripts_with_params = {}
    try:
        # Connect to the PostgreSQL database
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        # Execute a query to fetch all script details along with their parameters
        # LEFT JOIN is used to include scripts even if they have no parameters
        cur.execute("""
            SELECT
                s.id,
                s.name,
                s.description,
                s.tags,
                s.path,
                sp.param_name,
                sp.param_type,
                sp.required,
                sp.default_value
            FROM
                scripts s
            LEFT JOIN
                script_params sp ON s.id = sp.script_id
            ORDER BY
                s.id, sp.param_name;
        """)
        
        rows = cur.fetchall()
        
        for row in rows:
            script_id, name, description, tags, path, param_name, param_type, required, default_value = row
            
            if script_id not in scripts_with_params:
                # If this is a new script, initialize its dictionary entry
                scripts_with_params[script_id] = {
                    "id": str(script_id),
                    "name": name,
                    "description": description,
                    "tags": tags,
                    "path": path,
                    "params": []
                }
            
            # If a parameter exists, add it to the script's 'params' list
            if param_name:
                scripts_with_params[script_id]['params'].append({
                    "param_name": param_name,
                    "param_type": param_type,
                    "required": required,
                    "default_value": default_value
                })
        
        cur.close()
    except (Exception, psycopg2.DatabaseError) as error:
        print(f"Database error: {error}")
    finally:
        if conn is not None:
            conn.close()
            print("Database connection closed.")
    
    # Return the values of the dictionary as a list of scripts
    return list(scripts_with_params.values())

# New function to get a single script and its parameters by name
def get_script_by_name(name: str) -> Optional[Dict]:
    """
    Fetches a single script and its parameters by its name.
    """
    conn = None
    script_data = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        # Use a CTE to get the base script info, then join for parameters
        cur.execute("""
            WITH script_info AS (
                SELECT * FROM scripts WHERE name = %s
            )
            SELECT
                s.id,
                s.name,
                s.description,
                s.tags,
                s.path,
                sp.param_name,
                sp.param_type,
                sp.required,
                sp.default_value
            FROM
                script_info s
            LEFT JOIN
                script_params sp ON s.id = sp.script_id;
        """, (name,))
        
        rows = cur.fetchall()

        if not rows:
            return None

        # Process rows to build the single script dictionary
        script_id, name, description, tags, path, _, _, _, _ = rows[0]
        script_data = {
            "id": str(script_id),
            "name": name,
            "description": description,
            "tags": tags,
            "path": path,
            "params": []
        }

        for row in rows:
            _, _, _, _, _, param_name, param_type, required, default_value = row
            if param_name:
                script_data['params'].append({
                    "param_name": param_name,
                    "param_type": param_type,
                    "required": required,
                    "default_value": default_value
                })

        cur.close()
    except (Exception, psycopg2.DatabaseError) as error:
        print(f"Database error: {error}")
    finally:
        if conn is not None:
            conn.close()
    
    return script_data

# New function to add a script and its parameters to the database
def add_script_to_db(name: str, description: str, tags: List[str], path: str, params: List) -> None:
    """
    Inserts a new script and its parameters into the database within a single transaction.
    Handles both dict and Pydantic model inputs for params.
    """
    conn = None
    cur = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        # Check if script name already exists
        cur.execute("SELECT COUNT(*) FROM scripts WHERE name = %s;", (name,))
        if cur.fetchone()[0] > 0:
            raise ValueError(f"A script named '{name}' already exists.")

        # Insert into scripts table
        cur.execute(
            """
            INSERT INTO scripts (name, description, tags, path)
            VALUES (%s, %s, %s::TEXT[], %s)
            RETURNING id;
            """,
            (name, description, tags, path)
        )
        script_id = cur.fetchone()[0]
        print(f"✅ Successfully inserted script with ID: {script_id}")

        # Insert parameters if provided
        for param in params or []:
            # Convert Pydantic model to dict if needed
            if hasattr(param, "model_dump"):
                param_data = param.model_dump()
            elif hasattr(param, "dict"):  # Pydantic v1 fallback
                param_data = param.dict()
            else:
                param_data = param  # already a dict

            default_value = param_data.get("default_value") or None
            print(f"DEBUG: Inserting param: {param_data.get('param_name')}, "
                  f"Type: {param_data.get('param_type')}, Required: {param_data.get('required')}, "
                  f"Default: {default_value}")

            cur.execute(
                """
                INSERT INTO script_params (script_id, param_name, param_type, required, default_value)
                VALUES (%s, %s, %s, %s, %s);
                """,
                (
                    script_id,
                    param_data.get("param_name"),
                    param_data.get("param_type"),
                    param_data.get("required"),
                    default_value
                )
            )

        # Commit transaction
        conn.commit()
        print(f"✅ Script '{name}' and parameters committed successfully.")

    except ValueError:
        if conn:
            conn.rollback()
        raise
    except (Exception, psycopg2.DatabaseError) as error:
        if conn:
            conn.rollback()
        print(f"❌ Database error while adding script: {error}")
        raise Exception(f"Failed to add script: {error}") from error
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()
        print("🔒 Database connection closed.")


