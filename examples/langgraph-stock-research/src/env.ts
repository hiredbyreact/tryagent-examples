import { TryAgent } from "@tryagent/sdk";

export const DEFAULT_TRYAGENT_BASE_URL = "https://api.tryagent.ai";

type Env = Record<string, string | undefined>;

export function createTryAgentClientFromEnv(env: Env = process.env) {
  const apiKey = env.TRYAGENT_API_KEY;
  if (!apiKey) {
    throw new Error(
      "TRYAGENT_API_KEY is required. Create one in the TryAgent app at /settings/api-keys.",
    );
  }

  return new TryAgent({
    apiKey,
    baseUrl: env.TRYAGENT_BASE_URL ?? DEFAULT_TRYAGENT_BASE_URL,
  });
}
