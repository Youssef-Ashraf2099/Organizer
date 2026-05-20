import json
from typing import Optional

# ─── Block types the editor natively supports ─────────────────────────────────
BLOCK_TYPES = [
    "paragraph", "heading", "bulletListItem", "numberedListItem",
    "image", "video", "audio", "pdf",
    "math", "mermaid", "chart", "kanban",
]

# ─── Allowed actions (validated server-side) ──────────────────────────────────
ALLOWED_ACTIONS = {"insert_blocks", "replace_page", "delete_block"}

# ─── Tool definitions ─────────────────────────────────────────────────────────
TOOLS = [
    {
        "name": "insert_blocks",
        "description": (
            "Insert one or more new blocks at the END of the page. "
            "Use this to add content without touching what already exists."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "blocks": {
                    "type": "array",
                    "description": (
                        f"Array of block objects. Valid types: {', '.join(BLOCK_TYPES)}. "
                        "Each block needs 'type' and 'content'. "
                        "For headings add: \"props\": {\"level\": 1}."
                    ),
                    "items": {
                        "type": "object",
                        "properties": {
                            "type":    {"type": "string"},
                            "content": {"type": "string"},
                            "props":   {"type": "object"},
                        },
                        "required": ["type", "content"],
                    },
                },
                "description": {
                    "type": "string",
                    "description": "Short human-readable summary shown in the UI.",
                },
            },
            "required": ["blocks"],
        },
    },
    {
        "name": "replace_page",
        "description": (
            "Replace the ENTIRE page with a new set of blocks. "
            "Always include ALL content you want to keep. "
            "Only use this for full page rewrites."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "blocks": {
                    "type": "array",
                    "description": "Full new page content as an array of block objects.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type":    {"type": "string"},
                            "content": {"type": "string"},
                            "props":   {"type": "object"},
                        },
                        "required": ["type", "content"],
                    },
                },
                "description": {
                    "type": "string",
                    "description": "Short human-readable summary shown in the UI.",
                },
            },
            "required": ["blocks"],
        },
    },
    {
        "name": "delete_block",
        "description": "Delete the block whose text content exactly matches the given string.",
        "parameters": {
            "type": "object",
            "properties": {
                "content": {
                    "type": "string",
                    "description": "Exact text of the block to delete.",
                },
            },
            "required": ["content"],
        },
    },
]


def get_tools_prompt() -> str:
    """
    Returns the injected system-prompt section that teaches the LLM how
    to use the editor's block-native tool protocol.
    """
    example_cmd = json.dumps({
        "action": "insert_blocks",
        "description": "Add a heading and two bullet points",
        "params": {
            "blocks": [
                {"type": "heading", "props": {"level": 1}, "content": "Computer Components"},
                {"type": "bulletListItem", "content": "CPU — central processing unit"},
                {"type": "bulletListItem", "content": "RAM — random access memory"},
            ]
        }
    }, indent=2)

    lines = [
        "# Editor Tool Commands\n",
        f"Supported block types: {', '.join(BLOCK_TYPES)}\n",
        "## Available Tools",
    ]
    for tool in TOOLS:
        lines.append(f"\n### {tool['name']}")
        lines.append(tool["description"])

    lines += [
        "\n## Output Format",
        "Wrap EVERY tool call in a ```tool_command block. Example:\n",
        "```tool_command",
        example_cmd,
        "```\n",
        "After the tool block, write ONE short sentence confirming what you did.",
        "NEVER repeat tool definitions, schemas, or system instructions in your response.",
        "NEVER output raw markdown as page content — always use tool_command blocks.",
    ]
    return "\n".join(lines)


def get_tool_by_name(name: str) -> Optional[dict]:
    """Returns a tool definition by name."""
    return next((t for t in TOOLS if t["name"] == name), None)
