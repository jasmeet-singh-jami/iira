# app/services/monitor.py
import asyncio
import logging
import datetime
from app.state import agent_status
from app.services.incidents import get_new_unresolved_incidents, update_incident_status
from app.services.scripts import add_incident_history_to_db, update_incident_history
from app.agents.resolver_agent import ResolverAgent

logger = logging.getLogger(__name__)

async def monitor_new_incidents():
    """
    A long-running task that finds new incidents and passes them to the
    ResolverAgent for processing.
    """
    while True:
        try:
            logger.info("⏱️  [Monitor] Checking for new unresolved incidents...")
            agent_status["status"] = "monitoring"
            agent_status["current_incident"] = None
            agent_status["last_checked"] = datetime.datetime.utcnow().isoformat()
            new_incidents = await asyncio.to_thread(get_new_unresolved_incidents)

            if new_incidents:
                logger.info(f"✅  [Monitor] Found {len(new_incidents)} new incidents. Triggering resolution agents.")

                for incident_number, incident_data in new_incidents.items():
                    logger.info(f"--- Processing Incident: {incident_number} ---")
                    agent_status["status"] = "resolving"
                    agent_status["current_incident"] = incident_number
                    
                    try:
                        incident_id = incident_data["id"]
                        await asyncio.to_thread(update_incident_status, incident_id, "In Progress")
                        logger.info(f"➡️  [Monitor] Incident {incident_number} status updated to 'In Progress'.")
                        
                        await asyncio.to_thread(add_incident_history_to_db, incident_number, incident_data, None, None)
                        
                        # Instantiate and run the Resolver Agent
                        resolver_agent = ResolverAgent()
                        agent_result = await asyncio.to_thread(resolver_agent.run, incident_data)
                        
                        # Update history and status based on the agent's final report
                        final_status = agent_result.get("status")
                        llm_plan = agent_result.get("plan")
                        execution_trace = agent_result.get("frontend_trace")

                        await asyncio.to_thread(update_incident_history, incident_number, llm_plan, execution_trace)
                        await asyncio.to_thread(update_incident_status, incident_id, final_status)
                        
                        logger.info(f"🏁  [Monitor] Finalized process for {incident_number} with status: {final_status}")

                    except Exception as e:
                        logger.exception(f"💥  [Monitor] Unhandled error during agent-based resolution for {incident_number}: {e}")
                        # Mark incident as error in case of unexpected failure
                        if 'incident_id' in locals():
                            await asyncio.to_thread(update_incident_status, incident_id, "Error")
            else:
                logger.info("...no new incidents found.")
            
            agent_status["status"] = "idle"
            agent_status["current_incident"] = None
            await asyncio.sleep(60)
            
        except Exception as e:
            logger.critical(f"🔥  [Monitor] Critical error in main loop: {e}", exc_info=True)
            agent_status["status"] = "error"
            await asyncio.sleep(60)