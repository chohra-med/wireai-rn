import { useCallback } from "react";
import { devLog } from "../utils/dev-log";

type CallbackFactory = (messageId: string) => Record<string, (...args: any[]) => void>;

/**
 * useWireAIAction provides a factory to create standard action callbacks
 * that send natural language feedback back to the thread.
 */
export const useWireAIAction = (sendMessage: (text: string) => void): CallbackFactory => {
  return useCallback(
    (messageId: string) => ({
      onConfirm: (payload?: unknown) => {
        devLog.info("action: confirmed", { messageId, payload });
        sendMessage(
          payload !== undefined ? `I selected: ${JSON.stringify(payload)}` : "Yes, confirmed."
        );
      },
      onDeny: () => {
        devLog.info("action: denied", { messageId });
        sendMessage("No, cancel that.");
      },
      onSubmit: (value: unknown) => {
        devLog.info("action: submitted", { messageId, value });
        sendMessage(`My answer is: ${JSON.stringify(value)}`);
      },
      onSelect: (value: unknown) => {
        devLog.info("action: selected", { messageId, value });
        sendMessage(`I selected: ${JSON.stringify(value)}`);
      },
      onPress: (label: string) => {
        devLog.info("action: pressed", { messageId, label });
        sendMessage(`I tapped: ${label}`);
      },
      onContinue: () => {
        devLog.info("action: continue", { messageId });
        sendMessage("continue.");
      },
      onCancel: () => {
        devLog.info("action: canceled", { messageId });
        sendMessage("cancel.");
      },
    }),
    [sendMessage]
  );
};
