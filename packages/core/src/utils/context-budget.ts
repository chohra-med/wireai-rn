import { devLog } from "./dev-log";
import type { Message } from "../types";

export const trimToContextBudget = (
  messages: Message[],
  maxMessages = 20,
  maxChars = 12000
): Message[] => {
  const [system, ...rest] = messages;
  const sliced = rest.slice(-maxMessages);

  let total = system ? system.content.length : 0;
  const result: Message[] = [];

  for (let i = sliced.length - 1; i >= 0; i--) {
    total += sliced[i].content.length;
    if (total > maxChars) break;
    result.unshift(sliced[i]);
  }

  if (__DEV__ && result.length < rest.length) {
    devLog.warn("context trimmed", { kept: result.length, total: rest.length });
  }

  if (__DEV__ && total / maxChars > 0.8) {
    devLog.warn("context budget at 80%+", { ratio: (total / maxChars).toFixed(2) });
  }

  return system ? [system, ...result] : result;
};
