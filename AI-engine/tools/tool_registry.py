import json

# Define the JSON schemas for the available tools
TOOLS = [
    {
        "name": "insert_block",
        "description": "Inserts a new block of content into the editor.",
        "parameters": {
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "description": "The type of block to insert. Examples: paragraph, heading, math, code, mermaid, kanban"
                },
                "content": {
                    "type": "string",
                    "description": "The text or markdown content of the block."
                }
            },
            "required": ["type", "content"]
        }
    },
    {
        "name": "replace_text",
        "description": "Replaces specific text in the editor.",
        "parameters": {
            "type": "object",
            "properties": {
                "find": {
                    "type": "string",
                    "description": "The text to find."
                },
                "replace": {
                    "type": "string",
                    "description": "The replacement text."
                }
            },
            "required": ["find", "replace"]
        }
    }
]

def get_tools_prompt() -> str:
    """
    Returns a string representation of the tools schema to inject into the system prompt.
    """
    prompt = "You have access to the following tools:\n"
    for tool in TOOLS:
        prompt += f"- {tool['name']}: {tool['description']}\n  Schema: {json.dumps(tool['parameters'])}\n"
    
    prompt += "\nTo use a tool, your entire output MUST be a valid JSON object matching this schema:\n"
    prompt += '{"action": "<tool_name>", "params": {<tool_parameters>}}\n'
    prompt += "Do not include any other text or markdown formatting around the JSON."
    return prompt
