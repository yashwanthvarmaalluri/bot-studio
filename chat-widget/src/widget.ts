import type { WidgetOptions, ChatMessage, ChatResponse, ChatStreamEvent } from "./types";

const STYLE_ID = "bot-studio-widget-styles";

const DEFAULTS: Required<
  Pick<
    WidgetOptions,
    | "launcherLabel"
    | "theme"
    | "title"
    | "welcomeMessage"
    | "accentColor"
    | "subtitle"
    | "position"
    | "panelHeight"
  >
> = {
  launcherLabel: "Chat with us",
  theme: "light",
  title: "Assistant",
  welcomeMessage: "Hi there! I’m here to help. Ask me anything about our services.",
  subtitle: "Powered by Bot Studio",
  accentColor: "#2563eb",
  position: "bottom-right",
  panelHeight: 640
};

const STYLES = `
.bot-widget-root {
  all: initial;
  font-family: "Inter", system-ui, sans-serif;
}
.bot-widget-root *,
.bot-widget-root *::before,
.bot-widget-root *::after {
  box-sizing: border-box;
}
.bot-widget-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-end;
  z-index: 2147480000;
  animation: bot-enter 280ms ease-out;
}
.bot-widget-container[data-theme="dark"] { color-scheme: dark; }

.bot-widget-container[data-position="bottom-left"] {
  right: auto;
  left: 24px;
}

.bot-widget-launcher {
  border: none;
  border-radius: 9999px;
  padding: 12px 18px;
  background: var(--bot-primary);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.24);
  display: inline-flex;
  align-items: center;
  gap: 10px;
  letter-spacing: 0.01em;
  transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
}
.bot-widget-launcher:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.3);
}
.bot-widget-launcher:active {
  transform: translateY(0);
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.22);
}

.bot-widget-panel {
  width: min(380px, calc(100vw - 40px));
  height: min(var(--bot-panel-height), calc(100vh - 96px));
  display: none;
  flex-direction: column;
  background: var(--bot-surface);
  color: var(--bot-text);
  border-radius: 18px;
  border: 1px solid var(--bot-border);
  box-shadow: 0 32px 70px rgba(15, 23, 42, 0.28);
  overflow: hidden;
  transform-origin: bottom right;
  animation: bot-scale-in 200ms ease-out;
  backdrop-filter: blur(18px);
}
.bot-widget-panel[data-open="true"] {
  display: flex;
}

.bot-widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 22px;
  background: linear-gradient(135deg, var(--bot-primary), var(--bot-primary-soft));
  color: #fff;
}

.bot-widget-body {
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  background: var(--bot-surface-alt);
  scrollbar-width: thin;
}
.bot-widget-body::-webkit-scrollbar {
  width: 6px;
}
.bot-widget-body::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.25);
  border-radius: 999px;
}

.bot-widget-message {
  max-width: 85%;
  padding: 12px 16px;
  border-radius: 18px;
  line-height: 1.5;
  font-size: 0.95rem;
  transition: transform 120ms ease;
}
.bot-widget-message[data-role="user"] {
  align-self: flex-end;
  background: var(--bot-primary);
  color: #fff;
  border-bottom-right-radius: 8px;
}
.bot-widget-message[data-role="assistant"] {
  align-self: flex-start;
  background: #fff;
  border: 1px solid rgba(148, 163, 184, 0.32);
  color: var(--bot-text);
  border-bottom-left-radius: 8px;
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.12);
}
.bot-widget-message[data-error="true"] {
  border-color: #ef4444;
  background: #fee2e2;
  color: #991b1b;
}

.bot-widget-footer {
  padding: 18px 20px;
  border-top: 1px solid var(--bot-border);
  background: var(--bot-surface);
  display: flex;
  gap: 10px;
}
.bot-widget-input {
  flex: 1;
  min-height: 48px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  padding: 12px 14px;
  background: var(--bot-surface-alt);
  color: var(--bot-text);
  resize: none;
  font-size: 0.94rem;
  line-height: 1.45;
  transition: border 140ms ease, box-shadow 140ms ease;
}
.bot-widget-input:focus {
  outline: none;
  border-color: rgba(37, 99, 235, 0.55);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.18);
}
.bot-widget-send {
  width: 50px;
  border-radius: 14px;
  border: none;
  background: var(--bot-primary);
  color: #fff;
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 1.05rem;
  transition: transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease;
}
.bot-widget-send:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 20px rgba(37, 99, 235, 0.25);
}
.bot-widget-send:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.bot-widget-loading {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: var(--bot-primary);
}
.bot-widget-loading span {
  width: 6px;
  height: 6px;
  background: currentColor;
  border-radius: 50%;
  animation: bot-dot 1s infinite ease-in-out;
}
.bot-widget-loading span:nth-child(2) { animation-delay: .2s; }
.bot-widget-loading span:nth-child(3) { animation-delay: .4s; }
@keyframes bot-dot {
  0%, 80%, 100% { transform: scale(.6); }
  40% { transform: scale(1); }
}

@keyframes bot-enter {
  from { transform: translateY(12px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@keyframes bot-scale-in {
  from { transform: scale(0.96); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
`;

