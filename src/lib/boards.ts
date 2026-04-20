export type BoardTask = {
  id: string;
  title: string;
};

export type BoardColumn = {
  id: string;
  title: string;
  tasks: BoardTask[];
};

export type Board = {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  columns: BoardColumn[];
};

export const boards: Board[] = [
  {
    id: "product-launch",
    name: "Product Launch",
    description: "Plan release timeline and go-to-market tasks.",
    updatedAt: "Updated today",
    columns: [
      {
        id: "backlog",
        title: "Backlog",
        tasks: [
          { id: "pl-1", title: "Define v1 release goals" },
          { id: "pl-2", title: "Collect user interview notes" },
        ],
      },
      {
        id: "in-progress",
        title: "In Progress",
        tasks: [
          { id: "pl-3", title: "Draft launch checklist" },
          { id: "pl-4", title: "Prepare onboarding flow" },
        ],
      },
      {
        id: "done",
        title: "Done",
        tasks: [{ id: "pl-5", title: "Create roadmap overview" }],
      },
    ],
  },
  {
    id: "personal-brand",
    name: "Personal Brand Website",
    description: "Website structure, content, and deployment plan.",
    updatedAt: "Updated 2 days ago",
    columns: [
      {
        id: "ideas",
        title: "Ideas",
        tasks: [
          { id: "pb-1", title: "Moodboard for visual direction" },
          { id: "pb-2", title: "Section list for landing page" },
        ],
      },
      {
        id: "building",
        title: "Building",
        tasks: [{ id: "pb-3", title: "Implement hero section" }],
      },
      {
        id: "review",
        title: "Review",
        tasks: [{ id: "pb-4", title: "Copywriting pass" }],
      },
    ],
  },
  {
    id: "life-admin",
    name: "Life Admin",
    description: "Recurring personal admin and finance tasks.",
    updatedAt: "Updated this week",
    columns: [
      {
        id: "todo",
        title: "To Do",
        tasks: [
          { id: "la-1", title: "Monthly budget review" },
          { id: "la-2", title: "Renew subscriptions" },
        ],
      },
      {
        id: "doing",
        title: "Doing",
        tasks: [{ id: "la-3", title: "Organize expense receipts" }],
      },
      {
        id: "done",
        title: "Done",
        tasks: [{ id: "la-4", title: "Update emergency contacts" }],
      },
    ],
  },
];

export function getBoardById(boardId: string) {
  return boards.find((board) => board.id === boardId);
}
