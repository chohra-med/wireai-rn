# Component Inventory

> Anti-hallucination anchor. Check this before creating any new component.  
> If it's here, don't recreate it — use or extend the existing one.

All 11 components are included in `defaultComponents` and exported from `wireai-rn`.

---

## Component Table

| Component | Registry Key | LLM calls it as | Purpose |
|-----------|-------------|-----------------|---------|
| `ActionCard` | `ActionCard` | `"component":"ActionCard"` | Single CTA button with a title and optional subtitle |
| `ChipSelectCard` | `ChipSelectCard` | `"component":"ChipSelectCard"` | Chip picker — single or multi-select from a list of short labels |
| `ConfirmPrompt` | `ConfirmPrompt` | `"component":"ConfirmPrompt"` | Yes/No confirmation dialog |
| `ContentSelectCard` | `ContentSelectCard` | `"component":"ContentSelectCard"` | Rich card picker — each option has a title + description |
| `InfoList` | `InfoList` | `"component":"InfoList"` | Key-value summary display (label: value pairs) |
| `MessageBubble` | `MessageBubble` | `"component":"MessageBubble"` | Chat-style text bubble (used internally by the renderer) |
| `NumberStepperCard` | `NumberStepperCard` | `"component":"NumberStepperCard"` | Numeric stepper with configurable min/max/step |
| `SelectionCard` | `SelectionCard` | `"component":"SelectionCard"` | Option list — user taps one option from a vertical list |
| `StatusCard` | `StatusCard` | `"component":"StatusCard"` | Status display with icon, title, subtitle |
| `StepList` | `StepList` | `"component":"StepList"` | Numbered step-by-step instructions with CTA |
| `TextInputCard` | `TextInputCard` | `"component":"TextInputCard"` | Free-text input card with label and submit button |

---

## Key Props Reference

### ActionCard
```typescript
{
  title: string;
  subtitle?: string;
  actionLabel: string;
}
```

### ChipSelectCard
```typescript
{
  title: string;
  chips: string[];
  multiSelect?: boolean;
  maxSelections?: number;
  submitLabel?: string;
}
```

### ConfirmPrompt
```typescript
{
  question: string;
  confirmLabel?: string;   // default: "Yes"
  cancelLabel?: string;    // default: "No"
}
```

### ContentSelectCard
```typescript
{
  title: string;
  items: { id: string; title: string; description: string }[];
  multiSelect?: boolean;
  submitLabel?: string;
}
```

### InfoList
```typescript
{
  title?: string;
  items: { label: string; value: string }[];
  continueLabel?: string;
}
```

### NumberStepperCard
```typescript
{
  label: string;
  min?: number;        // default: 0
  max?: number;        // default: 10
  step?: number;       // default: 1
  defaultValue?: number;
  unit?: string;
  submitLabel?: string;
}
```

### SelectionCard
```typescript
{
  title: string;
  options: string[];
}
```

### StatusCard
```typescript
{
  status: "success" | "error" | "warning" | "info";
  title: string;
  subtitle?: string;
  actionLabel?: string;
}
```

### StepList
```typescript
{
  title: string;
  steps: { title: string; description?: string }[];
  ctaLabel?: string;
}
```

### TextInputCard
```typescript
{
  label: string;
  placeholder?: string;
  submitLabel?: string;
  multiline?: boolean;
}
```

---

## Custom Components in mental-coach

These are registered in `examples/mental-coach/src/navigation/AppNavigator.tsx` alongside `defaultComponents`:

| Component | Registry Key | File |
|-----------|-------------|------|
| `MoodTracker` | `MoodTracker` | `src/components/wire-ui/MoodTracker.tsx` |
| `Stack` | `Stack` | `src/components/wire-ui/Stack.tsx` |
