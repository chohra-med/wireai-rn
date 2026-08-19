import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { devLog } from "../utils/dev-log";
import { createAdapter } from "../llm/llm-factory";
import type { BaseAdapter } from "../llm/base-adapter";
import { useWireAIContext } from "../registry/registry-context";
import { buildSystemPrompt } from "../schema/system-prompt.builder";
import { validateLLMResponse } from "../schema/validate-response";
import { WireAIPartialResponseSchema } from "../schema/wireai-response.schema";
import { clearStream, pushStream } from "../streaming/streamStore";
import type { Message, WireAIResponse } from "../types";
import { classifyTurnFailure } from "../utils/abort-classification";
import { trimToContextBudget } from "../utils/context-budget";
import { llmConfigFingerprint } from "../utils/llm-config-fingerprint";
import { parsePartialJson } from "../utils/parse-partial-json";

export type SendMessageOptions = {
  /** When true, aborts any in-flight request instead of silently dropping the message. */
  interruptLoading?: boolean;
};

export type UseWireAIThreadResult = {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  /**
   * Why the last turn ended without an answer, or `null` when the thread is
   * healthy.
   *
   * - `"failed"` — the request errored. `error` carries the message.
   * - `"interrupted"` — the app went to background mid-turn, so the request was
   *   aborted. Nothing failed and `error` stays `null`, but the user's message
   *   is sitting there unanswered. Show an affordance and call `retry`. The SDK
   *   never resends by itself.
   */
  errorKind: "interrupted" | "failed" | null;
  sendMessage: (text: string, options?: SendMessageOptions) => void;
  /**
   * Re-run the last user message without adding a second copy of it to the
   * thread.
   *
   * A no-op while a send is in flight, and a no-op unless the newest message is
   * an unanswered user message — so calling it twice cannot double-send.
   */
  retry: () => void;
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
    streaming,
  } = useWireAIContext();

  const [messages, setMessages] = useState<Message[]>(initialMessages ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<"interrupted" | "failed" | null>(null);

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

  // Adapter identity keys off the config's CONTENTS, never its object identity.
  // A consumer writing `llm={{ provider: "a2a", ... }}` inline hands the
  // provider a brand-new object every render; rebuilding the adapter on that
  // would throw away its per-session state (the A2A contextId above all) on
  // every single turn, so the agent would lose the conversation.
  //
  // The fingerprint covers every field of LocalLLMConfig, so it changes if and
  // only if the config changes. That is what makes it the honest dependency
  // below (a genuine config change still rebuilds the adapter) and why the
  // `llmConfig` these callbacks close over cannot go stale in any way that
  // matters: an unchanged fingerprint means identical contents.
  const llmFingerprint = llmConfigFingerprint(llmConfig);

  useEffect(() => {
    adapterRef.current = createAdapter(llmConfig);
  }, [llmFingerprint]);

  useEffect(() => {
    systemPromptRef.current = buildSystemPrompt(registry, systemPromptSuffix);
  }, [registry, systemPromptSuffix]);

  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const maxContextMessagesRef = useRef(maxContextMessages);
  const maxContextCharsRef = useRef(maxContextChars);
  useEffect(() => {
    maxContextMessagesRef.current = maxContextMessages;
    maxContextCharsRef.current = maxContextChars;
  }, [maxContextMessages, maxContextChars]);

  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Set immediately before an abort the user did not ask for, and consumed by
  // the catch in `startTurn`. An AbortError cannot say why it was raised, and
  // the two reasons need opposite handling: backgrounding strands the thread
  // and has to be surfaced, while abort()/reset()/a superseding send must stay
  // silent.
  const backgroundAbortRef = useRef(false);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background") {
        if (isLoadingRef.current) backgroundAbortRef.current = true;
        abortControllerRef.current?.abort();
        setIsLoading(false);
        // The ref has to fall with the state. `retry()` reads the ref, not the
        // state, and the rejection that clears it in `.finally` does not land
        // until the aborted request settles: leaving it true made the retry the
        // interruption exists to offer a silent no-op.
        isLoadingRef.current = false;
      }
    });
    return () => sub.remove();
  }, []);

  /**
   * Run one turn against `history` — the message list exactly as it should be
   * sent, already containing the user message being answered.
   *
   * Extracted from `sendMessage` so `retry` can re-run the last turn without
   * appending a second copy of the user's message to the thread.
   */
  const startTurn = useCallback(
    (history: Message[]) => {
      const requestId = ++requestIdRef.current;

      setIsLoading(true);
      isLoadingRef.current = true;
      setError(null);
      setErrorKind(null);

      // Superseding an in-flight request is intentional, so the abort it causes
      // must not read as an interruption.
      backgroundAbortRef.current = false;
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const assistantId = `assistant_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      const run = async () => {
        const adapter = adapterRef.current!;
        const systemPrompt = systemPromptRef.current;

        const budgeted = trimToContextBudget(history, maxContextMessagesRef.current, maxContextCharsRef.current);
        const apiMessages = [
          { role: "system" as const, content: systemPrompt },
          ...budgeted.map((m) => ({ role: m.role, content: m.content })),
        ];

        devLog.info(`LLM request`, {
          provider: llmConfig.provider,
          model: llmConfig.model,
          messageCount: apiMessages.length,
          lastUserMsg: budgeted.at(-1)?.content,
          streaming: streaming && typeof adapter.chatStream === "function",
        });

        // Streaming path — only when enabled AND the adapter implements chatStream.
        if (streaming && typeof adapter.chatStream === "function") {
          // Insert a placeholder assistant message immediately so the UI can
          // mount a streaming bubble bound to `assistantId`.
          const placeholder: Message = {
            id: assistantId,
            role: "assistant",
            content: "",
            isStreaming: true,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, placeholder]);

          let finalRaw = "";
          await adapter.chatStream(
            apiMessages,
            (accumulated: string, isDone: boolean) => {
              if (requestId !== requestIdRef.current) return;
              finalRaw = accumulated;
              if (isDone) return; // final write happens below, after strict validate
              const partial = parsePartialJson(accumulated);
              if (!partial) return;
              const loose = WireAIPartialResponseSchema.safeParse(partial.parsed);
              if (!loose.success) return;
              const data = loose.data;
              if (data.action !== "render" || !data.component) return;
              if (!registry.has(data.component)) return;
              pushStream(assistantId, {
                response: {
                  action: "render",
                  component: data.component,
                  props: data.props ?? {},
                  message: data.message,
                } as WireAIResponse,
                isStreaming: true,
              });
            },
            controller.signal
          );

          if (requestId !== requestIdRef.current) return;

          devLog.info(`LLM streaming response complete`, { raw: finalRaw });

          const response = validateLLMResponse(finalRaw, registry);
          devLog.info(`parsed response`, {
            action: response.action,
            component: (response as { component?: string }).component,
          });

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: finalRaw, response, isStreaming: false, timestamp: Date.now() }
                : m
            )
          );
          clearStream(assistantId);
          // Notify with the finalized message.
          onMessageRef.current?.({
            id: assistantId,
            role: "assistant",
            content: finalRaw,
            response,
            isStreaming: false,
            timestamp: Date.now(),
          });
          return;
        }

        // Non-streaming path — unchanged behavior.
        const raw = await adapter.chat(apiMessages, controller.signal);
        // Must stay adjacent to the awaited chat() above, with no await in
        // between: the adapter holds the extra parts of its most recent call
        // only, so adjacency is the whole reason this is provably *this* turn's
        // data. Adapters that carry none omit the method and this is undefined.
        const dataParts = adapter.readLastDataParts?.();

        if (requestId !== requestIdRef.current) return;

        devLog.info(`LLM response`, { raw });

        const response = validateLLMResponse(raw, registry);
        devLog.info(`parsed response`, {
          action: response.action,
          component: (response as { component?: string }).component,
        });

        const assistantMsg: Message = {
          id: assistantId,
          role: "assistant",
          content: raw,
          response,
          // Spread, not `dataParts`, so a turn with no extra data produces a
          // message with no such key at all rather than an explicit undefined.
          ...(dataParts ? { dataParts } : {}),
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
        onMessageRef.current?.(assistantMsg);
      };

      run()
        .catch((err: unknown) => {
          // Make sure no streaming state lingers if we bail out.
          clearStream(assistantId);
          // Drop the placeholder so the user doesn't see an empty streaming bubble.
          setMessages((prev) => prev.filter((m) => !(m.id === assistantId && m.isStreaming)));

          // Consume the flag: this rejection is the one that abort was for.
          const abortedByBackground = backgroundAbortRef.current;
          backgroundAbortRef.current = false;

          const kind = classifyTurnFailure(err, abortedByBackground);
          if (kind === "silent") return;
          if (requestId !== requestIdRef.current) return;
          if (kind === "interrupted") {
            // The user's message stays in the thread and `error` stays null:
            // nothing failed, the turn was cut short. Surface the state so the
            // app can offer `retry`. NEVER resend from here.
            setErrorKind("interrupted");
            return;
          }
          devLog.error("sendMessage failed", err instanceof Error ? err : new Error(String(err)));
          setError(err instanceof Error ? err.message : "Something went wrong");
          setErrorKind("failed");
        })
        .finally(() => {
          if (requestId === requestIdRef.current) {
            setIsLoading(false);
            isLoadingRef.current = false;
          }
        });
    },
    // `streaming` is read inside the callback (both branches of the streaming
    // check), so it belongs here: without it, flipping the provider's
    // `streaming` prop left this callback holding the value from the render
    // that created it. `llmFingerprint` is a strict superset of the
    // provider/model pair — those two stay listed because the callback reads
    // them directly, and being primitives they cannot churn.
    [registry, llmConfig.provider, llmConfig.model, llmFingerprint, streaming]
  );

  const sendMessage = useCallback(
    (text: string, options?: SendMessageOptions) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (isLoadingRef.current && !options?.interruptLoading) return;

      const userMsg: Message = {
        id: `user_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };

      const nextMessages = [...messagesRef.current, userMsg];
      setMessages(nextMessages);
      onMessageRef.current?.(userMsg);
      startTurn(nextMessages);
    },
    [startTurn]
  );

  const retry = useCallback(() => {
    if (isLoadingRef.current) return;
    const history = messagesRef.current;
    const last = history.at(-1);
    // Only an unanswered user message can be retried. Anything else means there
    // is nothing to re-run, so this is a no-op rather than a surprise send —
    // and re-running `history` as-is is what keeps the user's message from
    // being appended twice.
    if (!last || last.role !== "user") return;
    startTurn(history);
  }, [startTurn]);

  const reset = useCallback(() => {
    // Resetting is intentional, so the abort it causes must stay silent.
    backgroundAbortRef.current = false;
    abortControllerRef.current?.abort();
    // Re-create the adapter so per-session state (e.g. A2A contextId) is cleared
    // along with the message history.
    adapterRef.current = createAdapter(llmConfig);
    setMessages(initialMessages ?? []);
    setIsLoading(false);
    // The ref has to fall with the state. `sendMessage` and `retry` both guard
    // on the ref rather than on `isLoading`, and the `.finally` that clears it
    // does not run until the request this reset just aborted settles: leaving
    // it true made the first send after a reset a silent no-op.
    isLoadingRef.current = false;
    setError(null);
    setErrorKind(null);
  }, [initialMessages, llmFingerprint]);

  const abort = useCallback(() => {
    // Aborting is intentional, so it must stay silent.
    backgroundAbortRef.current = false;
    abortControllerRef.current?.abort();
    setIsLoading(false);
    // Same reason as in `reset`: the guards in `sendMessage` and `retry` read
    // the ref, and the `.finally` that clears it waits for the aborted request
    // to settle. A consumer who stops a turn and immediately sends the next one
    // got nothing back until the ref fell here too.
    isLoadingRef.current = false;
  }, []);

  return { messages, isLoading, error, errorKind, sendMessage, retry, reset, abort };
};
