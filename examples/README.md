# Examples

Reference apps built on `wireai-rn`. Each one is a runnable workspace package
under `yarn workspaces` — install once at the repo root, then `cd` into the
example you want.

| Example | Stack | What it shows |
| --- | --- | --- |
| [`mental-coach`](./mental-coach/) | Expo + `OpenAIAdapter` | Self-contained client. Streaming on. 10-step empathic check-in flow that exercises every built-in A2UI component (MoodTracker, SelectionCard, ChipSelectCard, TextInputCard, NumberStepperCard, ContentSelectCard, StepList, InfoList, ConfirmPrompt, StatusCard, ActionCard) plus a custom `MoodTracker` registered through the registry. |
| [`langchain-multistep`](./langchain-multistep/) | Expo + Express + LangChain (`WebhookAdapter`) | First **client + server** example. Demonstrates a 2-step LangChain LCEL workflow (`retrieve_user_context` → `generate_plan`) driving generative UI: TextInputCard → SelectionCard → StepList. Server lives in `langchain-multistep/server/`, client in `langchain-multistep/app/`. |
| `quickstart` | (placeholder) | Reserved for a minimum-viable example. |

## Why some examples have a `server/` and some don't

`mental-coach` talks to OpenAI from the device — fine for a demo, not for
production (keys ship in the bundle). `langchain-multistep` shows the
production pattern: keep the heavy agent (LangChain / LangGraph / CrewAI /
n8n / Flowise / your own) on a server, and connect with `WebhookAdapter`.

The SDK itself stays framework-agnostic — no `@langchain/*` deps in
`packages/core/`.

## Running

From the repo root:

```bash
yarn install
yarn workspace mental-coach start
# or
yarn workspace langchain-multistep-app start
```

`langchain-multistep` also needs its server running — see
[`langchain-multistep/README.md`](./langchain-multistep/README.md).
