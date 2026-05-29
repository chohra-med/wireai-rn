# Mental Coach Example — wireai-rn

This example demonstrates how to build a specialized AI agent (a Mental Coach) using the WireAI SDK.

## Key Features

- **Empathetic System Prompt**: Uses `systemPromptSuffix` to define the AI's personality and goals.
- **Interactive Check-ins**: Guided conversation using native components like `MoodSelector` (SelectionCard), `ActionCard`, and `TextInputCard`.
- **Feature-based Architecture**: Organizes code into `src/features/coaching` for scalability.
- **Custom UI Helpers**: Includes simple, high-performance layout and typography helpers based on WireAI tokens.

## Setup

```bash
# Install dependencies from the root
npm install

# Start the example
cd examples/mental-coach
npx expo start
```

## How it works

The app wraps the `CoachingScreen` in a `WireAIProvider` with a specialized instruction:

```tsx
const SYSTEM_PROMPT_SUFFIX = `
You are a warm, empathetic Mental Coach. 
Your goal is to guide the user through a mindful check-in.
Use interactive components to make the experience structured but fluid.
`;
```

This tells the LLM how to behave, while the SDK handles the heavy lifting of rendering and validating the components.
