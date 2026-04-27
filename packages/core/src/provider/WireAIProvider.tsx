import React, { useMemo } from "react";
import type { z } from "zod";
import { createComponentRegistry } from "../registry/component-registry";
import { WireAIContext } from "../registry/registry-context";
import type { WireAIComponent, LocalLLMConfig, Message } from "../types";

type WireAIProviderProps = {
  llm: LocalLLMConfig;
  components: WireAIComponent<z.ZodObject<z.ZodRawShape>>[];
  maxContextMessages?: number;
  maxContextChars?: number;
  /** Appended verbatim to the system prompt — use for app-specific instructions. */
  systemPromptSuffix?: string;
  /** Pre-populate the conversation with these messages. */
  initialMessages?: Message[];
  /** Called whenever a new user or assistant message is added to the thread. */
  onMessage?: (message: Message) => void;
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
  licenseKey,
  children,
}) => {
  const componentKey = components.map((c) => c.name).join("|||");

  const registry = useMemo(
    () => createComponentRegistry(components),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [componentKey]
  );

  const contextValue = useMemo(
    () => ({
      registry,
      llmConfig: llm,
      maxContextMessages,
      maxContextChars,
      systemPromptSuffix,
      initialMessages,
      onMessage,
      licenseKey,
    }),
    [registry, llm, maxContextMessages, maxContextChars, systemPromptSuffix, initialMessages, onMessage, licenseKey]
  );

  return <WireAIContext.Provider value={contextValue}>{children}</WireAIContext.Provider>;
};
