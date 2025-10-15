# iira/app/services/scripts.py

import psycopg2
from app.config import settings
from typing import List, Dict, Optional
import json
import logging

logger = logging.getLogger(__name__)

DATABASE_URL = settings.database_url

def get_scripts_from_db() -> List[Dict]:
    """
    Connects to the PostgreSQL database and returns a list of scripts,
    including their script_type and other metadata.
    """
    conn = None
    scripts_with_params = {}
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        cur.execute("""
            SELECT
                s.id, s.name, s.script_type, s.description, s.tags, s.content, 
                sp.param_name, sp.param_type, sp.required, sp.default_value
            FROM
                scripts s
            LEFT JOIN
                script_params sp ON s.id = sp.script_id
            ORDER BY
                s.id, sp.param_name;
        """)
        
        rows = cur.fetchall()
        
        for row in rows:
            # --- FIX: Corrected the order of unpacked variables to match the SELECT statement ---
            script_id, name, script_type, description, tags, content, param_name, param_type, required, default_value = row
            
            if script_id not in scripts_with_params:
                scripts_with_params[script_id] = {
                    "id": str(script_id),
                    "name": name,
                    "description": description,
                    "tags": tags,
                    "content": content,
                    "script_type": script_type,
                    "params": []
                }
            
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
    
    return list(scripts_with_params.values())

def get_script_by_id(script_id: int) -> Optional[Dict]:
    """
    Fetches a single script and its parameters by its integer primary key.
    """
    conn = None
    script_data = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        cur.execute("""
            SELECT
                s.id, s.name, s.description, s.tags, s.content, s.script_type,
                sp.param_name, sp.param_type, sp.required, sp.default_value
            FROM scripts s
            LEFT JOIN script_params sp ON s.id = sp.script_id
            WHERE s.id = %s;
        """, (script_id,))
        
        rows = cur.fetchall()

        if not rows:
            return None

        script_id_db, name, description, tags, content, script_type, _, _, _, _ = rows[0]
        script_data = {
            "id": str(script_id_db), "name": name, "description": description,
            "tags": tags, "content": content, "script_type": script_type, "params": []
        }

        for row in rows:
            _, _, _, _, _, _, param_name, param_type, required, default_value = row
            if param_name:
                script_data['params'].append({
                    "param_name": param_name, "param_type": param_type,
                    "required": required, "default_value": default_value
                })

        cur.close()
    except (Exception, psycopg2.DatabaseError) as error:
        print(f"Database error while getting script by ID: {error}")
    finally:
        if conn is not None:
            conn.close()
    
    return script_data

def get_script_by_name(name: str) -> Optional[Dict]:
    """
    Fetches a single script and its parameters by its name.
    """
    conn = None
    script_data = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        cur.execute("""
            SELECT
                s.id, s.name, s.description, s.tags, s.content, s.script_type,
                sp.param_name, sp.param_type, sp.required, sp.default_value
            FROM scripts s
            LEFT JOIN script_params sp ON s.id = sp.script_id
            WHERE s.name = %s;
        """, (name,))
        
        rows = cur.fetchall()

        if not rows:
            return None
        
        script_id, name, description, tags, content, script_type, _, _, _, _ = rows[0]
        script_data = {
            "id": str(script_id), "name": name, "description": description,
            "tags": tags, "content": content, "script_type": script_type, "params": []
        }

        for row in rows:
            _, _, _, _, _, _, param_name, param_type, required, default_value = row
            if param_name:
                script_data['params'].append({
                    "param_name": param_name, "param_type": param_type,
                    "required": required, "default_value": default_value
                })

        cur.close()
    except (Exception, psycopg2.DatabaseError) as error:
        print(f"Database error: {error}")
    finally:
        if conn is not None:
            conn.close()
    
    return script_data

