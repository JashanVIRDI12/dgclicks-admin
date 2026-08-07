/**
 * The wording behind every "Ask AI" button.
 *
 * These are instructions for a model that already holds the workspace tools,
 * so each one names the record it applies to rather than saying "this". The
 * assistant resolves a board or task by searching for it, and a title it can
 * match is the difference between one tool call and three.
 *
 * Read-only prompts say so explicitly. Without that line the assistant treats
 * "summarise what is stale here" as an invitation to start archiving.
 */
export type AssistantAction = {
  /** Menu wording. Short — these sit in a dropdown. */
  label: string;
  prompt: string;
};

/** Offered in the empty panel, where there is no board or task in context. */
export const ASSISTANT_STARTERS: AssistantAction[] = [
  {
    label: "What's on my plate?",
    prompt:
      "List my open tasks across every board I can see, newest deadlines first, and call out anything overdue. Do not change anything.",
  },
  {
    label: "Plan my week",
    prompt:
      "Look at my open tasks and suggest what I should focus on this week, with a reason for each. Ask me before changing any due dates.",
  },
  {
    label: "Create a board",
    prompt:
      "Create a board for a new client project with columns for Backlog, In progress, Review and Done. Ask me for the client name first.",
  },
  {
    label: "Catch me up",
    prompt:
      "Summarise what changed recently across my boards — what was finished, what is new, and what has stalled. Do not change anything.",
  },
];

export function boardAssistantActions(boardName: string): AssistantAction[] {
  return [
    {
      label: "Summarise this board",
      prompt: `Read the board "${boardName}" and summarise it: what sits in each column, what is overdue, and what looks blocked. Do not change anything.`,
    },
    {
      label: "Plan the week here",
      prompt: `Read the board "${boardName}" and tell me what to prioritise this week. Ask me before setting or moving any due dates.`,
    },
    {
      label: "Add tasks from a brief",
      prompt: `I want to turn a brief into tasks on the board "${boardName}". Ask me for the brief, then create one task per deliverable in the first column.`,
    },
    {
      label: "Find stale work",
      prompt: `Read the board "${boardName}" and list tasks that look duplicated, abandoned, or long overdue, with what you would do about each. Do not change anything.`,
    },
  ];
}

export function taskAssistantActions(taskTitle: string): AssistantAction[] {
  return [
    {
      label: "Break into subtasks",
      prompt: `Break the task "${taskTitle}" into subtasks and create them under it. Keep them to concrete pieces of work someone could pick up.`,
    },
    {
      label: "Draft a description",
      prompt: `Write a description for the task "${taskTitle}" covering what done looks like, and save it on the task. Under 120 words.`,
    },
    {
      label: "Suggest a checklist",
      prompt: `Add a checklist to the task "${taskTitle}" covering the steps needed to finish it.`,
    },
    {
      label: "Estimate the work",
      prompt: `Read the task "${taskTitle}" and suggest an estimate in minutes, with your reasoning. Ask me before saving it.`,
    },
  ];
}
