export type AssistantMessageView = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type AssistantConfirmationView = {
  id: string;
  title: string;
  description: string;
  confirmLabel: string;
};

export type AssistantThreadView = {
  id: string;
  title: string;
  messages: AssistantMessageView[];
  pendingConfirmation: AssistantConfirmationView | null;
};

export type AssistantResponse = {
  thread: AssistantThreadView;
  celebrations: Array<"task_completed">;
  /** A tool changed server state, so the client's cached views are stale. */
  mutated: boolean;
};
