# iira/app/services/activity_log_service.py

import psycopg2
import json
from app.config import settings
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)
DATABASE_URL = settings.database_url

def add_activity_log(activity_type: str, details: Dict):
    """
    Adds a new entry to the system_activity_log table.

    Args:
        activity_type (str): The type of activity (e.g., 'CREATE_SCRIPT').
        details (Dict): A dictionary containing relevant details about the event.
    """
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO system_activity_log (activity_type, details) VALUES (%s, %s);",
            (activity_type, json.dumps(details))
        )
        conn.commit()
        logger.info(f"Logged activity: {activity_type}")
    except (Exception, psycopg2.DatabaseError) as error:
        logger.error(f"Database error while adding activity log: {error}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

def get_activity_log_paginated(page: int = 1, limit: int = 5) -> Dict:
    """
    Retrieves a paginated list of system activities.
    """
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        # Get total count for pagination
        cur.execute("SELECT COUNT(*) FROM system_activity_log;")
        total_records = cur.fetchone()[0]
        total_pages = (total_records + limit - 1) // limit

        # --- NEW: Added detailed logging ---
        logger.info(f"DB DEBUG: Total Records = {total_records}, Limit = {limit}, Calculated Total Pages = {total_pages}")

        offset = (page - 1) * limit
        cur.execute(
            """
            SELECT id, activity_type, details, timestamp
            FROM system_activity_log
            ORDER BY timestamp DESC
            LIMIT %s OFFSET %s;
            """,
            (limit, offset)
        )
        
        rows = cur.fetchall()
        activities = [
            {
                "id": row[0],
                "activity_type": row[1],
                "details": row[2],
                "timestamp": row[3].isoformat()
            } for row in rows
        ]
        
        response_data = {
            "activities": activities,
            "current_page": page,
            "total_pages": total_pages
        }
        
        # --- NEW: Log the exact object being returned ---
        logger.info(f"DB DEBUG: Returning data structure: {response_data}")
        return response_data

    except (Exception, psycopg2.DatabaseError) as error:
        logger.error(f"Database error while fetching activity log: {error}")
        return {"activities": [], "current_page": page, "total_pages": 0}
    finally:
        if conn:
            conn.close()
