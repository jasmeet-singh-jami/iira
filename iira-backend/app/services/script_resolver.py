import difflib

def resolve_scripts(llm_plan, available_scripts):
    """
    Resolves the LLM's planned tools to actual, available scripts.

    This function iterates through each step of the LLM's plan and attempts to
    find the most relevant script from the provided list.

    Args:
        llm_plan (dict): The structured plan from the LLM, containing steps
                         with 'description' and 'tool' names.
        available_scripts (list): A list of dictionaries, where each dictionary
                                  represents an available script from the database.
                                  Example: {'id': '1', 'name': 'restart_web_server', ...}

    Returns:
        list: A list of dictionaries representing the resolved workflow.
              Each dictionary contains the original step description and the
              details of the best-matched script.
    """
    print("----------------------------------------")
    print("Starting script resolution process...")
    print(f"Available scripts to match against: {[s.get('name') for s in available_scripts]}")
    print("----------------------------------------")

    resolved_workflow = []
    
    for step in llm_plan.get("steps", []):
        tool_name = step.get("tool")
        step_description = step.get("description")
        
        print(f"\n--- Processing step: '{step_description}' with tool: '{tool_name}' ---")
        
        # Initialize a placeholder for the best-matched script
        best_match = None
        highest_score = 0.0
        
        # Use a simple similarity matching logic to find the best script
        # This can be replaced with a more advanced vector search in a real application.
        for script in available_scripts:
            # Convert both strings to lowercase for a case-insensitive comparison
            normalized_tool_name = tool_name.lower()
            normalized_script_name = script['name'].lower()
            
            # difflib.SequenceMatcher is a good way to compare two strings
            # and get a similarity ratio.
            matcher = difflib.SequenceMatcher(None, normalized_tool_name, normalized_script_name)
            similarity_score = matcher.ratio()
            
            # We also check if the tool name is a substring of the script name
            # as a secondary check.
            if normalized_tool_name in normalized_script_name:
                similarity_score = 1.0  # Give an exact match a perfect score
            
            print(f"  - Comparing with script: '{script['name']}', similarity score: {similarity_score:.2f}")

            if similarity_score > highest_score:
                highest_score = similarity_score
                best_match = script
                print(f"  > New best match found: '{best_match['name']}' with score: {highest_score:.2f}")
        
        # Only add a script if the similarity score is above a certain threshold
        # This prevents matching unrelated scripts. A score of 0.5 is a reasonable starting point.
        if highest_score >= 0.5 and best_match:
            print(f"✅ Matched tool '{tool_name}' to script '{best_match['name']}' with final score {highest_score:.2f}")
            resolved_workflow.append({
                "script_id": best_match['id'],
                "step_description": step_description,
                "script_name": best_match['name'],
                # For now, we'll just include the parameters as a placeholder.
                # A more advanced resolver would match the LLM's parameters to the script's.
                "parameters": best_match.get('params', [])
            })
        else:
            # If no suitable script is found, we still want to show the LLM's step
            # so the user can see what needs to be done manually.
            print(f"❌ No suitable script found for tool '{tool_name}'. Highest score was {highest_score:.2f}")
            resolved_workflow.append({
                "script_id": "Not Found",
                "step_description": step_description,
                "script_name": None,
                "parameters": []
            })
            
    print("\n----------------------------------------")
    print("Script resolution complete.")
    print(f"Final resolved workflow: {resolved_workflow}")
    print("----------------------------------------")
    return resolved_workflow
