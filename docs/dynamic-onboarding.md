# Guide — Building a Dynamic AI Onboarding

> A step-by-step recipe for turning Wire RN into a **personalized, AI-driven
> onboarding flow** — the kind that asks the right next question based on the
> last answer, then seeds the app with the user's choices.
>
> This is the exact pattern shipped in production by [Morrow Self](https://morrowself.app)
> (a self-mastery app). Names are generic here so you can drop it into any
> product.
>
> **Two ways to run this.** This guide hosts the LLM call yourself (the `webhook`
> or a direct provider adapter) — full control, your own backend + data residency.
> If you'd rather not host the prompt/flow/analytics, point your app at the
> **Wire AI managed backend** instead and skip Steps 2 and 5: see
> [integrate-via-backend.md](./integrate-via-backend.md).

---

## What you're building

A first-run flow where the LLM — not a hard-coded questionnaire — drives the
conversation:

```
App explanation (static slides)
        │
        ▼
AI onboarding  ──►  one native card per turn (text / single-choice / multi-choice)
        │           each question reacts to every previous answer
        ▼
Summary card (StatusCard) ends the conversation
        │
        ▼
Second LLM call  ──►  structured plan (JSON, schema-validated)
        │
        ▼
Persist the plan as your domain objects + ask for notification permission
        │
        ▼
Drop the user into the app, already personalized
```

Two LLM calls, two jobs:

1. **The thread** (`useWireAIThread`) — a conversational, component-rendering
   loop. This is pure Wire RN.
2. **The plan call** — a single, *non-conversational* call with a strict JSON
   schema that converts the collected answers into rows your app understands
   (tasks, goals, reminders, a workout split — whatever your product stores).

---

## Step 1 — Constrain the component set

A free-form agent can render anything. An onboarding should feel tight, so pass
**only the components the flow needs** to the provider. Three input cards plus a
terminal summary card is enough for most onboardings:

```tsx
import { WireAIProvider } from "wireai-rn";
import {
  SelectionCard,    // single choice (age, experience…)
  ChipSelectCard,   // multi-select (interests, goals…)
  TextInputCard,    // free text (name, "why")
  StatusCard,       // the summary that ENDS the flow
} from "wireai-rn/components";

const ONBOARDING_COMPONENTS = [
  SelectionCard,
  ChipSelectCard,
  TextInputCard,
  StatusCard,
];

export function OnboardingProvider({ children }) {
  return (
    <WireAIProvider
      llm={LLM_CONFIG}
      components={ONBOARDING_COMPONENTS}
      systemPromptSuffix={ONBOARDING_PROMPT}   // ← Step 2
      onThreadUpdate={handleThread}            // ← Step 3
    >
      {children}
    </WireAIProvider>
  );
}
```

Because the registry only holds these four, the auto-generated system prompt
already tells the model these are its only options — the model physically can't
ask for a component you didn't register.

---

## Step 2 — Write the product-specific prompt (the part that matters most)

This is where a generic flow becomes *your* flow. Wire RN auto-generates the
mechanical prompt (component names, props, the response JSON shape) from the
registry. You add the **product brain** through `systemPromptSuffix`.

> **The #1 mistake:** leaving the prompt generic. If your suffix says "onboard a
> new user," the model falls back to whatever it has seen most — usually a
> fitness or to-do flow — no matter what your app actually does. Tell it exactly
> what your product is and what a good outcome looks like.

A strong onboarding suffix has five parts:

```ts
const ONBOARDING_PROMPT = `
# 1. PRODUCT CONTEXT — what the app is, in concrete terms.
You are onboarding a new user of <APP NAME>, a <one-line description>.
The app's core object is a "<thing>" — <definition + 3-4 examples>.
This is NOT a <closest generic category> app; do not default to it.

# 2. FLOW RULES — how to behave each turn.
- Render exactly ONE component per turn.
- Pick the best component: free text → TextInputCard, one-of → SelectionCard,
  many-of → ChipSelectCard (multiSelect).
- Personalize: once you know the user's name, use it in every title.
- Chain: every question after the second MUST reference a previous answer
  (in the title or by narrowing the options). No generic questions.
- Branch: after the user picks a focus area, the NEXT question drills into THAT
  area with concrete options — never pivot to an unrelated topic.

# 3. LENGTH CONTROL — stop the model rambling or quitting early.
Count the question components you've already produced.
- fewer than 6 → you MUST ask another question.
- 6 or more   → you MAY end with a StatusCard.
- If the user says "skip" / "done" / "wrap up" → end immediately.

# 4. TERMINATION — exactly how to end.
End with a StatusCard: { status: "success", title, message } that recaps the
user's answers in their own words. Render nothing after it.

# 5. FEW-SHOT — 2-3 example turns in YOUR domain.
Show the first turn, a mid branch, and the final StatusCard, using your real
options. Examples teach tone and vocabulary faster than rules do.
`;
```

Tips that move the needle:

- **Few-shot examples beat adjectives.** One concrete example turn in your
  domain steers the model more than a paragraph of instructions.
- **Localize.** If you inject the device locale into the suffix
  (`Respond in <language>`), the model produces every label in that language —
  no translation files for the dynamic part.
- **Personalize from attribution.** Passing install source / campaign into the
  suffix lets the model adjust tone (an ad audience vs. organic) without you
  branching code.

---

## Step 3 — Capture the answers

You need the user's answers for the plan call in Step 5. The thread already
holds them — read them off `onThreadUpdate`, which fires with the full message
list on every update:

```ts
function handleThread(messages: Message[]) {
  const answers = extractAnswers(messages);
  saveAnswers(answers); // Redux / MMKV / wherever
}
```

The SDK does not ship `extractAnswers` (it's ~20 lines and depends on your
question shape) — here's the canonical implementation. Pair each rendered
assistant card with the next user reply:

```ts
import type { Message } from "wireai-rn";

function extractAnswers(messages: Message[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== "assistant" || m.response?.action !== "render") continue;
    const props = (m.response.props ?? {}) as Record<string, unknown>;
    const question =
      (props.question as string) ?? (props.title as string) ?? (props.label as string);
    const reply = messages[i + 1];
    if (question && reply?.role === "user") out[question] = reply.content;
  }
  return out;
}
```

Keep this a simple `Record<string, string>` keyed by the question text — that's
all the plan call needs.

---

## Step 4 — Detect the end of the flow

The StatusCard is your signal that questioning is over. When it renders, switch
the screen from "questioning" to "generating," and fire the plan call.

```ts
const isComplete = lastRender?.component === "StatusCard";
```

---

## Step 5 — Turn answers into structured data (the second call)

The conversation is great for *gathering*; it's the wrong tool for *committing*
rows to your database. Make one more LLM call — outside the thread — with a
**strict schema** so you get back data, not prose:

```ts
import { z } from "zod";

const PlanSchema = z.object({
  title: z.string(),
  items: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        category: z.enum(["...your domains..."]).optional().catch(undefined),
      })
    )
    .min(2)
    .max(5),
  reminders: z
    .array(
      z.object({
        title: z.string(),
        body: z.string().min(40),
        time: z.string().regex(/^\d{2}:\d{2}$/),
        frequency: z.enum(["once", "daily", "weekly"]),
      })
    )
    .min(2)
    .max(4),
});

// System prompt: "You are <APP>'s coach. Turn these answers into JSON matching
// this exact shape… each item IS a <domain object>… never wrap in markdown."
// User prompt: the { question: answer } map from Step 3.
const plan = PlanSchema.parse(JSON.parse(stripFences(raw)));
```

Schema notes from production:

- Make enums (like a category) `.optional().catch(undefined)` so a single bad
  field never throws away the whole plan — default it when you persist.
- Use `json_mode` / response-format on providers that support it.
- Keep this call on a **server (Webhook adapter)** in production so your API key
  never ships in the bundle. See [SECURITY.md](../SECURITY.md).

---

## Step 6 — Persist, request permissions, seed the app

Now you have clean data. Two things to get right:

1. **Persist through your normal write path**, not a special onboarding one — so
   the seeded objects sync, survive reinstall, and look identical to ones the
   user creates later.
2. **If you generated reminders, request OS notification permission *before*
   scheduling.** Scheduling without the permission prompt silently no-ops — the
   reminders never fire and the user never sees a dialog. Request first; if
   denied, continue without scheduling rather than dead-ending onboarding.

```ts
const granted = await requestNotificationPermission();
if (granted) await scheduleAll(plan.reminders);
await Promise.allSettled(plan.items.map(persistDomainObject));
finishOnboarding(); // hand off to the app
```

---

## Show the app explanation first

The AI flow opens with "What's your name?" — which lands better *after* the user
knows what the app is. Put your static explanation slides (what the app does,
its promise) **before** the AI onboarding, then route into the Wire RN flow.
Keep a static fallback path too, so first-run always completes if the LLM is
unreachable.

```
WELCOME slides ──► AI onboarding (this guide)
                └─► static questionnaire   (fallback: no key / offline / error)
```

---

## Recap

| Step | Wire RN piece | Your work |
|---|---|---|
| 1 | `components={[…]}` | Pick the 3-4 cards the flow needs |
| 2 | `systemPromptSuffix` | **Describe your product + the flow rules** |
| 3 | `onThreadUpdate` | Build a `{ question: answer }` map |
| 4 | thread render state | Detect the terminal `StatusCard` |
| 5 | (a second plain LLM call) | Schema-validate answers → domain objects |
| 6 | your app | Persist + permissions + hand off |

The SDK handles rendering, validation, context trimming, and error boundaries.
Your leverage is almost entirely in **Step 2** — a precise, product-specific
prompt is the difference between a generic quiz and an onboarding that feels
built for your app.

See also: [`examples/mental-coach`](../examples/mental-coach/) for a runnable
conversational flow, and the [full SDK docs](../packages/core/README.md).
