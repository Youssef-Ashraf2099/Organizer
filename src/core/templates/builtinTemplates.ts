import { PartialBlock } from "@blocknote/core";

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  content: PartialBlock[];
  is_builtin: boolean;
}

export const builtinTemplates: Template[] = [
  {
    id: "get-started",
    name: "Get Started",
    description: "Welcome template to help you get started with your workspace",
    icon: "🚀",
    is_builtin: true,
    content: [
      {
        type: "heading",
        props: { level: 1 },
        content: [
          { type: "text", text: "Welcome to Your Workspace! 🎉", styles: {} },
        ],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "This is your personal workspace. Here are some tips to get you started:",
            styles: {},
          },
        ],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "Quick Start", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [
          { type: "text", text: "Type ", styles: {} },
          { type: "text", text: "/", styles: { code: true } },
          { type: "text", text: " to see all available commands", styles: {} },
        ],
      },
      {
        type: "bulletListItem",
        content: [
          {
            type: "text",
            text: "Create pages and organize them in the sidebar",
            styles: {},
          },
        ],
      },
      {
        type: "bulletListItem",
        content: [
          {
            type: "text",
            text: "Use templates to quickly create structured pages",
            styles: {},
          },
        ],
      },
      {
        type: "bulletListItem",
        content: [
          {
            type: "text",
            text: "Upload images, videos, and PDFs using the ",
            styles: {},
          },
          { type: "text", text: "/image", styles: { code: true } },
          { type: "text", text: " or ", styles: {} },
          { type: "text", text: "/video", styles: { code: true } },
          { type: "text", text: " commands", styles: {} },
        ],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "Try These Features", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [
          { type: "text", text: "Math equations: Type ", styles: {} },
          { type: "text", text: "/math", styles: { code: true } },
          { type: "text", text: " to insert LaTeX equations", styles: {} },
        ],
      },
      {
        type: "bulletListItem",
        content: [
          {
            type: "text",
            text: "Save pages as templates for reuse",
            styles: {},
          },
        ],
      },
      {
        type: "bulletListItem",
        content: [
          {
            type: "text",
            text: "Organize your work with nested pages",
            styles: {},
          },
        ],
      },
      {
        type: "paragraph",
        content: [],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "Your First Page", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Start writing here...",
            styles: { italic: true },
          },
        ],
      },
    ],
  },
  {
    id: "financial-dashboard",
    name: "Financial Dashboard",
    description: "Income vs Expenses with chart and color cues",
    icon: "💹",
    is_builtin: true,
    content: [
      {
        type: "heading",
        props: { level: 1 },
        content: [{ type: "text", text: "Financial Dashboard", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Track income (green) and expenses (red).",
            styles: {},
          },
        ],
      },
      {
        type: "chart",
        props: {
          chartType: "bar",
          width: 100,
          height: 320,
          data: {
            labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
            datasets: [
              {
                label: "Income",
                data: [2500, 2700, 2600, 3100, 3000, 3200],
                backgroundColor: "rgba(34,197,94,0.7)",
                borderColor: "rgb(34,197,94)",
              },
              {
                label: "Expenses",
                data: [1600, 1400, 1800, 1900, 1700, 2000],
                backgroundColor: "rgba(239,68,68,0.7)",
                borderColor: "rgb(239,68,68)",
              },
            ],
          },
          options: { responsive: true, maintainAspectRatio: false },
        },
        content: [],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Tip: Add categories to break down spending.",
            styles: { italic: true },
          },
        ],
      },
    ],
  },
  {
    id: "software-architecture",
    name: "Software Architecture",
    description: "Mermaid diagram for high-level architecture",
    icon: "🏗️",
    is_builtin: true,
    content: [
      {
        type: "heading",
        props: { level: 1 },
        content: [{ type: "text", text: "System Architecture", styles: {} }],
      },
      {
        type: "mermaid",
        props: {
          theme: "dark",
          code:
            "flowchart LR\n" +
            "  client[Client UI]\n  api((API))\n  auth[(Auth Service)]\n  svc1[Service A]\n  svc2[Service B]\n  db[(Database)]\n" +
            "  client --> api\n  api --> auth\n  api --> svc1\n  api --> svc2\n  svc1 --> db\n  svc2 --> db\n",
        },
        content: [],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Document key components and their responsibilities.",
            styles: {},
          },
        ],
      },
    ],
  },
  {
    id: "relational-database",
    name: "Relational Database",
    description: "ER-style diagram and notes for relations",
    icon: "🗄️",
    is_builtin: true,
    content: [
      {
        type: "heading",
        props: { level: 1 },
        content: [
          { type: "text", text: "Relational Database Design", styles: {} },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Tables, keys, relationships.", styles: {} },
        ],
      },
      {
        type: "mermaid",
        props: {
          theme: "dark",
          code:
            "erDiagram\n" +
            "  USER ||--o{ ORDER : places\n" +
            "  ORDER ||--|{ ORDER_ITEM : contains\n" +
            "  PRODUCT ||--o{ ORDER_ITEM : referenced\n" +
            "  USER {\n" +
            "    string id PK\n    string email\n    string name\n  }\n" +
            "  ORDER {\n" +
            "    string id PK\n    string user_id FK\n    datetime created_at\n  }\n" +
            "  ORDER_ITEM {\n" +
            "    string id PK\n    string order_id FK\n    string product_id FK\n    int qty\n  }\n" +
            "  PRODUCT {\n" +
            "    string id PK\n    string name\n    number price\n  }\n",
        },
        content: [],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Add indexes and constraints in follow-up notes.",
            styles: { italic: true },
          },
        ],
      },
    ],
  },
  {
    id: "task-board",
    name: "Task Board (Kanban)",
    description: "Kanban board like Trello/Jira",
    icon: "🗂️",
    is_builtin: true,
    content: [
      {
        type: "heading",
        props: { level: 1 },
        content: [{ type: "text", text: "Team Board", styles: {} }],
      },
      {
        type: "kanban",
        props: {},
        content: [],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Drag cards between columns. Click + Card to add.",
            styles: {},
          },
        ],
      },
    ],
  },
  {
    id: "todo-list",
    name: "To-Do List",
    description: "A comprehensive task tracker with priorities and dates",
    icon: "✓",
    is_builtin: true,
    content: [
      {
        type: "heading",
        props: { level: 1 },
        content: [{ type: "text", text: "To-Do List", styles: {} }],
      },
      {
        type: "paragraph",
        content: [],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "📌 High Priority", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Urgent task", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Important deadline", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "📋 Medium Priority", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [
          { type: "text", text: "Task to complete this week", styles: {} },
        ],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Follow-up item", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "✅ Completed", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [
          {
            type: "text",
            text: "Finished task",
            styles: { strikethrough: true },
          },
        ],
      },
    ],
  },
  {
    id: "meeting-notes",
    name: "Meeting Notes",
    description: "Template for taking structured meeting notes",
    icon: "📝",
    is_builtin: true,
    content: [
      {
        type: "heading",
        props: {
          level: 1,
        },
        content: [{ type: "text", text: "Meeting Notes", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Date: ", styles: { bold: true } },
          { type: "text", text: new Date().toLocaleDateString(), styles: {} },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Attendees: ", styles: { bold: true } },
        ],
      },
      {
        type: "heading",
        props: {
          level: 2,
        },
        content: [{ type: "text", text: "Agenda", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [],
      },
      {
        type: "heading",
        props: {
          level: 2,
        },
        content: [{ type: "text", text: "Action Items", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [],
      },
      {
        type: "heading",
        props: {
          level: 2,
        },
        content: [{ type: "text", text: "Notes", styles: {} }],
      },
      {
        type: "paragraph",
        content: [],
      },
    ],
  },
  {
    id: "project-plan",
    name: "Project Plan",
    description: "Structure for planning and tracking projects",
    icon: "📋",
    is_builtin: true,
    content: [
      {
        type: "heading",
        props: {
          level: 1,
        },
        content: [{ type: "text", text: "Project Plan", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Project: ", styles: { bold: true } }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Start Date: ", styles: { bold: true } },
        ],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "End Date: ", styles: { bold: true } }],
      },
      {
        type: "heading",
        props: {
          level: 2,
        },
        content: [{ type: "text", text: "Objectives", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [],
      },
      {
        type: "heading",
        props: {
          level: 2,
        },
        content: [{ type: "text", text: "Tasks", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Task 1", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Task 2", styles: {} }],
      },
      {
        type: "heading",
        props: {
          level: 2,
        },
        content: [{ type: "text", text: "Timeline", styles: {} }],
      },
      {
        type: "paragraph",
        content: [],
      },
    ],
  },
  {
    id: "weekly-planner",
    name: "Weekly Planner",
    description: "Plan your week with daily sections",
    icon: "📅",
    is_builtin: true,
    content: [
      {
        type: "heading",
        props: {
          level: 1,
        },
        content: [{ type: "text", text: "Weekly Planner", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Week of: ", styles: { bold: true } }],
      },
      ...[
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ].map((day) => ({
        type: "heading" as const,
        props: {
          level: 2,
        },
        content: [{ type: "text" as const, text: day, styles: {} }],
      })),
    ],
  },
  {
    id: "daily-journal",
    name: "Daily Journal",
    description: "Reflect on your day with prompts",
    icon: "📔",
    is_builtin: true,
    content: [
      {
        type: "heading",
        props: {
          level: 1,
        },
        content: [{ type: "text", text: "Daily Journal", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Date: ", styles: { bold: true } },
          { type: "text", text: new Date().toLocaleDateString(), styles: {} },
        ],
      },
      {
        type: "heading",
        props: {
          level: 2,
        },
        content: [{ type: "text", text: "What went well today?", styles: {} }],
      },
      {
        type: "paragraph",
        content: [],
      },
      {
        type: "heading",
        props: {
          level: 2,
        },
        content: [
          { type: "text", text: "What could be improved?", styles: {} },
        ],
      },
      {
        type: "paragraph",
        content: [],
      },
      {
        type: "heading",
        props: {
          level: 2,
        },
        content: [{ type: "text", text: "Gratitude", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [],
      },
      {
        type: "heading",
        props: {
          level: 2,
        },
        content: [{ type: "text", text: "Notes", styles: {} }],
      },
      {
        type: "paragraph",
        content: [],
      },
    ],
  },
  {
    id: "sheets-template",
    name: "Database/Sheets",
    description: "Create a structured database with properties and entries",
    icon: "📊",
    is_builtin: true,
    content: [
      {
        type: "heading",
        props: { level: 1 },
        content: [{ type: "text", text: "Database", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Use this template to create structured data. Organize information with properties and entries.",
            styles: {},
          },
        ],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "Properties", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [
          { type: "text", text: "Name", styles: { bold: true } },
          { type: "text", text: " - Text property", styles: {} },
        ],
      },
      {
        type: "bulletListItem",
        content: [
          { type: "text", text: "Status", styles: { bold: true } },
          {
            type: "text",
            text: " - Select (Not Started, In Progress, Done)",
            styles: {},
          },
        ],
      },
      {
        type: "bulletListItem",
        content: [
          { type: "text", text: "Priority", styles: { bold: true } },
          { type: "text", text: " - Select (Low, Medium, High)", styles: {} },
        ],
      },
      {
        type: "bulletListItem",
        content: [
          { type: "text", text: "Due Date", styles: { bold: true } },
          { type: "text", text: " - Date", styles: {} },
        ],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "Entries", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "Entry 1", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Name: ", styles: { bold: true } },
          { type: "text", text: "Example Item", styles: {} },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Status: ", styles: { bold: true } },
          { type: "text", text: "In Progress", styles: {} },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Priority: ", styles: { bold: true } },
          { type: "text", text: "High", styles: {} },
        ],
      },
    ],
  },
  {
    id: "reading-list",
    name: "Reading List",
    description: "Track books, articles, and resources you want to read",
    icon: "📚",
    is_builtin: true,
    content: [
      {
        type: "heading",
        props: { level: 1 },
        content: [{ type: "text", text: "Reading List", styles: {} }],
      },
      {
        type: "paragraph",
        content: [],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "📖 Currently Reading", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [
          { type: "text", text: "Book Title", styles: { bold: true } },
          { type: "text", text: " by Author Name", styles: {} },
        ],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "📝 Want to Read", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Book or Article Title", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Another Title", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "✅ Completed", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [
          {
            type: "text",
            text: "Finished Book",
            styles: { strikethrough: true },
          },
          { type: "text", text: " - Rating: ⭐⭐⭐⭐⭐", styles: {} },
        ],
      },
    ],
  },
  {
    id: "habit-tracker",
    name: "Habit Tracker",
    description: "Track your daily habits and build consistency",
    icon: "🎯",
    is_builtin: true,
    content: [
      {
        type: "heading",
        props: { level: 1 },
        content: [{ type: "text", text: "Habit Tracker", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Track your habits daily. Mark each day you complete a habit.",
            styles: {},
          },
        ],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "My Habits", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [
          { type: "text", text: "Exercise", styles: { bold: true } },
          { type: "text", text: " - Goal: 30 min daily", styles: {} },
        ],
      },
      {
        type: "bulletListItem",
        content: [
          { type: "text", text: "Read", styles: { bold: true } },
          { type: "text", text: " - Goal: 20 pages daily", styles: {} },
        ],
      },
      {
        type: "bulletListItem",
        content: [
          { type: "text", text: "Meditate", styles: { bold: true } },
          { type: "text", text: " - Goal: 10 min daily", styles: {} },
        ],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "This Week", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Mon | Tue | Wed | Thu | Fri | Sat | Sun",
            styles: { code: true },
          },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Exercise: ☑ ☑ ☐ ☐ ☐ ☐ ☐", styles: {} },
        ],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Read: ☑ ☑ ☑ ☐ ☐ ☐ ☐", styles: {} }],
      },
    ],
  },
  {
    id: "notes",
    name: "Notes",
    description: "Simple note-taking template for quick thoughts and ideas",
    icon: "📝",
    is_builtin: true,
    content: [
      {
        type: "heading",
        props: { level: 1 },
        content: [{ type: "text", text: "Notes", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Date: ", styles: { bold: true } },
          { type: "text", text: new Date().toLocaleDateString(), styles: {} },
        ],
      },
      {
        type: "paragraph",
        content: [],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "Quick Notes", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [],
      },
      {
        type: "bulletListItem",
        content: [],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "Ideas", styles: {} }],
      },
      {
        type: "paragraph",
        content: [],
      },
    ],
  },
  {
    id: "recipe",
    name: "Recipe",
    description: "Save and organize your favorite recipes",
    icon: "🍳",
    is_builtin: true,
    content: [
      {
        type: "heading",
        props: { level: 1 },
        content: [{ type: "text", text: "Recipe Name", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Prep Time: ", styles: { bold: true } },
          { type: "text", text: "15 min", styles: {} },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Cook Time: ", styles: { bold: true } },
          { type: "text", text: "30 min", styles: {} },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Servings: ", styles: { bold: true } },
          { type: "text", text: "4", styles: {} },
        ],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "Ingredients", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Ingredient 1", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Ingredient 2", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Ingredient 3", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "Instructions", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Step 1", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Step 2", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Step 3", styles: {} }],
      },
    ],
  },
  {
    id: "book-notes",
    name: "Book Notes",
    description: "Take notes while reading books",
    icon: "📖",
    is_builtin: true,
    content: [
      {
        type: "heading",
        props: { level: 1 },
        content: [{ type: "text", text: "Book Title", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Author: ", styles: { bold: true } },
          { type: "text", text: "Author Name", styles: {} },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Rating: ", styles: { bold: true } },
          { type: "text", text: "⭐⭐⭐⭐⭐", styles: {} },
        ],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "Summary", styles: {} }],
      },
      {
        type: "paragraph",
        content: [],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "Key Takeaways", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [],
      },
      {
        type: "bulletListItem",
        content: [],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "Quotes", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: '"Quote from the book"',
            styles: { italic: true },
          },
        ],
      },
    ],
  },
  {
    id: "budget-tracker",
    name: "Budget Tracker",
    description: "Track your income and expenses",
    icon: "💰",
    is_builtin: true,
    content: [
      {
        type: "heading",
        props: { level: 1 },
        content: [{ type: "text", text: "Budget Tracker", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Month: ", styles: { bold: true } },
          {
            type: "text",
            text: new Date().toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            }),
            styles: {},
          },
        ],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "Income", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [
          { type: "text", text: "Salary: ", styles: { bold: true } },
          { type: "text", text: "$0.00", styles: {} },
        ],
      },
      {
        type: "bulletListItem",
        content: [
          { type: "text", text: "Other Income: ", styles: { bold: true } },
          { type: "text", text: "$0.00", styles: {} },
        ],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "Expenses", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "Housing", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [
          { type: "text", text: "Rent/Mortgage: ", styles: { bold: true } },
          { type: "text", text: "$0.00", styles: {} },
        ],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "Food", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [
          { type: "text", text: "Groceries: ", styles: { bold: true } },
          { type: "text", text: "$0.00", styles: {} },
        ],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "Total", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Remaining: ", styles: { bold: true } },
          { type: "text", text: "$0.00", styles: {} },
        ],
      },
    ],
  },
  {
    id: "goals",
    name: "Goals",
    description: "Set and track your personal and professional goals",
    icon: "🎯",
    is_builtin: true,
    content: [
      {
        type: "heading",
        props: { level: 1 },
        content: [{ type: "text", text: "My Goals", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Year: ", styles: { bold: true } },
          {
            type: "text",
            text: new Date().getFullYear().toString(),
            styles: {},
          },
        ],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "🎯 Long-term Goals", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [
          { type: "text", text: "Goal 1", styles: { bold: true } },
          { type: "text", text: " - Target date: ", styles: {} },
        ],
      },
      {
        type: "bulletListItem",
        content: [
          { type: "text", text: "Goal 2", styles: { bold: true } },
          { type: "text", text: " - Target date: ", styles: {} },
        ],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [
          {
            type: "text",
            text: "📅 Short-term Goals (This Quarter)",
            styles: {},
          },
        ],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Quarterly goal 1", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Quarterly goal 2", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "✅ Completed Goals", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [
          {
            type: "text",
            text: "Achieved goal",
            styles: { strikethrough: true },
          },
        ],
      },
    ],
  },
];
