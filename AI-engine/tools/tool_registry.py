import json
from typing import Optional

# All tools available to the LLM agent
TOOLS = [
    {
        "name": "insert_block",
        "description": "Inserts a new block of content into the editor even if you overwrite the whole page or some blcokcs.",
        "parameters": {
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "description": "Block type: paragraph, heading, bulletListItem, numberedListItem, math, mermaid, chart, kanban"
                },
                "content": {
                    "type": "string",
                    "description": "The text or markdown content of the block."
                },
                "level": {
                    "type": "integer",
                    "description": "Heading level (1-3). Only used when type=heading."
                }
            },
            "required": ["type", "content"]
        }
    },
    {
        "name": "replace_all",
        "description": "Replaces the ENTIRE page content with new markdown. Always copy existing content and modify it — never drop sections.",
        "parameters": {
            "type": "object",
            "properties": {
                "markdown": {
                    "type": "string",
                    "description": "The full new page content in markdown format."
                },
                "description": {
                    "type": "string",
                    "description": "A short human-readable description of what changed (shown in the diff UI)."
                }
            },
            "required": ["markdown", "description"]
        }
    },
    {
        "name": "replace_text",
        "description": "Finds specific text in the page and replaces it with new text.",
        "parameters": {
            "type": "object",
            "properties": {
                "find": {
                    "type": "string",
                    "description": "The exact text string to find."
                },
                "replace": {
                    "type": "string",
                    "description": "The replacement text."
                },
                "description": {
                    "type": "string",
                    "description": "A short human-readable description of what changed."
                }
            },
            "required": ["find", "replace"]
        }
    },
    {
        "name": "delete_block",
        "description": "Deletes all blocks whose content matches the given string.",
        "parameters": {
            "type": "object",
            "properties": {
                "content": {
                    "type": "string",
                    "description": "The block content to find and delete."
                }
            },
            "required": ["content"]
        }
    }
]

def get_tools_prompt() -> str:
    """
    Returns an injected system-prompt section describing all available tools.
    """
    lines = ["You have access to the following editor tools:\n"]
    for tool in TOOLS:
        props = tool["parameters"].get("properties", {})
        required = tool["parameters"].get("required", [])
        param_summary = ", ".join(
            f"{k}{'*' if k in required else ''}: {v.get('type', 'any')}"
            for k, v in props.items()
        )
        lines.append(f"- **{tool['name']}**: {tool['description']}")
        lines.append(f"  Params: {{ {param_summary} }}\n")

    lines.append("\nTo use a tool, wrap the JSON in triple backticks with label `tool_command`:")
    lines.append("```tool_command")
    lines.append('{"action": "<tool_name>", "description": "short description", "params": {<tool_parameters>}}')
    lines.append("```")
    lines.append("\nYou may emit multiple tool_command blocks in one response.")
    lines.append("Always explain what you did AFTER the tool command blocks.\n")
    return "\n".join(lines)


def get_tool_by_name(name: str) -> Optional[dict]:
    """Returns a tool definition by its name."""
    return next((t for t in TOOLS if t["name"] == name), None)
