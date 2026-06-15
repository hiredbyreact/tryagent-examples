import assert from "node:assert/strict";
import test from "node:test";
import { Command, INTERRUPT, isInterrupted } from "@langchain/langgraph";
import {
  DEFAULT_TRYAGENT_BASE_URL,
  createRefundApprovalGraph,
  createStaticRefundRequestStore,
  createTryAgentClientFromEnv,
} from "../dist/index.js";
import { parseRequestIdArg } from "../dist/cli-args.js";

test("high-risk refund request pauses with two LangGraph interrupts", async () => {
  const requestStore = createStaticRefundRequestStore();

  const graph = createRefundApprovalGraph({
    requestStore,
    policy: "support.refund_approval",
    messageReviewPolicy: "support.refund_message_review",
    resumeUrl: "https://example.com/webhooks/tryagent",
  });
  const config = {
    configurable: { thread_id: "thread-refund-high-value-late" },
  };

  const decisionInterruptResult = await graph.invoke(
    {
      requestId: "refund_high_value_late",
      runId: "thread-refund-high-value-late",
    },
    config,
  );

  assert.equal(isInterrupted(decisionInterruptResult), true);
  const decisionInterrupt = decisionInterruptResult[INTERRUPT][0];
  assert.equal(decisionInterrupt.value.kind, "tryagent_refund_decision");
  assert.equal(decisionInterrupt.value.policy, "support.refund_approval");
  assert.equal(decisionInterrupt.value.tryagentInput.agentId, "support-refund-langgraph");
  assert.equal(decisionInterrupt.value.tryagentInput.runId, "thread-refund-high-value-late");
  assert.deepEqual(decisionInterrupt.value.tryagentInput.subject, {
    type: "refund_request",
    id: "refund_high_value_late",
    label: "Refund request refund_high_value_late for Order #A1009",
  });
  assert.equal(
    decisionInterrupt.value.tryagentInput.question,
    "Approve a $429.00 refund for Order #A1009?",
  );
  assert.deepEqual(
    decisionInterrupt.value.tryagentInput.choices.map((choice) => choice.id),
    ["approve_refund", "offer_store_credit", "deny_refund"],
  );
  assert.equal(
    decisionInterrupt.value.tryagentInput.resume.url,
    "https://example.com/webhooks/tryagent",
  );

  const messageInterruptResult = await graph.invoke(
    new Command({
      resume: {
        escalationId: "esc_refund_123",
        choice: "approve_refund",
        answeredBy: "support-ops@example.com",
      },
    }),
    config,
  );

  assert.equal(isInterrupted(messageInterruptResult), true);
  const messageInterrupt = messageInterruptResult[INTERRUPT][0];
  assert.equal(messageInterrupt.value.kind, "tryagent_customer_message_review");
  assert.equal(messageInterrupt.value.policy, "support.refund_message_review");
  assert.equal(messageInterrupt.value.tryagentInput.agentId, "support-refund-langgraph");
  assert.equal(messageInterrupt.value.tryagentInput.runId, "thread-refund-high-value-late");
  assert.match(messageInterrupt.value.draftMessage, /refund .* has been approved/);
  assert.deepEqual(
    messageInterrupt.value.tryagentInput.choices.map((choice) => choice.id),
    ["send_message", "edit_message", "do_not_send"],
  );

  const completed = await graph.invoke(
    new Command({
      resume: {
        escalationId: "esc_message_456",
        action: "send_message",
        message:
          "Your refund has been approved. The funds should return to your original payment method shortly.",
      },
    }),
    config,
  );

  assert.equal(isInterrupted(completed), false);
  assert.equal(completed.status, "completed");
  assert.equal(completed.approvalEscalationId, "esc_refund_123");
  assert.equal(completed.messageReviewEscalationId, "esc_message_456");
  assert.equal(completed.refundChoice, "approve_refund");
  assert.match(completed.customerMessage, /refund has been approved/);
  assert.match(completed.summary, /Order #A1009/);
});

test("low-risk refund request completes without a TryAgent escalation interrupt", async () => {
  const requestStore = createStaticRefundRequestStore();

  const graph = createRefundApprovalGraph({
    requestStore,
    policy: "support.refund_approval",
  });

  const result = await graph.invoke(
    {
      requestId: "refund_low_value_duplicate_shipping",
      runId: "thread-refund-low-value",
    },
    {
      configurable: { thread_id: "thread-refund-low-value" },
    },
  );

  assert.equal(isInterrupted(result), false);
  assert.equal(result.status, "completed");
  assert.equal(result.approvalEscalationId, undefined);
  assert.match(result.summary, /Auto-approved/);
  assert.match(result.summary, /\$24\.99/);
});

test("TryAgent client factory defaults to the public production API", () => {
  const client = createTryAgentClientFromEnv({
    TRYAGENT_API_KEY: "ain_live_aik_test_secret",
  });

  assert.equal(client.baseUrl, DEFAULT_TRYAGENT_BASE_URL);
  assert.equal(DEFAULT_TRYAGENT_BASE_URL, "https://api.tryagent.ai");
});

test("CLI request parser tolerates pnpm argument separator", () => {
  assert.equal(parseRequestIdArg(["--", "refund_high_value_late"]), "refund_high_value_late");
  assert.equal(parseRequestIdArg(["refund_low_value_duplicate_shipping"]), "refund_low_value_duplicate_shipping");
  assert.equal(parseRequestIdArg(["--", "  "]), undefined);
  assert.equal(parseRequestIdArg(["--"]), undefined);
});
