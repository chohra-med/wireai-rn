<div align="center">

# wireai-rn

**Wire your AI agent to native mobile UI.**

Open-source React Native SDK for generative UI: render interactive native components from LLM responses. No WebView, no HTML, no hand-written parser.

</div>

---

Your agent speaks JSON. Mobile users expect native UI. Wire RN closes that gap: register your React Native components with a description and a Zod schema, the LLM picks which one to show, and Wire RN validates the props and renders it natively.

```tsx
import { WireAIProvider } from "wireai-rn";
import { defaultComponents } from "wireai-rn/components";

// The provider key stays on your server. The device talks to your endpoint,
// your endpoint talks to the model.
const config = {
  provider: "webhook" as const,
  baseUrl: "https://api.yourdomain.com/ai/chat",
  model: "gpt-4o-mini",
};

export default function App() {
  return (
    <WireAIProvider llm={config} components={defaultComponents}>
      <ChatScreen />
    </WireAIProvider>
  );
}
```

The agent returns `{ action, component, props }`, Wire RN validates `props` against the component's Zod schema, and a native component renders. Output that fails validation never reaches the screen: the turn is dropped and `useWireAIThread` surfaces it as an `error` string, so nothing crashes and no broken UI renders.

> **Local development only.** You can also point the SDK straight at a provider with `{ provider: "openai", model: "gpt-4o-mini", apiKey: "..." }`. A cloud key in a React Native bundle is plain text and can be pulled out of any `.apk` or `.ipa`, so that config is for your machine, not for a build you ship. The SDK logs a warning in `__DEV__` when it sees an `apiKey`. For a keyless local setup, use the Ollama or LM Studio adapter instead. Details: [SECURITY.md](SECURITY.md).

---

<div align="center">

