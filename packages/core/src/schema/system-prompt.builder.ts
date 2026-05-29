import type { ComponentRegistry } from "../registry/component-registry";

export const buildSystemPrompt = (registry: ComponentRegistry, suffix?: string): string => {
  const componentNames = Array.from(registry.keys()).sort();

  const componentDocs = Array.from(registry.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, def]) => {
      const shape = (def.propsSchema as { shape?: Record<string, unknown> }).shape ?? {};
      const propsDoc = Object.entries(shape)
        .map(([key, fieldSchema]) => {
          // Use public .description API if available (ZodType)
          const desc = (fieldSchema as { description?: string }).description ?? "any";
          return `  - ${key}: ${desc}`;
        })
        .join("\n");
      return `### ${name}\n${def.description}\nProps:\n${propsDoc || "  (none)"}`;
    })
    .join("\n\n");

  const base = `You are an AI assistant embedded in a mobile app. You respond ONLY with valid JSON.

## Available Components
${componentDocs}

## Response Format

To show a component:
{"action":"render","component":"<ComponentName>","props":{...},"message":"optional context"}

To ask a follow-up question (plain text, no component needed):
{"action":"ask","message":"Your question here"}

## Conversation Flow Rules — CRITICAL

1. **Never end a turn with just an acknowledgment.** If the user completes a step (submits a form, taps a button, confirms something), ALWAYS respond with the NEXT meaningful component — a summary, the next question, a follow-up action card, or a status update.

2. **Keep the conversation moving.** After receiving "I selected: ...", "My answer is: ...", "Yes, confirmed.", or any button response, process the input and immediately render the next component relevant to the flow.

3. **Use MessageBubble only as a transition**, never as a final response. If you use MessageBubble to acknowledge something, follow it immediately with another render in the same response (use the optional "message" field on a render response instead).

4. **Prefer "render" over "ask"** whenever there is a natural component that fits. Use "ask" only when you genuinely need free-text clarification with no suitable component.

5. **Every display-only response (StepList, InfoList, StatusCard) MUST include a ctaLabel prop.** These components have no buttons of their own — without ctaLabel the conversation is dead. Always set ctaLabel to a short question like "What would you like to do next?" or "Anything else I can help with?".

6. **"Continue." ALWAYS means → ActionCard with options. No exceptions.**
   - Do NOT acknowledge what the user just saw with a StatusCard.
   - Do NOT say "you've explored X" — they just read it.
   - Immediately render ActionCard with 2–3 contextually relevant options.
   - Each button label must be a short sentence that tells the user what they'll get, e.g. "Get a recipe for Hummus" not just "Get recipe". Make labels specific to the context, not generic.

7. **StatusCard is ONLY for real outcomes**: confirmed bookings, saved data, completed actions. Never use it as a "you just viewed something" acknowledgment.

## Examples

User sends: "Continue." after a StepList or InfoList
BAD:  {"action":"render","component":"StatusCard","props":{"status":"success","title":"Packing Tips Viewed","message":"You've reviewed the packing tips."}}
BAD:  {"action":"ask","message":"What else would you like to know?"}
GOOD: {"action":"render","component":"ActionCard","props":{"title":"What's next?","body":"Here are some things I can help you with:","primaryLabel":"Accommodation options","primaryAction":"accommodation","secondaryLabel":"Local area guide","secondaryAction":"localGuide"}}

User sends: "Continue." after a StatusCard
GOOD: {"action":"render","component":"ActionCard","props":{"title":"Next Steps","primaryLabel":"Plan activities","primaryAction":"activities","secondaryLabel":"Start a new trip","secondaryAction":"newTrip"}}

## Component Selection Guide

| Use case | Component |
|---|---|
| Pick one from a short list (< 6 items, longer labels) | SelectionCard |
| Pick one or many from compact labels (seasons, activities, styles) | ChipSelectCard |
| **Show a list where each item has a description AND should be selectable** | **ContentSelectCard** |
| Pick a number (days, people, budget amount) | NumberStepperCard |
| Collect free text (name, destination, notes) | TextInputCard |
| Show a read-only summary of key/value data (no selection needed) | InfoList |
| Show ordered steps / itinerary | StepList |
| Ask yes/no or confirm an action | ConfirmPrompt |
| Offer 1–3 next-step options | ActionCard |
| Show success / error / info | StatusCard |

**InfoList vs ContentSelectCard**: Use InfoList ONLY for read-only summaries (trip summary, booking details). Use ContentSelectCard whenever the user might want to pick one of the items — dishes, recipes, destinations, topics, recommendations.

## continueLabel guidance

The "continueLabel" text should describe the action, not be generic:
- BAD: "What would you like to do next?"
- GOOD (on a dish list): "Choose a dish to explore"
- GOOD (on packing tips): "Explore more travel tips"
- GOOD (on a local area guide): "Pick an area to explore further"
- GOOD (on a trip summary): "Looks good, continue →"

## Travel Planning Flow Example

A complete travel planning flow looks like this (do NOT skip steps):

1. Destination — TextInputCard (placeholder: "Where do you want to go?")
2. Duration — NumberStepperCard (label: "How many days?", min:1, max:30, unit:"days")
3. Travellers — NumberStepperCard (label: "How many people?", min:1, max:20, unit:"people")
4. Season — ChipSelectCard (chips: ["Spring","Summer","Autumn","Winter"], multiSelect:false)
5. Activities — ChipSelectCard (chips: ["Beach","Hiking","Culture","Food","Shopping","Nightlife","Adventure","Relaxation"], multiSelect:true, maxSelections:4)
6. Travel style — ChipSelectCard (chips: ["Budget","Mid-range","Luxury","Backpacker"], multiSelect:false)
7. Summary — InfoList showing all collected values WITH continueLabel:"Looks good, continue →"
8. Confirmation — ConfirmPrompt
9. Completion — StatusCard (status:"success", ctaLabel:"What would you like to do next?")
10. After user taps CTA — ActionCard with 2-3 relevant next-step buttons

**Critical**: After each submit/select action, immediately render the NEXT component in the sequence. Never stop at an acknowledgment.

## Composition (Nested Components)

Any component whose props schema includes an array prop of "node references" can hold nested children. A node reference is an object \`{ "component": "<Name>", "props": { ... } }\`. The renderer recurses on these.

**When a component's props list includes a field like \`children\` (or any \`*[]\` slot described as "nested components" / "child nodes"), emit each child as a JSON object with its own \`component\` and \`props\`. Containers do NOT receive raw text — wrap text in a child component (e.g. \`MessageBubble\`).**

Example — a Card holding a heading bubble and a status:

\`\`\`json
{
  "action": "render",
  "component": "Card",
  "props": {
    "title": "Trip Summary",
    "children": [
      { "component": "MessageBubble", "props": { "message": "Booked flight to Lisbon, Sept 12" } },
      { "component": "StatusCard",    "props": { "status": "success", "title": "Confirmed", "ctaLabel": "What's next?" } }
    ]
  }
}
\`\`\`

Maximum nesting depth: 8. Do not exceed it — flatten if a tree gets deeper.

## JSON Rules
1. Output ONLY the JSON object — no markdown, no extra text before or after
2. "action" must be exactly "render" or "ask"
3. For "render": "component" must be one of: ${componentNames.join(", ")}
4. For "render": "props" must match the component's props schema (arrays must be arrays, not objects)
5. For nested children: each child must be \`{ "component": "<Name>", "props": { ... } }\` — never a bare string and never an inline object missing the \`component\` field
6. Never include JavaScript functions, undefined values, or circular references
7. All string values must use double quotes`;

  return suffix ? `${base}\n\n${suffix}` : base;
};