def add_script_to_db(name: str, description: str, tags: List[str], content: str, script_type: str, params: List) -> None:
    """
    Inserts a new script and its parameters into the database.
    """
    conn = None
    cur = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        cur.execute("SELECT COUNT(*) FROM scripts WHERE name = %s;", (name,))
        if cur.fetchone()[0] > 0:
            raise ValueError(f"A script named '{name}' already exists.")

        cur.execute(
            """
            INSERT INTO scripts (name, description, tags, content, script_type)
            VALUES (%s, %s, %s::TEXT[], %s, %s)
            RETURNING id;
            """,
            (name, description, tags, content, script_type)
        )
        script_id = cur.fetchone()[0]

        for param in params or []:
            param_data = param.model_dump() if hasattr(param, "model_dump") else param
            default_value = param_data.get("default_value") or None
            cur.execute(
                """
                INSERT INTO script_params (script_id, param_name, param_type, required, default_value)
                VALUES (%s, %s, %s, %s, %s);
                """,
                (script_id, param_data.get("param_name"), param_data.get("param_type"), param_data.get("required"), default_value)
            )

        conn.commit()
    except ValueError:
        if conn: conn.rollback()
        raise
    except (Exception, psycopg2.DatabaseError) as error:
        if conn: conn.rollback()
        raise Exception(f"Failed to add script: {error}") from error
    finally:
        if cur: cur.close()
        if conn: conn.close()

def update_script_in_db(script_id: int, name: str, description: str, tags: List[str], content: str, script_type: str, params: List) -> None:
    """
    Updates an existing script and its parameters in the database.
    """
    conn = None
    cur = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        cur.execute("SELECT id FROM scripts WHERE name = %s;", (name,))
        existing_script = cur.fetchone()
        if existing_script and existing_script[0] != script_id:
            raise ValueError(f"Another script named '{name}' already exists.")

        cur.execute(
            """
            UPDATE scripts
            SET name = %s, description = %s, tags = %s::TEXT[], content = %s, script_type = %s
            WHERE id = %s;
            """,
            (name, description, tags, content, script_type, script_id)
        )
        
        cur.execute("DELETE FROM script_params WHERE script_id = %s;", (script_id,))

        for param in params or []:
            param_data = param.model_dump() if hasattr(param, "model_dump") else param
            default_value = param_data.get("default_value") or None
            cur.execute(
                """
                INSERT INTO script_params (script_id, param_name, param_type, required, default_value)
                VALUES (%s, %s, %s, %s, %s);
                """,
                (script_id, param_data.get("param_name"), param_data.get("param_type"), param_data.get("required"), default_value)
            )

        conn.commit()
    except ValueError:
        if conn: conn.rollback()
        raise
    except (Exception, psycopg2.DatabaseError) as error:
        if conn: conn.rollback()
        raise Exception(f"Failed to update script: {error}") from error
    finally:
        if cur: cur.close()
        if conn: conn.close()

def add_incident_history_to_db(incident_number: str, incident_data: Dict, llm_plan: Optional[Dict], resolved_scripts: Optional[List[Dict]]):
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO incident_history (incident_number, incident_data, llm_plan, resolved_scripts)
            VALUES (%s, %s, %s, %s);
            """,
            (incident_number, json.dumps(incident_data), json.dumps(llm_plan), json.dumps(resolved_scripts))
        )
        conn.commit()
    except (Exception, psycopg2.DatabaseError) as error:
        print(f"❌ Database error while saving incident history: {error}")
        if conn: conn.rollback()
    finally:
        if conn is not None: conn.close()

def update_incident_history(incident_number: str, llm_plan: Dict, resolved_scripts: List[Dict]):
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE incident_history SET llm_plan = %s, resolved_scripts = %s
            WHERE incident_number = %s;
            """,
            (json.dumps(llm_plan), json.dumps(resolved_scripts), incident_number)
        )
        conn.commit()
    except (Exception, psycopg2.DatabaseError) as error:
        print(f"❌ Database error while updating incident history: {error}")
        if conn: conn.rollback()
    finally:
        if conn is not None: conn.close()        

def delete_script_from_db(script_id: int) -> int:
    """
    Deletes a script and its associated parameters from the database.
    """
    conn = None
    cur = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        cur.execute("DELETE FROM scripts WHERE id = %s;", (script_id,))
        
        deleted_rows = cur.rowcount
        conn.commit()
        
        return deleted_rows

    except (Exception, psycopg2.DatabaseError) as error:
        if conn: conn.rollback()
        raise Exception(f"Failed to delete script: {error}") from error
    finally:
        if cur: cur.close()
        if conn: conn.close()

def count_scripts() -> int:
    """
    Counts the total number of scripts in the database.
    """
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM scripts;")
        count = cur.fetchone()[0]
        return count
    except (Exception, psycopg2.DatabaseError) as error:
        logger.error(f"Database error while counting scripts: {error}")
        return 0
    finally:
        if conn:
            conn.close()

