import assert from "node:assert/strict";
import test from "node:test";
import { Command, INTERRUPT, isInterrupted } from "@langchain/langgraph";
import {
  createRefundApprovalGraph,
  createStaticRefundRequestStore,
  createTryAgentClientFromEnv,
} from "../dist/index.js";
import { startMockTryAgentPlatform } from "../../test-support/mock-tryagent-platform.mjs";

test("refund approval example completes through the TryAgent platform lifecycle", async (t) => {
  const platform = await startMockTryAgentPlatform();
  t.after(() => platform.close());

  const tryagent = createTryAgentClientFromEnv({
    TRYAGENT_API_KEY: platform.apiKey,
    TRYAGENT_BASE_URL: platform.baseUrl,
  });
  const graph = createRefundApprovalGraph({
    requestStore: createStaticRefundRequestStore(),
    policy: "support.refund_approval",
    messageReviewPolicy: "support.refund_message_review",
    resumeUrl: "https://example.com/webhooks/tryagent",
  });
  const config = {
    configurable: { thread_id: "thread-refund-platform-e2e" },
  };

  const decisionInterruptResult = await graph.invoke(
    {
      requestId: "refund_high_value_late",
      runId: "thread-refund-platform-e2e",
    },
    config,
  );

  assert.equal(isInterrupted(decisionInterruptResult), true);
  const decisionPayload = decisionInterruptResult[INTERRUPT][0].value;
  const approvalEscalation = await tryagent.escalate(
    decisionPayload.policy,
    decisionPayload.tryagentInput,
  );

  assert.equal(approvalEscalation.status, "open");
  assert.equal(approvalEscalation.policy, "support.refund_approval");
  assert.equal(approvalEscalation.agentId, "support-refund-langgraph");
  assert.equal(approvalEscalation.resume.secretConfigured, undefined);
  assert.deepEqual(approvalEscalation.metadata, {
    refundAmountUsd: 429,
    customerTier: "enterprise",
    riskScore: 100,
    riskLevel: "high",
    generatedBy: "examples/customer-refund-approval",
  });

  const openEscalations = await tryagent.escalations.list({ status: "open" });
  assert.deepEqual(
    openEscalations.map((escalation) => escalation.id),
    [approvalEscalation.id],
  );
  assert.equal(
    (await tryagent.escalations.get(approvalEscalation.id)).question,
    "Approve a $429.00 refund for Order #A1009?",
  );

  const acknowledged = await tryagent.escalations.acknowledge(
    approvalEscalation.id,
  );
  assert.equal(acknowledged.status, "acknowledged");

  const approved = await tryagent.escalations.decide(approvalEscalation.id, {
    choice: "approve_refund",
    reason: "Customer history and delivery delay justify the refund.",
  });
  assert.equal(approved.status, "resolved");
  assert.equal(approved.decision.choice, "approve_refund");

  const messageInterruptResult = await graph.invoke(
    new Command({
      resume: {
        escalationId: approved.id,
        choice: approved.decision.choice,
        answeredBy: "ops@example.com",
      },
    }),
    config,
  );

  assert.equal(isInterrupted(messageInterruptResult), true);
  const messagePayload = messageInterruptResult[INTERRUPT][0].value;
  const messageEscalation = await tryagent.escalate(
    messagePayload.policy,
    messagePayload.tryagentInput,
  );
  assert.equal(messageEscalation.policy, "support.refund_message_review");
  assert.match(messagePayload.draftMessage, /refund .* has been approved/);

  const messageDecision = await tryagent.escalations.decide(
    messageEscalation.id,
    {
      choice: "send_message",
      reason: "Customer-facing copy is accurate.",
    },
  );
  assert.equal(messageDecision.status, "resolved");

  const completed = await graph.invoke(
    new Command({
      resume: {
        escalationId: messageDecision.id,
        action: messageDecision.decision.choice,
        message: messagePayload.draftMessage,
      },
    }),
    config,
  );

  assert.equal(isInterrupted(completed), false);
  assert.equal(completed.status, "completed");
  assert.equal(completed.approvalEscalationId, approvalEscalation.id);
  assert.equal(completed.messageReviewEscalationId, messageEscalation.id);
  assert.equal(completed.refundChoice, "approve_refund");
  assert.match(completed.customerMessage, /refund .* has been approved/);
  assert.deepEqual(
    platform.requests
      .filter((request) => request.method === "POST" && request.path === "/escalations")
      .map((request) => request.body.policy),
    ["support.refund_approval", "support.refund_message_review"],
  );
});
