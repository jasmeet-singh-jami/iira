# app/services/feedback_service.py
import psycopg2
from app.config import settings
from typing import Dict, Optional
import logging
import asyncio # Import asyncio
from app.utils.redis_client import get_redis_key_for_incident, update_feedback_summary

logger = logging.getLogger(__name__)
DATABASE_URL = settings.database_url

# Make it async to call async redis functions
async def add_retrieval_feedback(
    incident_short_description: str,
    incident_description: Optional[str],
    recommended_agent_id: Optional[str],
    recommended_agent_title: Optional[str],
    search_score: Optional[float],
    user_feedback_type: str, # 'Correct' or 'Incorrect'
    correct_agent_id: Optional[str] = None,
    correct_agent_title: Optional[str] = None,
    incident_number: Optional[str] = None,
    session_id: Optional[str] = None
) -> bool:
    """Adds a new entry to the retrieval_feedback table."""
    conn = None
    pg_success = False
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        sql = """
            INSERT INTO retrieval_feedback (
                incident_short_description, incident_description, incident_number,
                recommended_agent_id, recommended_agent_title, search_score,
                user_feedback_type, correct_agent_id, correct_agent_title, session_id
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
        """
        params = (
            incident_short_description, incident_description, incident_number,
            recommended_agent_id, recommended_agent_title, search_score,
            user_feedback_type, correct_agent_id, correct_agent_title, session_id
        )
        cur.execute(sql, params)
        conn.commit()
        logger.info(f"Logged retrieval feedback for incident: {incident_number or 'N/A'}")
        pg_success = True
    except (Exception, psycopg2.DatabaseError) as error:
        logger.error(f"Database error while adding retrieval feedback: {error}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()


    # Decide if you want to update Redis even if PG fails. Let's do it for now.
    # if pg_success: # Uncomment this line to only update Redis on PG success
    try:
        redis_key = get_redis_key_for_incident(incident_short_description, incident_description)
        # Determine which agent ID to pass based on feedback type
        agent_id_for_redis = correct_agent_id if user_feedback_type == 'Correct' else recommended_agent_id
        await update_feedback_summary(
            redis_key=redis_key,
            feedback_type=user_feedback_type,
            agent_id=agent_id_for_redis # Pass the relevant agent ID
        )
    except Exception as redis_error:
        logger.error(f"Failed to update Redis cache for feedback: {redis_error}", exc_info=True)
        # Decide if failure here should affect overall success status. Let's return pg_success for now.

    return pg_success # Return status of PostgreSQL operation        
