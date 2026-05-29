/**
 * Express server — the LangChain-powered agent that drives the wireai-rn
 * `langchain-multistep` example app.
 *
 * Contract with `WebhookAdapter` (from wireai-rn):
 *   POST /api/chat
 *   body:    { messages: [{ role, content }, ...], model: string }
 *   header:  x-wire-session-id: <opaque string>      (optional — see below)
 *   returns: { content: "<A2UI JSON envelope as a string>" }
 *
 * Session id handling
 * -------------------
 * The wireai-rn `WebhookAdapter` exposed in v0.1.x does NOT forward custom
 * headers. We support two transport paths so this example works as-is:
 *
 *   1. Direct HTTP callers (curl / Postman / a future SDK version with header
 *      forwarding) can send `x-wire-session-id` — we use it directly.
 *   2. The current Expo client embeds the same id inside the system message
 *      using the marker `[wire-session:<id>]`. We parse it out below.
 *
 * Either way, the chain receives a stable sessionId, which keys the in-memory
 * history buffer so the workflow has continuity across turns.
 */
import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { buildGoalPlanChain } from "./chains/goal-plan.chain.js";

// ─── Config ──────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3000);
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

if (!process.env.OPENAI_API_KEY) {
  // We don't crash so the user can still hit the health endpoint while wiring
  // up their .env, but every /api/chat call will fail fast with a clear error.
  // eslint-disable-next-line no-console
  console.warn(
    "[langchain-multistep] OPENAI_API_KEY is not set. /api/chat will return an error envelope until you add it to .env."
  );
}

// ─── Types & schemas ─────────────────────────────────────────────────────────

const ChatMessageSchema = z.object({
  role: z.string(),
  content: z.string(),
});

const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1),
  model: z.string().optional(),
});

type ChatMessage = z.infer<typeof ChatMessageSchema>;

// Mirrors `WireAIRenderResponseSchema` from wireai-rn — we validate
// server-side too so a malformed LLM emission never reaches the client.
const A2UIRenderSchema = z.object({
  action: z.literal("render"),
  component: z.string().min(1),
  props: z.record(z.string(), z.unknown()),
  message: z.string().optional(),
});

// Specifically the StepList shape we ask the model to emit in Turn 5.
const StepListPropsSchema = z.object({
  title: z.string().optional(),
  steps: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().optional(),
      })
    )
    .min(1),
  ctaLabel: z.string().optional(),
});

// ─── Session store ───────────────────────────────────────────────────────────

type SessionState = {
  history: ChatMessage[];
  createdAt: number;
  updatedAt: number;
};

const sessions = new Map<string, SessionState>();

function getSession(id: string): SessionState {
  let s = sessions.get(id);
  if (!s) {
    s = { history: [], createdAt: Date.now(), updatedAt: Date.now() };
    sessions.set(id, s);
  }
  return s;
}

// ─── Session-id resolution ───────────────────────────────────────────────────

const SESSION_MARKER = /\[wire-session:([a-zA-Z0-9_-]+)\]/;

function resolveSessionId(req: Request, messages: ChatMessage[]): string {
  const headerVal = req.header("x-wire-session-id");
  if (headerVal && headerVal.trim()) return headerVal.trim();

  // Fallback — extract from any system message containing [wire-session:xxx]
  for (const m of messages) {
    if (m.role !== "system") continue;
    const match = m.content.match(SESSION_MARKER);
    if (match) return match[1];
  }

  // Last resort — bucket every header-less, marker-less caller into one bucket.
  // Good enough for local single-user dev; obviously not for production.
  return "anonymous";
}

// ─── Goal + weekly-commitment extraction ─────────────────────────────────────

/**
 * The 4-turn UX is:
 *   Turn 1 (AI):   TextInputCard "What's your goal?"
 *   Turn 2 (USER): goal text
 *   Turn 3 (AI):   SelectionCard "How much time per week?"
 *   Turn 4 (USER): time commitment
 *   Turn 5 (AI):   StepList (this server emits it via LangChain)
 *
 * The 2 user messages we want are simply the last 2 user-role entries in the
 * thread. We grab them in order.
 */
function extractGoalAndCommitment(messages: ChatMessage[]): {
  goal: string | null;
  weeklyCommitment: string | null;
} {
  const userMsgs = messages.filter((m) => m.role === "user");
  if (userMsgs.length === 0) return { goal: null, weeklyCommitment: null };
  if (userMsgs.length === 1) return { goal: userMsgs[0].content, weeklyCommitment: null };

  // Last user message is the time commitment, the one before is the goal.
  const weeklyCommitment = userMsgs[userMsgs.length - 1].content;
  const goal = userMsgs[userMsgs.length - 2].content;
  return { goal, weeklyCommitment };
}

