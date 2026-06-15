import assert from "node:assert/strict";
import test from "node:test";
import { Command, INTERRUPT, isInterrupted } from "@langchain/langgraph";
import {
  DEFAULT_TRYAGENT_BASE_URL,
  createStaticStockResearchStore,
  createStockResearchGraph,
  createTryAgentClientFromEnv,
} from "../dist/index.js";
import { parseTickerArg } from "../dist/cli-args.js";

test("high-risk stock research pauses for investment committee and compliance review", async () => {
  const researchStore = createStaticStockResearchStore();

  const graph = createStockResearchGraph({
    researchStore,
    investmentPolicy: "research.investment_committee",
    compliancePolicy: "research.compliance_review",
    resumeUrl: "https://example.com/webhooks/tryagent",
  });
  const config = {
    configurable: { thread_id: "thread-stock-nvda-client-42" },
  };

  const committeeInterruptResult = await graph.invoke(
    {
      ticker: "NVDA",
      runId: "thread-stock-nvda-client-42",
      clientId: "client_42",
    },
    config,
  );

  assert.equal(isInterrupted(committeeInterruptResult), true);
  const committeeInterrupt = committeeInterruptResult[INTERRUPT][0];
  assert.equal(
    committeeInterrupt.value.kind,
    "tryagent_investment_committee_review",
  );
  assert.equal(
    committeeInterrupt.value.policy,
    "research.investment_committee",
  );
  assert.equal(
    committeeInterrupt.value.tryagentInput.agentId,
    "portfolio-research-langgraph",
  );
  assert.equal(
    committeeInterrupt.value.tryagentInput.runId,
    "thread-stock-nvda-client-42",
  );
  assert.deepEqual(committeeInterrupt.value.tryagentInput.subject, {
    type: "stock_research",
    id: "NVDA",
    label: "Nvidia Corporation (NVDA) for client_42",
  });
  assert.equal(
    committeeInterrupt.value.tryagentInput.question,
    "Approve the proposed NVDA research stance before drafting a client memo?",
  );
  assert.deepEqual(
    committeeInterrupt.value.tryagentInput.choices.map((choice) => choice.id),
    ["approve_buy", "move_to_watchlist", "reject_thesis"],
  );
  assert.equal(
    committeeInterrupt.value.tryagentInput.resume.url,
    "https://example.com/webhooks/tryagent",
  );
  assert.match(
    committeeInterrupt.value.tryagentInput.metadata.thesisScore,
    /^\d+$/,
  );

  const complianceInterruptResult = await graph.invoke(
    new Command({
      resume: {
        escalationId: "esc_committee_123",
        decision: "move_to_watchlist",
        reviewedBy: "pm@example.com",
        notes: "Valuation risk is acceptable for watchlist, not a new buy.",
      },
    }),
    config,
  );

  assert.equal(isInterrupted(complianceInterruptResult), true);
  const complianceInterrupt = complianceInterruptResult[INTERRUPT][0];
  assert.equal(
    complianceInterrupt.value.kind,
    "tryagent_research_compliance_review",
  );
  assert.equal(
    complianceInterrupt.value.policy,
    "research.compliance_review",
  );
  assert.equal(
    complianceInterrupt.value.tryagentInput.agentId,
    "portfolio-research-langgraph",
  );
  assert.match(
    complianceInterrupt.value.draftMemo,
    /Nvidia Corporation \(NVDA\)/,
  );
  assert.match(
    complianceInterrupt.value.draftMemo,
    /Valuation risk is acceptable for watchlist/,
  );
  assert.deepEqual(
    complianceInterrupt.value.tryagentInput.choices.map((choice) => choice.id),
    ["publish_memo", "revise_memo", "block_publication"],
  );
  assert.match(
    complianceInterrupt.value.tryagentInput.evidence.join("\n"),
    /not personalized financial advice/i,
  );

  const completed = await graph.invoke(
    new Command({
      resume: {
        escalationId: "esc_compliance_456",
        action: "publish_memo",
      },
    }),
    config,
  );

  assert.equal(isInterrupted(completed), false);
  assert.equal(completed.status, "completed");
  assert.equal(completed.committeeEscalationId, "esc_committee_123");
  assert.equal(completed.complianceEscalationId, "esc_compliance_456");
  assert.equal(completed.committeeDecision, "move_to_watchlist");
  assert.match(completed.clientMemo, /watchlist/i);
  assert.match(completed.summary, /Nvidia Corporation \(NVDA\)/);
});

test("lower-risk stock research completes without a TryAgent escalation interrupt", async () => {
  const graph = createStockResearchGraph({
    researchStore: createStaticStockResearchStore(),
    investmentPolicy: "research.investment_committee",
    compliancePolicy: "research.compliance_review",
  });

  const result = await graph.invoke(
    {
      ticker: "MSFT",
      runId: "thread-stock-msft-client-42",
      clientId: "client_42",
    },
    {
      configurable: { thread_id: "thread-stock-msft-client-42" },
    },
  );

  assert.equal(isInterrupted(result), false);
  assert.equal(result.status, "completed");
  assert.equal(result.committeeEscalationId, undefined);
  assert.equal(result.complianceEscalationId, undefined);
  assert.match(result.clientMemo, /Microsoft Corporation \(MSFT\)/);
  assert.match(result.clientMemo, /balanced growth mandate/i);
});

test("TryAgent client factory defaults to the public production API", () => {
  const client = createTryAgentClientFromEnv({
    TRYAGENT_API_KEY: "ain_live_aik_test_secret",
  });

  assert.equal(client.baseUrl, DEFAULT_TRYAGENT_BASE_URL);
  assert.equal(DEFAULT_TRYAGENT_BASE_URL, "https://api.tryagent.ai");
});

test("CLI ticker parser tolerates pnpm argument separator", () => {
  assert.equal(parseTickerArg(["--", "nvda"]), "NVDA");
  assert.equal(parseTickerArg(["MSFT"]), "MSFT");
  assert.equal(parseTickerArg(["--", "  "]), undefined);
  assert.equal(parseTickerArg(["--"]), undefined);
});
