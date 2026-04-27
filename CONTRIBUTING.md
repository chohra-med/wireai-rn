# Contributing to wireai-rn

Thank you for considering contributing to WireAI! This guide will help you get started.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/chohra-med/wireai-rn.git
cd wireai-rn

# Install dependencies
npm install

# Build the SDK
npm run build

# Run tests
npm run test
```

## Project Structure

```
wire-rn/
├── packages/core/     ← The SDK (published to npm)
│   ├── src/
│   │   ├── provider/  ← WireAIProvider
│   │   ├── hooks/     ← useWireAIThread, useWireAIInput, useWireAIAction
│   │   ├── renderer/  ← ComponentRenderer, ErrorBoundary, Fallback, Loading
│   │   ├── registry/  ← Component registry + context
│   │   ├── schema/    ← Zod schemas, system prompt builder, response validator
│   │   ├── llm/       ← Ollama, LM Studio, Webhook adapters
│   │   ├── utils/     ← Dev logger, context budget, JSON extractor
│   │   ├── styles/    ← Design tokens (violet + ink palette)
│   │   └── index.ts   ← Public API barrel
│   └── dist/          ← Built output (ESM + CJS + .d.ts)
├── apps/boilerplate/  ← Demo Expo app
└── docs/              ← Documentation
```

## Writing a Component

Every component in WireAI follows this pattern:

### 1. Define a Zod schema (JSON-serializable props only)

```tsx
const schema = z.object({
  title: z.string().describe("Card heading"),
  options: z.array(z.string()).describe("3-6 selectable options"),
});
```

### 2. Write the component with React.memo + useCallback

```tsx
const MyCard = React.memo(({ title, options, onSubmit }: Props) => {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = useCallback((option: string) => {
    if (selected) return; // submitted-state pattern
    setSelected(option);
    onSubmit?.(option);
  }, [selected, onSubmit]);

  return (/* ... */);
});
```

### 3. Export the definition

```tsx
export const MyCardDef: WireAIComponent<typeof schema> = {
  name: "MyCard",
  description: "Use when [trigger]. Ideal for [examples]. Use MyCard instead of X when [condition].",
  component: MyCard,
  propsSchema: schema,
};
```

### Component Rules

- ✅ `React.memo` on every component
- ✅ `useCallback` for all event handlers
- ✅ Submitted-state pattern (disable after first interaction)
- ✅ Description written as LLM routing instruction
- ✅ `.describe()` on every Zod field
- ❌ No functions in Zod schema
- ❌ No inline styles — use `StyleSheet.create`
- ❌ No `any` types

## Pull Request Checklist

Before submitting a PR, ensure:

- [ ] TypeScript compiles (`npm run typecheck`)
- [ ] Tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] If new component: uses `React.memo` + `useCallback`
- [ ] If new component: implements submitted-state pattern
- [ ] If new component: description is an LLM routing instruction
- [ ] If new component: all Zod fields have `.describe()`
- [ ] CHANGELOG updated under `[Unreleased]`

## Code Style

- TypeScript strict mode — zero `any` in public API
- Use `const` over `let` where possible
- Prefer `useCallback` over inline functions
- Prefer `useMemo` for expensive computations
- All public exports go through `src/index.ts`

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add DatePickerCard component
fix: handle spilled props from Gemini models
docs: add WebhookAdapter setup guide
chore: update tsup to v9
```

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
