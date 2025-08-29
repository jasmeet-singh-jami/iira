# iira/app/services/history.py

import psycopg2
from app.config import settings
from typing import List, Dict

# The database connection string for PostgreSQL database.
DATABASE_URL = settings.database_url

def get_incident_history_from_db() -> List[Dict]:
    """
    Connects to the PostgreSQL database and retrieves all incident history records,
    ordered by resolution time in descending order.
    """
    conn = None
    history_records = []
    try:
        # Connect to the PostgreSQL database
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        # Execute a query to fetch all incident history records.
        # Now correctly using the 'timestamp' column.
        cur.execute("""
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
        """)
        
        # Fetch all rows from the query result
        rows = cur.fetchall()
        
        # Map the rows to a list of dictionaries for easier handling.
        # The key is still 'resolved_at' to match the frontend component.
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
        print(f"Database error: {error}")
    finally:
        if conn is not None:
            conn.close()
            print("Database connection for history closed.")
    
    return history_records
