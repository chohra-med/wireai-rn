import type { Message } from "../types";

export interface BaseAdapter {
  ping(): Promise<boolean>;
  chat(messages: Pick<Message, "role" | "content">[], signal?: AbortSignal): Promise<string>;
}
