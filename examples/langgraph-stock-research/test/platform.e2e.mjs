import assert from "node:assert/strict";
import test from "node:test";
import { Command, INTERRUPT, isInterrupted } from "@langchain/langgraph";
import {
  createStaticStockResearchStore,
  createStockResearchGraph,
  createTryAgentClientFromEnv,
} from "../dist/index.js";
import { startMockTryAgentPlatform } from "../../test-support/mock-tryagent-platform.mjs";

test("stock research example completes through the TryAgent platform lifecycle", async (t) => {
  const platform = await startMockTryAgentPlatform();
  t.after(() => platform.close());

  const tryagent = createTryAgentClientFromEnv({
    TRYAGENT_API_KEY: platform.apiKey,
    TRYAGENT_BASE_URL: platform.baseUrl,
  });
  const graph = createStockResearchGraph({
    researchStore: createStaticStockResearchStore(),
    investmentPolicy: "research.investment_committee",
    compliancePolicy: "research.compliance_review",
    resumeUrl: "https://example.com/webhooks/tryagent",
  });
  const config = {
    configurable: { thread_id: "thread-stock-platform-e2e" },
  };

  const committeeInterruptResult = await graph.invoke(
    {
      ticker: "NVDA",
      runId: "thread-stock-platform-e2e",
      clientId: "client_42",
    },
    config,
  );

  assert.equal(isInterrupted(committeeInterruptResult), true);
  const committeePayload = committeeInterruptResult[INTERRUPT][0].value;
  const committeeEscalation = await tryagent.escalate(
    committeePayload.policy,
    committeePayload.tryagentInput,
  );

  assert.equal(committeeEscalation.status, "open");
  assert.equal(committeeEscalation.policy, "research.investment_committee");
  assert.equal(committeeEscalation.agentId, "portfolio-research-langgraph");
  assert.deepEqual(committeeEscalation.metadata, {
    ticker: "NVDA",
    clientId: "client_42",
    thesisScore: "95",
    thesisLevel: "high",
    generatedBy: "examples/langgraph-stock-research",
  });

  const acknowledged = await tryagent.escalations.acknowledge(
    committeeEscalation.id,
  );
  assert.equal(acknowledged.status, "acknowledged");

  const committeeDecision = await tryagent.escalations.decide(
    committeeEscalation.id,
    {
      choice: "move_to_watchlist",
      reason: "Valuation risk is acceptable for watchlist, not a new buy.",
    },
  );
  assert.equal(committeeDecision.status, "resolved");

  const complianceInterruptResult = await graph.invoke(
    new Command({
      resume: {
        escalationId: committeeDecision.id,
        decision: committeeDecision.decision.choice,
        reviewedBy: "pm@example.com",
        notes: committeeDecision.decision.reason,
      },
    }),
    config,
  );

  assert.equal(isInterrupted(complianceInterruptResult), true);
  const compliancePayload = complianceInterruptResult[INTERRUPT][0].value;
  const complianceEscalation = await tryagent.escalate(
    compliancePayload.policy,
    compliancePayload.tryagentInput,
  );
  assert.equal(complianceEscalation.policy, "research.compliance_review");
  assert.match(compliancePayload.draftMemo, /Nvidia Corporation \(NVDA\)/);

  const openEscalations = await tryagent.escalations.list({ status: "open" });
  assert.deepEqual(
    openEscalations.map((escalation) => escalation.id),
    [complianceEscalation.id],
  );
  assert.equal(
    (await tryagent.escalations.get(complianceEscalation.id)).question,
    "Approve this NVDA client memo for publication?",
  );

  const complianceDecision = await tryagent.escalations.decide(
    complianceEscalation.id,
    {
      choice: "publish_memo",
      reason: "Memo contains the required compliance language.",
    },
  );
  assert.equal(complianceDecision.status, "resolved");

  const completed = await graph.invoke(
    new Command({
      resume: {
        escalationId: complianceDecision.id,
        action: complianceDecision.decision.choice,
        memo: compliancePayload.draftMemo,
      },
    }),
    config,
  );

  assert.equal(isInterrupted(completed), false);
  assert.equal(completed.status, "completed");
  assert.equal(completed.committeeEscalationId, committeeEscalation.id);
  assert.equal(completed.complianceEscalationId, complianceEscalation.id);
  assert.equal(completed.committeeDecision, "move_to_watchlist");
  assert.equal(completed.complianceAction, "publish_memo");
  assert.match(completed.clientMemo, /watchlist/i);
  assert.deepEqual(
    platform.requests
      .filter((request) => request.method === "POST" && request.path === "/escalations")
      .map((request) => request.body.policy),
    ["research.investment_committee", "research.compliance_review"],
  );
});
