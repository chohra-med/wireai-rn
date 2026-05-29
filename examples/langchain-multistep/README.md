# langchain-multistep — wireai-rn × LangChain

The first wire-rn example that uses a **server-side LangChain workflow** to
drive native UI. The Expo client renders interactive components, the user
answers, and a 2-step LangChain chain (retrieve user context → generate plan)
returns a tailored A2UI `StepList` that wireai-rn renders natively. Why it
matters: it shows the recommended pattern for any "real" wireai-rn deploy —
keep the mobile bundle slim, run the heavy agent (LangChain / LangGraph /
CrewAI / n8n / Flowise / whatever) on a server, and connect them with the
built-in `WebhookAdapter`.

## Prerequisites

- **Node ≥ 20**
- **Yarn** (the monorepo uses yarn workspaces)
- **Expo CLI** (`npx expo` — no global install needed)
- **OpenAI API key** for the LangChain LLM calls
- **iOS Simulator or Android Emulator** (a real device works too — see
  *"Running on a physical device"* below)

## Quick start

Three terminals — the SDK has to build once, then server + client run side
by side.

```bash
# 1. Install everything from the repo root (yarn workspaces handles linking)
cd <repo-root>
yarn install

# 2. Server — Express + LangChain
cd examples/langchain-multistep/server
cp .env.example .env
# edit .env and paste your OPENAI_API_KEY
yarn dev

# 3. Client — Expo
cd examples/langchain-multistep/app
yarn start
# press `i` for iOS sim, `a` for Android emu
```

## Architecture

```
┌──────────────────────────┐        POST /api/chat        ┌────────────────────────────┐
│  Expo client (this app)  │ ───────────────────────────▶ │  Express + LangChain (svr) │
│                          │   { messages, model }        │                            │
│  WireAIProvider          │                              │  Step A: retrieve_user_ctx │
│   └─ WebhookAdapter      │ ◀─────────────────────────── │  Step B: generate_plan     │
│        (HTTP via fetch)  │   { content: "<A2UI JSON>" } │  Zod-validate envelope     │
│                          │                              │                            │
│  ComponentRenderer       │                              │  In-memory session store   │
│   └─ StepList / etc.     │                              │   keyed by session id      │
└──────────────────────────┘                              └────────────────────────────┘
```

| Layer | What it does |
| --- | --- |
| **wireai-rn (SDK)** | `WebhookAdapter` POSTs the thread to the server. `ComponentRenderer` renders the validated A2UI JSON as native components. |
| **server/src/index.ts** | Routes turns 1, 3, 5. Turns 1 & 3 are hardcoded A2UI envelopes (`TextInputCard`, `SelectionCard`). Turn 5 invokes the LangChain chain. |
| **server/src/chains/goal-plan.chain.ts** | LCEL `RunnableSequence` with 2 steps. Output is validated with Zod before reaching the wire. |
| **server/src/tools/user-context.tool.ts** | Mocked retrieval tool. Swap for a real retriever (Pinecone, Postgres, etc.). |

## Demo flow

1. **Turn 1 (AI):** `TextInputCard` — "What goal are we working on?"
2. **Turn 2 (USER):** types the goal
3. **Turn 3 (AI):** `SelectionCard` — "How much time per week?"
4. **Turn 4 (USER):** picks a commitment band
5. **Turn 5 (AI / LangChain):**
   - **Step A:** `retrieve_user_context` tool returns the user's coding stack,
     work style, prior projects, and energy window.
   - **Step B:** A second LLM call synthesises a 3-step plan as a `StepList`
     A2UI envelope, tailored to the goal + commitment + retrieved profile.

## Why LangChain isn't in the SDK package

`wireai-rn` (in `packages/core/`) stays dependency-light and protocol-agnostic
on purpose — it ships an `OpenAIAdapter`, an `A2AAdapter`, and a generic
`WebhookAdapter`. LangChain (and any other agent framework) belongs on your
server, not in your React Native bundle.

## How to extend

- **Swap the chain.** Replace `goal-plan.chain.ts` with your own LCEL pipeline,
  a LangGraph state machine, an agent executor, etc. The HTTP contract is the
  only thing the client cares about.
- **Add real retrieval.** `user-context.tool.ts` is a stub — replace it with
  a Pinecone / Chroma / Postgres-pgvector retriever. The chain already calls
  it via LangChain's `tool()` helper so it slots in cleanly.
- **More turns.** Bump the turn-routing in `server/src/index.ts` and emit any
  of the 11 built-in wireai-rn components (`ChipSelectCard`, `NumberStepperCard`,
  `ConfirmPrompt`, …) — see `packages/core/src/components/`.
- **Stream tokens.** `WebhookAdapter` has a `chatStream` method; send your
  chain output progressively (`Transfer-Encoding: chunked`) and wireai-rn
  will render partials via its streaming pipeline.

## Running on a physical device

`localhost` resolves to the phone, not your laptop, so:

- **iOS Simulator:** `http://localhost:3000/api/chat` works as-is.
- **Android Emulator:** use `http://10.0.2.2:3000/api/chat`.
- **Real device on the same LAN:** find your laptop's IP
  (`ipconfig getifaddr en0` on macOS) and use `http://<that-ip>:3000/api/chat`.
- **Anywhere on the internet:** run `ngrok http 3000` and paste the HTTPS URL.

Change the URL in the drawer config panel — no rebuild required.

## File tree

```
examples/langchain-multistep/
├── README.md                          # this file
├── app/
│   ├── App.tsx
│   ├── app.json
│   ├── babel.config.js
│   ├── index.ts
│   ├── metro.config.js
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── components/
│       │   ├── ConfigPanel.tsx
│       │   └── ui/                    # Box / Button / Input / Typography
│       ├── navigation/
│       │   └── AppNavigator.tsx
│       └── screens/
│           └── GoalCoachScreen.tsx
└── server/
    ├── README.md
    ├── .env.example
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts                   # Express app + turn routing
        ├── chains/
        │   └── goal-plan.chain.ts     # LCEL multi-step workflow
        └── tools/
            └── user-context.tool.ts   # Mocked retrieval
```
