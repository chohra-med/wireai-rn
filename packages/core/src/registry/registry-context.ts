import { createContext, useContext } from "react";
import type { ComponentRegistry } from "./component-registry";
import type { LocalLLMConfig, Message } from "../types";

export type WireAIContextValue = {
  registry: ComponentRegistry;
  llmConfig: LocalLLMConfig;
  maxContextMessages: number;
  maxContextChars: number;
  systemPromptSuffix?: string;
  initialMessages?: Message[];
  onMessage?: (message: Message) => void;
  licenseKey?: string;
};

export const WireAIContext = createContext<WireAIContextValue | null>(null);

export const useWireAIContext = (): WireAIContextValue => {
  const ctx = useContext(WireAIContext);
  if (!ctx) {
    throw new Error("useWireAIContext must be used inside <WireAIProvider>");
  }
  return ctx;
};
