import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { devLog } from "../utils/dev-log";
import { createAdapter } from "../llm/llm-factory";
import type { BaseAdapter } from "../llm/base-adapter";
import { useWireAIContext } from "../registry/registry-context";
import { buildSystemPrompt } from "../schema/system-prompt.builder";
import { validateLLMResponse } from "../schema/validate-response";
import type { Message } from "../types";
import { trimToContextBudget } from "../utils/context-budget";

export type SendMessageOptions = {
  /** When true, aborts any in-flight request instead of silently dropping the message. */
  interruptLoading?: boolean;
};

export type UseWireAIThreadResult = {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (text: string, options?: SendMessageOptions) => void;
  reset: () => void;
  abort: () => void;
};

export const useWireAIThread = (): UseWireAIThreadResult => {
  const {
    registry,
    llmConfig,
    maxContextMessages,
    maxContextChars,
    systemPromptSuffix,
    initialMessages,
    onMessage,
    onThreadUpdate,
  } = useWireAIContext();

  const [messages, setMessages] = useState<Message[]>(initialMessages ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Sync messages state with initialMessages if they change externally
  const prevInitialRef = useRef(initialMessages);
  useEffect(() => {
    if (initialMessages !== prevInitialRef.current) {
      setMessages(initialMessages ?? []);
      prevInitialRef.current = initialMessages;
    }
  }, [initialMessages]);

  const messagesRef = useRef<Message[]>(initialMessages ?? []);
  useEffect(() => {
    messagesRef.current = messages;
    onThreadUpdate?.(messages);
  }, [messages, onThreadUpdate]);

  const isLoadingRef = useRef(false);
  const adapterRef = useRef<BaseAdapter | null>(null);
  const systemPromptRef = useRef("");

  useEffect(() => {
    adapterRef.current = createAdapter(llmConfig);
  }, [llmConfig]);

  useEffect(() => {
    systemPromptRef.current = buildSystemPrompt(registry, systemPromptSuffix);
  }, [registry, systemPromptSuffix]);

  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background") {
        abortControllerRef.current?.abort();
        setIsLoading(false);
      }
    });
    return () => sub.remove();
  }, []);

  const sendMessage = useCallback(
    (text: string, options?: SendMessageOptions) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (isLoadingRef.current && !options?.interruptLoading) return;

      const requestId = ++requestIdRef.current;

      const userMsg: Message = {
        id: `user_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };

      const nextMessages = [...messagesRef.current, userMsg];
      setMessages(nextMessages);
      onMessageRef.current?.(userMsg);
      setIsLoading(true);
      isLoadingRef.current = true;
      setError(null);

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const run = async () => {
        const adapter = adapterRef.current!;
        const systemPrompt = systemPromptRef.current;

        const budgeted = trimToContextBudget(nextMessages, maxContextMessages, maxContextChars);
        const apiMessages = [
          { role: "system" as const, content: systemPrompt },
          ...budgeted.map((m) => ({ role: m.role, content: m.content })),
        ];

        devLog.info(`LLM request`, {
          provider: llmConfig.provider,
          model: llmConfig.model,
          messageCount: apiMessages.length,
          lastUserMsg: budgeted.at(-1)?.content,
        });

        const raw = await adapter.chat(apiMessages, controller.signal);

        if (requestId !== requestIdRef.current) return;

        devLog.info(`LLM response`, { raw });

        const response = validateLLMResponse(raw, registry);
        devLog.info(`parsed response`, {
          action: response.action,
          component: (response as { component?: string }).component,
        });

        const assistantMsg: Message = {
          id: `assistant_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          role: "assistant",
          content: raw,
          response,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
        onMessageRef.current?.(assistantMsg);
      };

      run()
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === "AbortError") return;
          if (requestId !== requestIdRef.current) return;
          devLog.error("sendMessage failed", err instanceof Error ? err : new Error(String(err)));
          setError(err instanceof Error ? err.message : "Something went wrong");
        })
        .finally(() => {
          if (requestId === requestIdRef.current) {
            setIsLoading(false);
            isLoadingRef.current = false;
          }
        });
    },
    [llmConfig, registry, maxContextMessages, maxContextChars, systemPromptSuffix]
  );

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    setMessages(initialMessages ?? []);
    setIsLoading(false);
    setError(null);
  }, [initialMessages]);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  }, []);

  return { messages, isLoading, error, sendMessage, reset, abort };
};
