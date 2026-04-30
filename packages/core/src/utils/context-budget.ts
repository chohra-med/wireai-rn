import { devLog } from "./dev-log";
import type { Message } from "../types";

export const trimToContextBudget = (
  messages: Message[],
  maxMessages = 20,
  maxChars = 12000
): Message[] => {
  // messages = user/assistant only. System prompt is prepended at the call site.
  const sliced = messages.slice(-maxMessages);

  let total = 0;
  const result: Message[] = [];

  for (let i = sliced.length - 1; i >= 0; i--) {
    const msg = sliced[i]!;
    total += msg.content.length;
    // Keep at least one message, even if it exceeds maxChars
    if (total > maxChars && i !== sliced.length - 1) break;
    result.unshift(msg);
  }

  if (__DEV__ && result.length < messages.length) {
    devLog.warn("context trimmed", { kept: result.length, total: messages.length });
  }

  if (__DEV__ && total / maxChars > 0.8) {
    devLog.warn("context budget at 80%+", { ratio: (total / maxChars).toFixed(2) });
  }

  return result;
};
