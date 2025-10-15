import logging
from typing import Dict, Any
from app.agents.tools import execute_shell_script_tool #, execute_python_script

logger = logging.getLogger(__name__)

class ExecutionAgent:
    """
    A specialized agent that acts as a tool dispatcher.
    It maintains a registry of available tools and executes them on command.
    """
    def __init__(self):
        # The "tool belt" - a mapping of tool names to their functions.
        # To add a new tool, simply add it to this dictionary.
        self.tools = {
            "shell_script": execute_shell_script_tool,
            # "python_script": execute_python_script, # Example for future use
        }
        logger.info(f"AGENT: ExecutionAgent initialized with tools: {list(self.tools.keys())}")

    def run(self, tool_name: str, **kwargs) -> Dict:
        """
        Executes a specified tool with its required arguments.

        Args:
            tool_name: The name of the tool to execute (e.g., 'shell_script').
            **kwargs: The arguments to pass to the tool's function.

        Returns:
            A dictionary with the execution status and output.
        """
        if tool_name not in self.tools:
            logger.error(f"AGENT: Execution request for unknown tool '{tool_name}'")
            return {"status": "error", "output": f"Tool '{tool_name}' not found."}
        
        tool_function = self.tools[tool_name]
        
        logger.info(f"AGENT: Dispatching task to tool '{tool_name}' with args: {kwargs}")
        
        try:
            # Call the tool's function with the provided arguments
            result = tool_function(**kwargs)
            return result
        except Exception as e:
            logger.exception(f"AGENT: An error occurred while running tool '{tool_name}'")
            return {"status": "error", "output": f"Failed to execute tool '{tool_name}': {str(e)}"}

