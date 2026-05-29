/**
 * Mocked user-context retrieval tool.
 *
 * In a real app this would query a vector store, a CRM, the user's own
 * project history, etc. For the example it returns a deterministic blob so
 * the chain's behaviour is reproducible without external services.
 */
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const inputSchema = z.object({
  sessionId: z.string().describe("Opaque session id from the client."),
});

export type UserContext = {
  preferredStack: string;
  workStyle: string;
  priorProjects: string[];
  energyWindow: string;
};

const FAKE_PROFILES: Record<string, UserContext> = {
  default: {
    preferredStack: "TypeScript + React Native",
    workStyle: "async, deep-focus blocks, prefers writing before talking",
    priorProjects: [
      "Habit tracker (shipped to TestFlight)",
      "AI prompt-library CLI (open-sourced)",
    ],
    energyWindow: "evenings on weekdays, late mornings on weekends",
  },
};

function profileFor(sessionId: string): UserContext {
  // Stable per-session profile. The mock just returns the default profile
  // but the signature lets a real implementation route on sessionId.
  return FAKE_PROFILES[sessionId] ?? FAKE_PROFILES.default;
}

/**
 * LangChain Tool — retrieve_user_context.
 *
 * Bound into the chain as Step A. Output is JSON-serialisable so it can be
 * piped into the next prompt verbatim.
 */
export const retrieveUserContextTool = tool(
  async ({ sessionId }: z.infer<typeof inputSchema>) => {
    const profile = profileFor(sessionId);
    return JSON.stringify(profile);
  },
  {
    name: "retrieve_user_context",
    description:
      "Retrieve the user's coding profile, work style, prior side projects, and best energy window. Use before planning to tailor the plan.",
    schema: inputSchema,
  }
);

export function getUserContext(sessionId: string): UserContext {
  return profileFor(sessionId);
}