// ─── A2UI envelope helpers ───────────────────────────────────────────────────

function askEnvelope(message: string): string {
  return JSON.stringify({ action: "ask", message });
}

function renderEnvelope(component: string, props: Record<string, unknown>, message?: string): string {
  const payload: Record<string, unknown> = { action: "render", component, props };
  if (message) payload.message = message;
  return JSON.stringify(payload);
}

function statusApology(reason: string): string {
  return renderEnvelope(
    "StatusCard",
    {
      status: "error",
      title: "Something went sideways",
      message: reason,
      ctaLabel: "Try again",
    },
    "Sorry — I couldn't finish that step."
  );
}

// ─── Turn-routing ────────────────────────────────────────────────────────────

const TURN_1_GOAL = renderEnvelope(
  "TextInputCard",
  {
    label: "What goal are we working on?",
    placeholder: "e.g. Ship a side project in 6 weeks",
    submitLabel: "That's my goal",
  },
  "Tell me what you're trying to do — one sentence is plenty."
);

const TURN_3_COMMITMENT = renderEnvelope(
  "SelectionCard",
  {
    title: "How much time per week can you commit?",
    options: [
      "Under 3 hours — small but steady",
      "3 to 6 hours — one solid block per week",
      "6+ hours — I can push hard",
    ],
    submitLabel: "Lock it in",
  },
  "Nice. Now let's calibrate the plan to your real bandwidth."
);

// ─── Chain (built once) ──────────────────────────────────────────────────────

const goalPlanChain = buildGoalPlanChain(MODEL);

// ─── Handler ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    model: MODEL,
    sessions: sessions.size,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
  });
});

app.post("/api/chat", async (req: Request, res: Response) => {
  // 1. Parse + validate request
  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ content: statusApology("Bad request body.") });
    return;
  }
  const { messages } = parsed.data;
  const sessionId = resolveSessionId(req, messages);
  const session = getSession(sessionId);

  // 2. Append the latest user message (if any) into the session log
  const latest = messages[messages.length - 1];
  if (latest && latest.role === "user") {
    session.history.push(latest);
    session.updatedAt = Date.now();
  }

  // 3. Count user turns to route the conversation
  const userTurnCount = messages.filter((m) => m.role === "user").length;

  // Turn 1 — server has nothing from the user yet; ask for the goal.
  if (userTurnCount === 0) {
    res.json({ content: TURN_1_GOAL });
    return;
  }

  // Turn 3 — we have the goal, now ask about weekly commitment.
  if (userTurnCount === 1) {
    res.json({ content: TURN_3_COMMITMENT });
    return;
  }

  // Turn 5 — both inputs collected, run the LangChain workflow.
  const { goal, weeklyCommitment } = extractGoalAndCommitment(messages);
  if (!goal || !weeklyCommitment) {
    res.json({ content: statusApology("Lost track of your goal mid-flow. Let's start over.") });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    res.json({ content: statusApology("OPENAI_API_KEY is not set on the server. Add it to .env and restart.") });
    return;
  }

  try {
    const raw = await goalPlanChain.invoke({ sessionId, goal, weeklyCommitment });

    const cleaned = stripCodeFences(raw).trim();
    const parsedJson = safeParseJson(cleaned);
    if (!parsedJson) {
      res.json({ content: statusApology("The model returned malformed JSON.") });
      return;
    }

    const envelope = A2UIRenderSchema.safeParse(parsedJson);
    if (!envelope.success) {
      res.json({ content: statusApology("The model returned an invalid A2UI envelope.") });
      return;
    }
    if (envelope.data.component !== "StepList") {
      res.json({ content: statusApology(`Expected StepList, got ${envelope.data.component}.`) });
      return;
    }
    const propsCheck = StepListPropsSchema.safeParse(envelope.data.props);
    if (!propsCheck.success) {
      res.json({ content: statusApology("StepList props failed validation.") });
      return;
    }

    res.json({ content: cleaned });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[langchain-multistep] chain error:", err);
    const detail = err instanceof Error ? err.message : "Unknown chain error";
    res.json({ content: statusApology(detail) });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[langchain-multistep] server listening on http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`[langchain-multistep] model: ${MODEL}`);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripCodeFences(s: string): string {
  // Models occasionally return ```json ... ``` despite being told not to.
  const fenceMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenceMatch ? fenceMatch[1] : s;
}

function safeParseJson(s: string): unknown | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
