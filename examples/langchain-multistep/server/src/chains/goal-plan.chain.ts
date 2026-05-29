/**
 * goal-plan.chain — the LangChain workflow that drives this example's UI.
 *
 * Two distinct LCEL steps wired with `RunnableSequence`:
 *
 *   1. retrieve_user_context — calls the mocked retrieval tool with the
 *      session id, returns a structured user profile.
 *   2. generate_plan         — second LLM call. Takes the goal, the weekly
 *      time commitment, the retrieved profile, and asks the model to emit a
 *      strict A2UI `StepList` envelope.
 *
 * The final output is a *string* containing the A2UI JSON envelope. The HTTP
 * handler parses + Zod-validates that string before returning it to the
 * client.
 */
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatOpenAI } from "@langchain/openai";
import { getUserContext } from "../tools/user-context.tool.js";

export type ChainInput = {
  sessionId: string;
  goal: string;
  weeklyCommitment: string;
};

type WithProfile = ChainInput & {
  profile: string;
};

const PLAN_SYSTEM_PROMPT = `You are an expert goal coach. You return STRICTLY ONE JSON object — no prose, no markdown fences, no commentary.

The JSON must match this exact shape:

{
  "action": "render",
  "component": "StepList",
  "message": "<one warm sentence acknowledging the user>",
  "props": {
    "title": "<short plan title>",
    "steps": [
      { "title": "<step 1 title>", "description": "<step 1 detail, 1 short sentence>" },
      { "title": "<step 2 title>", "description": "<step 2 detail, 1 short sentence>" },
      { "title": "<step 3 title>", "description": "<step 3 detail, 1 short sentence>" }
    ],
    "ctaLabel": "What's next?"
  }
}

Rules:
- EXACTLY 3 steps.
- Each step is concrete and doable within the user's weekly commitment.
- Reference the retrieved profile (preferred stack, work style, energy window).
- No fenced code blocks. No leading or trailing text. Return raw JSON only.`;

const planPrompt = ChatPromptTemplate.fromMessages([
  ["system", PLAN_SYSTEM_PROMPT],
  [
    "human",
    `Goal:\n{goal}\n\nWeekly commitment:\n{weeklyCommitment}\n\nUser profile (retrieved via tool):\n{profile}\n\nReturn the StepList JSON now.`,
  ],
]);

export function buildGoalPlanChain(modelName: string) {
  const llm = new ChatOpenAI({
    model: modelName,
    temperature: 0.4,
  });

  // Step A — retrieve_user_context tool, exposed as a runnable.
  const retrieveStep = RunnablePassthrough.assign({
    profile: async (input: ChainInput) => {
      const ctx = getUserContext(input.sessionId);
      return JSON.stringify(ctx);
    },
  });

  // Step B — generate_plan LLM call. Returns the raw A2UI JSON string.
  const generateStep = RunnableSequence.from([
    (input: WithProfile) => ({
      goal: input.goal,
      weeklyCommitment: input.weeklyCommitment,
      profile: input.profile,
    }),
    planPrompt,
    llm,
    new StringOutputParser(),
  ]);

  // LCEL pipeline: retrieve -> generate
  return RunnableSequence.from<ChainInput, string>([retrieveStep, generateStep]);
}
