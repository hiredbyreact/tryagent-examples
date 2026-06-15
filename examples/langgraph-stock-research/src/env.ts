import { TryAgent } from "@tryagent/sdk";

export const TEST_TRYAGENT_BASE_URL =
  "https://agent-inbox-test-api-ekvu46wa6q-uc.a.run.app";

type Env = Record<string, string | undefined>;

export function createTryAgentClientFromEnv(env: Env = process.env) {
  const apiKey = env.TRYAGENT_API_KEY;
  if (!apiKey) {
    throw new Error(
      "TRYAGENT_API_KEY is required. Create one in the test app at /settings/api-keys.",
    );
  }

  return new TryAgent({
    apiKey,
    baseUrl: env.TRYAGENT_BASE_URL ?? TEST_TRYAGENT_BASE_URL,
  });
}
