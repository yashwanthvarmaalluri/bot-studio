export interface WidgetOptions {
  chatbotId: string;
  apiBaseUrl: string;
  launcherLabel?: string;
  theme?: "light" | "dark";
  title?: string;
  welcomeMessage?: string;
  accentColor?: string;
  subtitle?: string;
  position?: "bottom-right" | "bottom-left";
  panelHeight?: number;
  // Optional: host-provided renderer to convert markdown -> HTML or Element
  markdownRenderer?: (text: string) => string | HTMLElement;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  error?: boolean;
  sources?: ChatSource[];
}

export interface ChatSource {
  filename?: string | null;
  document_id?: string | null;
  chunk_index?: number | null;
  score?: number | null;
}

export interface ChatResponse {
  response: string;
  sources?: ChatSource[];
  chunks_used?: number;
}

export type ChatStreamEvent =
  | { type: "delta"; data: string }
  | { type: "final"; data: ChatResponse }
  | { type: "error"; message: string };

