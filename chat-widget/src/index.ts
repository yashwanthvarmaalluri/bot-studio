import { ChatWidget } from "./widget";
import type { WidgetOptions } from "./types";

export type { WidgetOptions } from "./types";
export { ChatWidget };

export function initWidget(options: WidgetOptions): ChatWidget {
  const widget = new ChatWidget(options);
  widget.mount();
  return widget;
}

declare global {
  interface Window {
    BotStudioWidget?: {
      init: (options: WidgetOptions) => ChatWidget;
      destroyAll: () => void;
      instances: ChatWidget[];
    };
  }
}

if (typeof window !== "undefined") {
  const global = window as Window;
  if (!global.BotStudioWidget) {
    const instances: ChatWidget[] = [];
    global.BotStudioWidget = {
      init(options: WidgetOptions) {
        const widget = initWidget(options);
        instances.push(widget);
        return widget;
      },
      destroyAll() {
        while (instances.length) {
          const instance = instances.pop();
          instance?.destroy();
        }
      },
      instances
    };
  }
}

