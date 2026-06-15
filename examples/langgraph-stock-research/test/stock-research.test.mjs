import assert from "node:assert/strict";
import test from "node:test";
import {
  TEST_TRYAGENT_BASE_URL,
  createStockResearchGraph,
  createTryAgentClientFromEnv,
} from "../dist/index.js";
import { parseTickerArg } from "../dist/cli-args.js";

test("high-risk stock research creates a TryAgent escalation", async () => {
  const escalations = [];
  const tryagent = {
    async escalate(policy, input) {
      escalations.push({ policy, input });
      return {
        id: "esc_test_123",
        object: "escalation",
        project: "ten_test",
        policy,
        queue: "Research",
        agentId: input.agentId,
        runId: input.runId,
        subject: input.subject,
        question: input.question,
        evidence: input.evidence,
        choices: input.choices,
        status: "open",
        dueAt: new Date(Date.now() + 60000).toISOString(),
        timeRemainingMs: 60000,
        defaultChoice: "watchlist",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },
  };
  const researcher = {
    async research() {
      return {
        ticker: "NVDA",
        companyName: "Nvidia Corporation",
        priceChangePercent: 9.2,
        peRatio: 78,
        debtToEquity: 2.4,
        headlines: [
          "AI chip demand surges while analysts debate valuation risk",
        ],
      };
    },
  };

  const graph = createStockResearchGraph({
    tryagent,
    researcher,
    policy: "stock.research_approval",
    resumeUrl: "https://example.com/webhooks/tryagent",
  });

  const result = await graph.invoke({
    ticker: "NVDA",
    runId: "thread-stock-nvda",
  });

  assert.equal(result.status, "awaiting_human");
  assert.equal(result.escalationId, "esc_test_123");
  assert.equal(escalations.length, 1);
  assert.equal(escalations[0].policy, "stock.research_approval");
  assert.equal(escalations[0].input.agentId, "stock-research-langgraph");
  assert.equal(escalations[0].input.runId, "thread-stock-nvda");
  assert.deepEqual(escalations[0].input.subject, {
    type: "stock",
    id: "NVDA",
    label: "Nvidia Corporation (NVDA)",
  });
  assert.deepEqual(
    escalations[0].input.choices.map((choice) => choice.id),
    ["approve", "watchlist", "reject"],
  );
  assert.match(escalations[0].input.evidence.join("\n"), /Risk score/);
  assert.equal(escalations[0].input.resume.url, "https://example.com/webhooks/tryagent");
});

test("low-risk stock research completes without a TryAgent escalation", async () => {
  const tryagent = {
    async escalate() {
      throw new Error("unexpected escalation");
    },
  };
  const researcher = {
    async research() {
      return {
        ticker: "MSFT",
        companyName: "Microsoft Corporation",
        priceChangePercent: 1.1,
        peRatio: 31,
        debtToEquity: 0.4,
        headlines: ["Cloud revenue expands with stable margins"],
      };
    },
  };

  const graph = createStockResearchGraph({
    tryagent,
    researcher,
    policy: "stock.research_approval",
  });

  const result = await graph.invoke({
    ticker: "MSFT",
    runId: "thread-stock-msft",
  });

  assert.equal(result.status, "completed");
  assert.equal(result.escalationId, undefined);
  assert.match(result.report, /Microsoft Corporation/);
});

test("TryAgent client factory defaults to the test API instead of prod", () => {
  const client = createTryAgentClientFromEnv({
    TRYAGENT_API_KEY: "ain_live_aik_test_secret",
  });

  assert.equal(client.baseUrl, TEST_TRYAGENT_BASE_URL);
});

test("CLI ticker parser tolerates pnpm argument separator", () => {
  assert.equal(parseTickerArg(["--", "NVDA"]), "NVDA");
  assert.equal(parseTickerArg(["MSFT"]), "MSFT");
  assert.equal(parseTickerArg(["--", "  "]), undefined);
  assert.equal(parseTickerArg(["--"]), undefined);
});