export class ChatWidget {
  private options: WidgetOptions & typeof DEFAULTS;
  private root: HTMLDivElement | null = null;
  private container: HTMLDivElement | null = null;
  private panel: HTMLDivElement | null = null;
  private launcher: HTMLButtonElement | null = null;
  private messagesBody: HTMLDivElement | null = null;
  private input: HTMLTextAreaElement | null = null;
  private sendButton: HTMLButtonElement | null = null;
  private messages: ChatMessage[] = [];
  private sending = false;

  constructor(options: WidgetOptions) {
    if (!options.chatbotId) {
      throw new Error("Chatbot ID is required");
    }
    if (!options.apiBaseUrl) {
      throw new Error("API base URL is required");
    }

    this.options = {
      ...DEFAULTS,
      ...options
    };

    this.options.launcherLabel ||= DEFAULTS.launcherLabel;
    this.options.title ||= DEFAULTS.title;
    this.options.subtitle ||= DEFAULTS.subtitle;
    this.options.welcomeMessage ||= DEFAULTS.welcomeMessage;
    this.options.accentColor ||= DEFAULTS.accentColor;
    this.options.position ||= DEFAULTS.position;
    this.options.panelHeight ||= DEFAULTS.panelHeight;
  }

  // (Markdown/HTML rendering removed; assistant messages render as plain text)

  mount(): void {
    if (typeof document === "undefined") return;
    this.injectStyles();
    this.createDom();
    if (this.options.welcomeMessage) {
      this.pushMessage({
        id: this.id(),
        role: "assistant",
        content: this.options.welcomeMessage
      });
    }
  }

  destroy(): void {
    this.root?.remove();
    this.root = null;
    this.container = null;
    this.panel = null;
    this.launcher = null;
    this.messagesBody = null;
    this.input = null;
    this.sendButton = null;
    this.messages = [];
  }

