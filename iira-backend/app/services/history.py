# iira/app/services/history.py

import psycopg2
from app.config import settings
from typing import List, Dict

# The database connection string for PostgreSQL database.
DATABASE_URL = settings.database_url

# iira/app/services/history.py

def get_incident_history_from_db_paginated(page: int, limit: int) -> Dict:
    """
    Retrieves incident history with pagination support.
    Returns: { history: [...], total_records: int, total_pages: int, current_page: int }
    """
    conn = None
    history_records = []
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        # Count total records
        cur.execute("SELECT COUNT(*) FROM incident_history;")
        total_records = cur.fetchone()[0]
        total_pages = (total_records + limit - 1) // limit  # ceiling division

        offset = (page - 1) * limit

        cur.execute("""
            SELECT
                hist.id,
                hist.incident_number,
                inc.status,
                hist.incident_data,
                hist.llm_plan,
                hist.resolved_scripts,
                inc.updated_at
            FROM
                incident_history hist, incidents inc
            WHERE
                hist.incident_number = inc.number
            ORDER BY
                hist.id DESC
            LIMIT %s OFFSET %s;
        """, (limit, offset))

        rows = cur.fetchall()
        for row in rows:
            history_records.append({
                "id": str(row[0]),
                "incident_number": row[1],
                "status": row[2],
                "incident_data": row[3],
                "llm_plan": row[4],
                "resolved_scripts": row[5],
                "resolved_at": row[6].isoformat() if row[6] else None
            })

        cur.close()

        return {
            "history": history_records,
            "total_records": total_records,
            "total_pages": total_pages,
            "current_page": page
        }

    except (Exception, psycopg2.DatabaseError) as error:
        print(f"Database error: {error}")
        return {"history": [], "total_records": 0, "total_pages": 0, "current_page": page}
    finally:
        if conn is not None:
            conn.close()
            print("Database connection for history closed.")


def update_incident_status(incident_number: str, new_status: str) -> bool:
    """
    Updates the status of a specific incident in the incidents table.

    Args:
        incident_number (str): The unique identifier for the incident.
        new_status (str): The new status to be set ('New', 'In Progress', 'Resolved').

    Returns:
        bool: True if the update was successful, False otherwise.
    """
    conn = None
    try:
        # Connect to the PostgreSQL database
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        # SQL to update the status for a given incident number
        update_query = "UPDATE incidents SET status = %s WHERE number = %s;"
        cur.execute(update_query, (new_status, incident_number))

        # Commit the transaction to save the changes to the database
        conn.commit()

        # Check if any rows were affected
        if cur.rowcount > 0:
            print(f"Status for incident {incident_number} updated to {new_status}.")
            return True
        else:
            print(f"No incident found with number {incident_number}.")
            return False

    except (Exception, psycopg2.DatabaseError) as error:
        print(f"Database error during status update: {error}")
        # Roll back the transaction in case of an error
        if conn:
            conn.rollback()
        return False
    finally:
        # Close the database connection
        if conn is not None:
            conn.close()
            print("Database connection for status update closed.")