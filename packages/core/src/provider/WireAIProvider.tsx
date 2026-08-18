import React, { useEffect, useMemo } from "react";
import { createComponentRegistry } from "../registry/component-registry";
import { WireAIContext } from "../registry/registry-context";
import type { WireAIComponent, LocalLLMConfig, Message } from "../types";
import { devLog } from "../utils/dev-log";
import { llmConfigFingerprint } from "../utils/llm-config-fingerprint";

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
  /**
   * Enable token-level streaming when the adapter supports it (default: true).
   * Set to false to always use the blocking chat() path for all adapters.
   */
  streaming?: boolean;
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
  streaming = true,
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

      // 2. Registry size warning — only relevant for on-device / small models.
      // Cloud providers (OpenAI, A2A, webhook) handle larger registries fine.
      const isLocalProvider =
        llm.provider !== "openai" && llm.provider !== "a2a" && llm.provider !== "webhook";
      if (isLocalProvider && registry.size > 10) {
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
  }, [llm.baseUrl, llm.apiKey, llm.provider, registry.size]);

  // Depend on the config's CONTENTS, not on its object identity. `llm` is
  // almost always written inline (`llm={{ provider: "a2a", ... }}`), which is a
  // new object every render, which would make `contextValue` new every render
  // and churn everything downstream that keys off it. The fingerprint covers
  // every field of LocalLLMConfig, so it changes if and only if the config
  // changes — that makes it the honest dependency here, and it is why the
  // memoized `llmConfig` below cannot go stale.
  const llmFingerprint = llmConfigFingerprint(llm);

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
      streaming,
    }),
    [registry, llmFingerprint, maxContextMessages, maxContextChars, systemPromptSuffix, initialMessages, onMessage, onThreadUpdate, licenseKey, streaming]
  );

  return <WireAIContext.Provider value={contextValue}>{children}</WireAIContext.Provider>;
};
