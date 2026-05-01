import React, { useEffect, useMemo } from "react";
import { createComponentRegistry } from "../registry/component-registry";
import { WireAIContext } from "../registry/registry-context";
import type { WireAIComponent, LocalLLMConfig, Message } from "../types";
import { devLog } from "../utils/dev-log";

type WireAIProviderProps = {
  llm: LocalLLMConfig;
  components: WireAIComponent[];
  maxContextMessages?: number;
  maxContextChars?: number;
  /** Appended verbatim to the system prompt — use for app-specific instructions. */
  systemPromptSuffix?: string;
  /** Pre-populate the conversation with these messages. */
  initialMessages?: Message[];
  /** Called whenever a new user or assistant message is added to the thread. */
  onMessage?: (message: Message) => void;
  /** Called with the full message history whenever the thread changes. Ideal for persistence. */
  onThreadUpdate?: (messages: Message[]) => void;
  /** Reserved for future paid-tier validation. Has no effect in v0.x. */
  licenseKey?: string;
  children: React.ReactNode;
};

export const WireAIProvider: React.FC<WireAIProviderProps> = ({
  llm,
  components,
  maxContextMessages = 20,
  maxContextChars = 12000,
  systemPromptSuffix,
  initialMessages,
  onMessage,
  onThreadUpdate,
  licenseKey,
  children,
}) => {
  const componentKey = components.map((c) => c.name).join("|||");

  const registry = useMemo(
    () => createComponentRegistry(components),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [componentKey]
  );

  // ─── Guardrails & Connectivity ──────────────────────────────────────────────
  useEffect(() => {
    if (__DEV__) {
      // 1. Security warning
      if (llm.apiKey) {
        devLog.warn(
          "Security: API keys found in LLM config. Never ship keys in a mobile app bundle. " +
            "Use WebhookAdapter for production cloud LLM access."
        );
      }

      // 2. Registry size warning
      if (registry.size > 10) {
        devLog.warn(
          `Registry has ${registry.size} components. Local models (Llama 3, Phi-3) ` +
            "work best with < 10 components. Performance may degrade."
        );
      }

      // 3. Connectivity check
      const checkConnection = async () => {
        try {
          const timeout = 3000;
          const controller = new AbortController();
          const id = setTimeout(() => controller.abort(), timeout);

          // Simple health check attempt
          const resp = await fetch(llm.baseUrl, {
            method: "HEAD",
            signal: controller.signal,
          });
          clearTimeout(id);

          if (resp.ok || resp.status === 404 || resp.status === 405) {
            devLog.info(`LLM connectivity: ${llm.baseUrl} is reachable.`);
          } else {
            devLog.warn(`LLM connectivity: Received status ${resp.status} from ${llm.baseUrl}`);
          }
        } catch (err) {
          devLog.warn(`LLM connectivity: Cannot reach ${llm.baseUrl}. Ensure your server is running.`);
        }
      };

      checkConnection();
    }
  }, [llm.baseUrl, llm.apiKey, registry.size]);

  const contextValue = useMemo(
    () => ({
      registry,
      llmConfig: llm,
      maxContextMessages,
      maxContextChars,
      systemPromptSuffix,
      initialMessages,
      onMessage,
      onThreadUpdate,
      licenseKey,
    }),
    [registry, llm, maxContextMessages, maxContextChars, systemPromptSuffix, initialMessages, onMessage, onThreadUpdate, licenseKey]
  );

  return <WireAIContext.Provider value={contextValue}>{children}</WireAIContext.Provider>;
};