  private injectStyles(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  private createDom(): void {
    this.root = document.createElement("div");
    this.root.className = "bot-widget-root";

    this.container = document.createElement("div");
    this.container.className = "bot-widget-container";
    this.container.dataset.theme = this.options.theme;
    this.container.dataset.position = this.options.position ?? "bottom-right";

    const accent = this.options.accentColor ?? DEFAULTS.accentColor;
    this.container.style.setProperty("--bot-primary", accent);
    this.container.style.setProperty(
      "--bot-primary-soft",
      this.options.theme === "dark" ? "rgba(99, 102, 241, 0.82)" : "rgba(59, 130, 246, 0.82)"
    );
    this.container.style.setProperty("--bot-panel-height", `${this.options.panelHeight}px`);
    if (this.options.theme === "dark") {
      this.container.style.setProperty("--bot-surface", "#0f172a");
      this.container.style.setProperty("--bot-surface-alt", "rgba(15, 23, 42, 0.78)");
      this.container.style.setProperty("--bot-text", "#e2e8f0");
      this.container.style.setProperty("--bot-border", "rgba(148, 163, 184, 0.28)");
    } else {
      this.container.style.setProperty("--bot-surface", "#f8fafc");
      this.container.style.setProperty("--bot-surface-alt", "#ffffff");
      this.container.style.setProperty("--bot-text", "#0f172a");
      this.container.style.setProperty("--bot-border", "rgba(15, 23, 42, 0.1)");
    }

    this.panel = document.createElement("div");
    this.panel.className = "bot-widget-panel";
    this.panel.dataset.open = "false";

    const header = document.createElement("div");
    header.className = "bot-widget-header";

    const titleWrapper = document.createElement("div");
    titleWrapper.style.display = "flex";
    titleWrapper.style.flexDirection = "column";
    titleWrapper.style.gap = "4px";

    const title = document.createElement("strong");
    title.textContent = this.options.title;
    title.style.fontSize = "1.06rem";

    if (this.options.subtitle) {
      const subtitle = document.createElement("span");
      subtitle.textContent = this.options.subtitle;
      subtitle.style.fontSize = "0.75rem";
      subtitle.style.opacity = "0.75";
      titleWrapper.appendChild(title);
      titleWrapper.appendChild(subtitle);
    } else {
      titleWrapper.appendChild(title);
    }

    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.style.cssText =
      "background:rgba(255,255,255,0.18);border:none;color:#fff;width:32px;height:32px;border-radius:999px;font-size:20px;cursor:pointer;";
    close.addEventListener("click", () => this.togglePanel(false));

    header.appendChild(titleWrapper);
    header.appendChild(close);

    this.messagesBody = document.createElement("div");
    this.messagesBody.className = "bot-widget-body";

    const footer = document.createElement("div");
    footer.className = "bot-widget-footer";

    this.input = document.createElement("textarea");
    this.input.className = "bot-widget-input";
    this.input.placeholder = "Type your message…";
    this.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        this.handleSend();
      }
    });

    this.sendButton = document.createElement("button");
    this.sendButton.className = "bot-widget-send";
    this.sendButton.type = "button";
    this.sendButton.innerHTML = "➤";
    this.sendButton.addEventListener("click", () => this.handleSend());

    footer.appendChild(this.input);
    footer.appendChild(this.sendButton);

    this.panel.appendChild(header);
    this.panel.appendChild(this.messagesBody);
    this.panel.appendChild(footer);

    this.launcher = document.createElement("button");
    this.launcher.className = "bot-widget-launcher";
    this.launcher.type = "button";
    this.launcher.textContent = this.options.launcherLabel;
    const launcherIcon = document.createElement("span");
    launcherIcon.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    launcherIcon.style.display = "inline-flex";
    this.launcher.prepend(launcherIcon);
    this.launcher.addEventListener("click", () => this.togglePanel());

    this.container.appendChild(this.panel);
    this.container.appendChild(this.launcher);
    this.root.appendChild(this.container);
    document.body.appendChild(this.root);
  }

  private togglePanel(force?: boolean): void {
    if (!this.panel) return;
    const open = force ?? this.panel.dataset.open !== "true";
    this.panel.dataset.open = open ? "true" : "false";
    if (open) {
      setTimeout(() => this.input?.focus(), 20);
    }
  }

  private async handleSend(): Promise<void> {
    const content = this.input?.value.trim();
    if (!content || this.sending) return;

    if (this.input) this.input.value = "";

    const userMessage: ChatMessage = {
      id: this.id(),
      role: "user",
      content
    };
    this.pushMessage(userMessage);

    const assistantMessage: ChatMessage = {
      id: this.id(),
      role: "assistant",
      content: "",
      pending: true
    };
    this.pushMessage(assistantMessage);
    this.sending = true;
    this.refreshMessages();

    try {
      const payload = await this.sendToApiStream(content, (delta) => {
        this.appendToMessage(assistantMessage.id, delta);
      });

      const existing = this.getMessageById(assistantMessage.id);
      const finalContent = payload.response || existing?.content || "";

      this.updateMessage(assistantMessage.id, {
        pending: false,
        content: finalContent,
        sources: payload.sources
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.updateMessage(assistantMessage.id, {
        pending: false,
        error: true,
        content: `Failed to fetch reply. ${message}`
      });
    } finally {
      this.sending = false;
      this.refreshMessages();
    }
  }

  private async sendToApiStream(message: string, onDelta: (chunk: string) => void): Promise<ChatResponse> {
    const endpoint = `${this.options.apiBaseUrl.replace(/\/$/, "")}/api/chat/${encodeURIComponent(this.options.chatbotId)}/stream`;
    // Build recent history (backend will trim to MAX_CONTEXT_MESSAGES)
    const history = this.messages
      .filter((m) => (m.role === "user" || m.role === "assistant") && !!m.content)
      .slice(-10) // send up to 10; server will further trim
      .map((m) => ({ role: m.role, content: m.content }));
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message, history })
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(detail || `HTTP ${response.status}`);
    }

    if (!response.body) {
      throw new Error("Streaming body is not supported in this browser.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let finalPayload: ChatResponse | null = null;

    const processBuffer = () => {
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) {
          let event: ChatStreamEvent;
          try {
            event = JSON.parse(line) as ChatStreamEvent;
          } catch (err) {
            console.error("Failed to parse stream event:", err);
            newlineIndex = buffer.indexOf("\n");
            continue;
          }

          if (event.type === "delta") {
            onDelta(event.data || "");
          } else if (event.type === "final") {
            finalPayload = event.data;
          } else if (event.type === "error") {
            throw new Error(event.message || "Streaming error");
          }
        }
        newlineIndex = buffer.indexOf("\n");
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      processBuffer();
    }

    buffer += decoder.decode();
    processBuffer();

    if (!finalPayload) {
      throw new Error("Streaming ended without a final message.");
    }

    return finalPayload;
  }

  private pushMessage(message: ChatMessage): void {
    this.messages.push(message);
    this.refreshMessages();
  }

  private updateMessage(id: string, patch: Partial<ChatMessage>): void {
    this.messages = this.messages.map((message) =>
      message.id === id ? { ...message, ...patch } : message
    );
  }

  private appendToMessage(id: string, text: string): void {
    this.messages = this.messages.map((message) =>
      message.id === id
        ? {
            ...message,
            pending: false,
            content: `${message.content || ""}${text}`,
          }
        : message
    );
    this.refreshMessages();
  }

  private getMessageById(id: string): ChatMessage | undefined {
    return this.messages.find((message) => message.id === id);
  }

  private refreshMessages(): void {
    if (!this.messagesBody) return;
    this.messagesBody.innerHTML = "";

    for (const message of this.messages) {
      const bubble = document.createElement("div");
      bubble.className = "bot-widget-message";
      bubble.dataset.role = message.role;
      if (message.error) bubble.dataset.error = "true";

      if (message.pending) {
        bubble.innerHTML = `
          <div class="bot-widget-loading">
            <span></span><span></span><span></span>
          </div>
        `;
      } else {
        if (message.role === "assistant" && typeof this.options.markdownRenderer === "function") {
          try {
            const rendered = this.options.markdownRenderer(message.content || "");
            if (typeof rendered === "string") {
              bubble.innerHTML = rendered;
            } else if (rendered && typeof (rendered as any).nodeType === "number") {
              bubble.appendChild(rendered as unknown as Node);
            } else {
              bubble.textContent = message.content;
            }
          } catch {
            bubble.textContent = message.content;
          }
        } else {
          bubble.textContent = message.content;
        }
      }
      this.messagesBody.appendChild(bubble);
    }

    this.messagesBody.scrollTop = this.messagesBody.scrollHeight;
  }

  private id(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

