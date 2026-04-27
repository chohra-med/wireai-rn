import { useCallback } from "react";
import { devLog } from "../utils/dev-log";

type TriggerAction = (action: string, payload?: unknown, messageId?: string) => void;

export const useWireAIAction = (
  triggerAction: TriggerAction,
  componentName: string
) => {
  const handleAction = useCallback(
    (action: string, payload?: unknown, messageId?: string) => {
      devLog.info(`action: ${componentName} -> ${action}`, { payload });
      triggerAction(action, payload, messageId);
    },
    [triggerAction, componentName]
  );

  return handleAction;
};
