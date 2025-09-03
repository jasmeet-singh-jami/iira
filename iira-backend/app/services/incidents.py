# iira/app/services/incidents.py

import psycopg2
from psycopg2.extras import DictCursor
from app.config import settings
from typing import List, Dict, Optional, Any
import json
from datetime import datetime

# The database connection string for PostgreSQL database.
DATABASE_URL = settings.database_url
def _convert_datetimes_to_strings(data):
    """Recursively converts datetime objects in a dictionary to ISO-formatted strings."""
    if isinstance(data, datetime):
        return data.isoformat()
    if isinstance(data, dict):
        return {key: _convert_datetimes_to_strings(value) for key, value in data.items()}
    if isinstance(data, list):
        return [_convert_datetimes_to_strings(item) for item in data]
    return data

def add_incident_history(incident_number: str, incident_data: Dict, llm_plan: Dict, resolved_scripts: List[Dict]):
    """
    Connects to the database and stores the incident resolution history.
    This is a synchronous function intended to be run with asyncio.to_thread().
    """
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # Convert any datetime objects to strings before JSON serialization
        sanitized_incident_data = _convert_datetimes_to_strings(incident_data)

        cur.execute(
            """
            INSERT INTO incident_history (incident_number, incident_data, llm_plan, resolved_scripts)
            VALUES (%s, %s, %s, %s);
            """,
            (
                incident_number,
                json.dumps(sanitized_incident_data),
                json.dumps(llm_plan),
                json.dumps(resolved_scripts)
            )
        )
        conn.commit()
        print(f"✅ Incident history for '{incident_number}' saved successfully.")

    except (Exception, psycopg2.DatabaseError) as error:
        print(f"❌ Database error while saving incident history: {error}")
        if conn:
            conn.rollback()
        raise Exception(f"Failed to save incident history: {error}") from error
    finally:
        if conn:
            conn.close()
            print("🔒 Database connection closed.")


def get_incident_history() -> List[Dict]:
    """
    Connects to the PostgreSQL database and retrieves all incident history records,
    ordered by resolution time in descending order.
    This is a synchronous function intended to be run with asyncio.to_thread().
    """
    conn = None
    history_records = []
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
                id,
                incident_number,
                incident_data,
                llm_plan,
                resolved_scripts,
                timestamp
            FROM
                incident_history
            ORDER BY
                timestamp DESC;
            """
        )

        rows = cur.fetchall()

        for row in rows:
            history_records.append({
                "id": str(row[0]),
                "incident_number": row[1],
                "incident_data": row[2],
                "llm_plan": row[3],
                "resolved_scripts": row[4],
                "resolved_at": row[5].isoformat() if row[5] else None
            })

        cur.close()
    except (Exception, psycopg2.DatabaseError) as error:
        print(f"❌ Database error while retrieving history: {error}")
        raise Exception(f"Failed to retrieve history: {error}") from error
    finally:
        if conn:
            conn.close()
            print("🔒 Database connection for history closed.")
    return history_records


def get_new_unresolved_incidents() -> Dict[str, Dict]:
    """
    Retrieves a list of new and in-progress incidents from the database.
    Returns a dictionary with incident numbers as keys and incident details as values.
    """
    conn = None
    unresolved_incidents = {}
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # Query for incidents with a status of 'New' or 'In Progress'
        # Now also retrieving the 'id' which is needed for marking an incident as resolved.
        cur.execute(
            """
            SELECT
                id,
                sys_id,
                "number",
                short_description,
                description,
                cmdb_ci,
                business_service,
                priority,
                impact,
                urgency,
                assignment_group,
                status
            FROM incidents 
            WHERE status IN ('New')
            ORDER BY "id" ASC;
            """
        )
        
        rows = cur.fetchall()
        columns = [
            "id",
            "sys_id",
            "number",
            "short_description",
            "description",
            "cmdb_ci",
            "business_service",
            "priority",
            "impact",
            "urgency",
            "assignment_group",
            "status",
        ]
        for row in rows:
            incident_data = dict(zip(columns, row))
            unresolved_incidents[incident_data["number"]] = incident_data
            
        cur.close()

    except (Exception, psycopg2.DatabaseError) as error:
        print(f"❌ Database error while getting new incidents: {error}")
        raise Exception(f"Failed to retrieve new incidents: {error}") from error
    finally:
        if conn:
            conn.close()
            print("🔒 Database connection closed.")
    
    return unresolved_incidents

def update_incident_status(incident_id: int, status: str = "Resolved"):
    """
    Updates the status of a specific incident.

    Args:
        incident_id: The unique ID of the incident to update.
        status: The new status to set, e.g., 'In Progress' or 'Resolved'.
    """
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # Update the status of the incident by its ID
        cur.execute(
            """
            UPDATE incidents
            SET status = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s;
            """,
            (status, incident_id)
        )
        conn.commit()
        print(f"✅ Incident ID {incident_id} marked as {status}.")
        
        cur.close()
        
    except (Exception, psycopg2.DatabaseError) as error:
        print(f"❌ Database error while marking incident as {status}: {error}")
        if conn:
            conn.rollback()
        raise Exception(f"Failed to mark incident as {status}: {error}") from error
    finally:
        if conn:
            conn.close()
            print("🔒 Database connection closed.")
            

def fetch_incident_by_number(number: str):
    """
    Fetches a specific incident by its incident number.
    """
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        cur.execute(
            """
            SELECT id, sys_id, number, short_description, description, 
                   cmdb_ci, business_service, priority, impact, urgency, 
                   assignment_group
            FROM incidents
            WHERE UPPER(number) = %s;
            """,
            (number,)
        )
        row = cur.fetchone()
        cur.close()

        if not row:
            print(f"⚠️ No incident found with number {number}")
            return None

        incident = {
            "id": row[0],
            "sys_id": row[1],
            "number": row[2],
            "short_description": row[3],
            "description": row[4],
            "cmdb_ci": row[5],
            "business_service": row[6],
            "priority": row[7],
            "impact": row[8],
            "urgency": row[9],
            "assignment_group": row[10],
        }

        print(f"✅ Incident {number} fetched successfully.")
        return incident

    except (Exception, psycopg2.DatabaseError) as error:
        print(f"❌ Database error while fetching incident {number}: {error}")
        if conn:
            conn.rollback()
        raise Exception(f"Failed to fetch incident {number}: {error}") from error
    finally:
        if conn:
            conn.close()
            print("🔒 Database connection closed.")