_Part of [**Wire AI**](https://getwireai.com), the AI growth engineer for mobile apps._

[![npm version](https://img.shields.io/npm/v/wireai-rn.svg)](https://www.npmjs.com/package/wireai-rn)
[![npm downloads](https://img.shields.io/npm/dm/wireai-rn.svg)](https://www.npmjs.com/package/wireai-rn)
[![license](https://img.shields.io/npm/l/wireai-rn.svg)](packages/core/LICENSE)
[![types](https://img.shields.io/npm/types/wireai-rn.svg)](https://www.npmjs.com/package/wireai-rn)
[![stars](https://img.shields.io/github/stars/chohra-med/wireai-rn.svg?style=social)](https://github.com/chohra-med/wireai-rn)

Created by [**Malik Chohra**](https://getwireai.com?utm_source=github&utm_medium=readme&utm_campaign=creator) · [Code Meet AI newsletter](https://codemeetai.substack.com?utm_source=github&utm_medium=readme&utm_campaign=newsletter)

Sponsored by [AI Mobile Launcher](https://aimobilelauncher.com?utm_source=github&utm_medium=readme&utm_campaign=sponsor) and [CasaInnov](https://casainnov.com?utm_source=github&utm_medium=readme&utm_campaign=sponsor)

</div>

---

## Why Wire RN

- **Native, not WebView**: 11 built-in components, plus your own. Real React Native, themeable.
- **Validated by Zod**: no malformed AI output ever reaches the screen.
- **Streaming by default**: progressive rendering as tokens arrive, Hermes-safe (XHR, not `fetch`).
- **Bring any model**: OpenAI, Ollama, LM Studio, a generic Webhook, or an A2A (Agent-to-Agent) endpoint.
- **Nested composition**: generated components can nest other components, not just a flat list.
- **Zero agent framework in your bundle**: LangChain / LangGraph stay on your server; the device stays thin.

## Install

```bash
npm install wireai-rn zod
# or
yarn add wireai-rn zod
```

**Full documentation, step-by-step guide, and API reference:** [packages/core/README.md](packages/core/README.md)

## Repository structure

```
wireai-rn/
├── packages/core/             ← the wireai-rn SDK (published to npm)
├── examples/
│   ├── mental-coach/          ← streaming demo app
│   └── langchain-multistep/   ← Express + LangChain LCEL server + RN client
├── apps/boilerplate/          ← demo Expo app
└── .github/                   ← CI workflows
```

## Documentation

- [SDK README + full API](packages/core/README.md): install, peer deps and the zod v3 pin, step-by-step guide, hooks, streaming, composition
- [Example: mental-coach](examples/mental-coach/README.md): client-only Expo app, streaming on, a prompt-driven multi-step flow you run yourself
- [Example: langchain-multistep](examples/langchain-multistep/README.md): the production shape, an Express + LangChain server owns the prompt and the flow, the app renders through `WebhookAdapter`
- [FEATURES.md](FEATURES.md): what the SDK ships today
- [DOCUMENTATION.md](DOCUMENTATION.md): developer docs, provider setup, testing, deployment checklist
- [SECURITY.md](SECURITY.md): API-key handling and the webhook-proxy pattern
- [CONTRIBUTING.md](CONTRIBUTING.md): pull request guidelines

## Development

```bash
yarn install
yarn build       # build all packages (turbo)
yarn test        # run the test suites
yarn typecheck
```

## Acceptable use and the EU AI Act

**This system is not intended to be put into service as, or changed into, a high-risk AI system.** Do not build Wire-powered surfaces into an Annex III high-risk area: biometrics, critical infrastructure, education and vocational training, employment, access to essential services and benefits, law enforcement, migration, or administration of justice.

The app that ships a Wire-powered surface is the deployer of it. One consequence is worth reading before you build rather than after: if you use this SDK for a chat-like or free-text-responding surface, the Article 50(1) disclosure that a user is interacting with an AI system is your app's to place, not the SDK's.

Our full reading, dated and with the reasoning visible, covering Article 50, Article 25 and what the MIT licence changes: [EU-AI-ACT.md](EU-AI-ACT.md). It is a position, not legal advice.

## The Wire AI ecosystem

[Wire AI](https://getwireai.com) is the AI growth engineer for mobile apps: one agent that runs four versions of every step of your users' journey, live at once, and keeps what makes them stay. This project is one piece of that ecosystem:

- **Wire RN SDK** (`wireai-rn`): this repo. The open-source React Native SDK that renders Wire's AI-driven flows as native components in your app.
- **Expo boilerplate**: an open-source Expo starter wired for Wire AI activation out of the box. https://github.com/chohra-med/expo_boilerplate
- **Claude skills**: skills for each part of the app (SDK integration, the question script, the learning loop) that explain and drive the work from inside your editor.
- **Hosted MCP server**: connect Claude, Cursor, or any MCP client to Wire's hosted server at `https://wireai-mcp.fly.dev/mcp` with an `Authorization: Bearer <key>` header to read your funnel and run the improve loop. Nothing runs from your repo.

The activation kit ships as [`@wireai/activation`](https://www.npmjs.com/package/@wireai/activation) on npm.

## Sponsors

Wire RN is open source and free. Its development is backed by:

- **[AI Mobile Launcher](https://aimobilelauncher.com?utm_source=github&utm_medium=readme&utm_campaign=sponsor)**: the AI-native React Native boilerplate. Ship an AI mobile app with local + cloud LLMs, generative UI, and a paywall already wired.
- **[CasaInnov](https://casainnov.com?utm_source=github&utm_medium=readme&utm_campaign=sponsor)**: AI-native mobile product studio. Done-for-you AI mobile builds and fractional CTO work.

Want your product here? [Open an issue](https://github.com/chohra-med/wireai-rn/issues) or reach out at [getwireai.com](https://getwireai.com?utm_source=github&utm_medium=readme&utm_campaign=sponsor-inquiry).

## License

MIT. See [LICENSE](packages/core/LICENSE).

---

<div align="center">

Created by **[Malik Chohra](https://getwireai.com?utm_source=github&utm_medium=readme&utm_campaign=creator)**, React Native engineer and AI-native founder.

[Website](https://getwireai.com?utm_source=github&utm_medium=readme&utm_campaign=footer) · [Newsletter](https://codemeetai.substack.com?utm_source=github&utm_medium=readme&utm_campaign=newsletter) · [X / @malik_chohra](https://x.com/malik_chohra)

Sponsored by [AI Mobile Launcher](https://aimobilelauncher.com?utm_source=github&utm_medium=readme&utm_campaign=sponsor) and [CasaInnov](https://casainnov.com?utm_source=github&utm_medium=readme&utm_campaign=sponsor)

</div>
