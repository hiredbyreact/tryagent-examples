import {
  Annotation,
  END,
  MemorySaver,
  START,
  StateGraph,
  interrupt,
} from "@langchain/langgraph";
import type { EscalateInput } from "@tryagent/sdk";
import { assessRefundRequest, draftRefundSummary } from "./refunds.js";
import type {
  CustomerMessageReviewResume,
  RefundApprovalGraphOptions,
  RefundApprovalState,
  RefundDecision,
  RefundDecisionResume,
  RefundRequest,
  TryAgentInterruptPayload,
} from "./types.js";

const RefundApprovalAnnotation = Annotation.Root({
  requestId: Annotation<string>(),
  runId: Annotation<string>(),
  request: Annotation<RefundRequest | undefined>(),
  decision: Annotation<RefundDecision | undefined>(),
  status: Annotation<RefundApprovalState["status"] | undefined>(),
  approvalEscalationId: Annotation<string | undefined>(),
  messageReviewEscalationId: Annotation<string | undefined>(),
  refundChoice: Annotation<RefundApprovalState["refundChoice"] | undefined>(),
  customerMessage: Annotation<string | undefined>(),
  summary: Annotation<string | undefined>(),
});

export function createRefundApprovalGraph(options: RefundApprovalGraphOptions) {
  const reviewThreshold = options.reviewThreshold ?? 70;
  const messageReviewPolicy =
    options.messageReviewPolicy ?? "support.refund_message_review";

  return new StateGraph(RefundApprovalAnnotation)
    .addNode("loadRefundRequest", async (state) => {
      return {
        request: await options.requestStore.getRequest(state.requestId),
      };
    })
    .addNode("assessRefundPolicy", async (state) => {
      const request = requireRequest(state);
      return {
        decision: assessRefundRequest(request, reviewThreshold),
      };
    })
    .addNode("requestHumanApproval", (state) => {
      const request = requireRequest(state);
      const decision = requireDecision(state);
      const approval = interrupt<
        TryAgentInterruptPayload,
        RefundDecisionResume
      >({
        kind: "tryagent_refund_decision",
        policy: options.policy,
        tryagentInput: buildRefundDecisionEscalation({
          request,
          decision,
          runId: state.runId,
          resumeUrl: options.resumeUrl,
        }),
      });

      return {
        status: "awaiting_human" as const,
        approvalEscalationId: approval.escalationId,
        refundChoice: approval.choice,
        summary: draftRefundSummary(request, decision),
      };
    })
    .addNode("reviewCustomerMessage", (state) => {
      const request = requireRequest(state);
      const decision = requireDecision(state);
      const refundChoice = requireRefundChoice(state);
      const draftMessage = draftCustomerMessage(request, refundChoice);
      const review = interrupt<
        TryAgentInterruptPayload,
        CustomerMessageReviewResume
      >({
        kind: "tryagent_customer_message_review",
        policy: messageReviewPolicy,
        draftMessage,
        tryagentInput: buildMessageReviewEscalation({
          request,
          decision,
          refundChoice,
          draftMessage,
          runId: state.runId,
          resumeUrl: options.resumeUrl,
        }),
      });

      const customerMessage =
        review.action === "do_not_send" ? undefined : review.message ?? draftMessage;

      return {
        status: "completed" as const,
        messageReviewEscalationId: review.escalationId,
        customerMessage,
        summary: [
          draftRefundSummary(request, decision),
          `Human decision: ${refundChoice}.`,
          customerMessage
            ? `Customer message: ${customerMessage}`
            : "Customer message: not sent.",
        ].join("\n"),
      };
    })
    .addNode("finishRefundDecision", async (state) => {
      const request = requireRequest(state);
      const decision = requireDecision(state);

      return {
        status: "completed" as const,
        summary: draftRefundSummary(request, decision),
      };
    })
    .addEdge(START, "loadRefundRequest")
    .addEdge("loadRefundRequest", "assessRefundPolicy")
    .addConditionalEdges(
      "assessRefundPolicy",
      (state) =>
        state.decision?.requiresHumanReview
          ? "requestHumanApproval"
          : "finishRefundDecision",
      {
        requestHumanApproval: "requestHumanApproval",
        finishRefundDecision: "finishRefundDecision",
      },
    )
    .addEdge("requestHumanApproval", "reviewCustomerMessage")
    .addEdge("reviewCustomerMessage", END)
    .addEdge("finishRefundDecision", END)
    .compile({ checkpointer: new MemorySaver() });
}

function buildRefundDecisionEscalation({
  request,
  decision,
  runId,
  resumeUrl,
}: {
  request: RefundRequest;
  decision: RefundDecision;
  runId: string;
  resumeUrl?: string;
}): EscalateInput {
  return {
    agentId: "support-refund-langgraph",
    runId,
    subject: {
      type: "refund_request",
      id: request.id,
      label: `Refund request ${request.id} for Order #${request.orderId}`,
    },
    question: `Approve a ${formatUsd(request.amountUsd)} refund for Order #${request.orderId}?`,
    evidence: decision.evidence,
    choices: [
      {
        id: "approve_refund",
        label: "Approve refund",
        consequence: "Issue the refund and notify the customer.",
        reversible: false,
      },
      {
        id: "offer_store_credit",
        label: "Offer store credit",
        consequence: "Send the customer a store credit offer instead of a cash refund.",
        reversible: true,
      },
      {
        id: "deny_refund",
        label: "Deny refund",
        consequence: "Close the request with a policy-based denial.",
        reversible: true,
      },
    ],
    ...(resumeUrl ? { resume: { mode: "webhook", url: resumeUrl } } : {}),
    metadata: {
      refundAmountUsd: request.amountUsd,
      customerTier: request.customerTier,
      riskScore: decision.score,
      riskLevel: decision.level,
      generatedBy: "examples/customer-refund-approval",
    },
  };
}

function buildMessageReviewEscalation({
  request,
  decision,
  refundChoice,
  draftMessage,
  runId,
  resumeUrl,
}: {
  request: RefundRequest;
  decision: RefundDecision;
  refundChoice: NonNullable<RefundApprovalState["refundChoice"]>;
  draftMessage: string;
  runId: string;
  resumeUrl?: string;
}): EscalateInput {
  return {
    agentId: "support-refund-langgraph",
    runId,
    subject: {
      type: "customer_message",
      id: `${request.id}:message`,
      label: `Customer message for Order #${request.orderId}`,
    },
    question: `Send this customer message for Order #${request.orderId}?`,
    evidence: [
      `Refund decision: ${refundChoice}.`,
      `Risk score: ${decision.score}/100 (${decision.level}).`,
      `Draft message: ${draftMessage}`,
    ],
    choices: [
      {
        id: "send_message",
        label: "Send message",
        consequence: "Send the drafted response to the customer.",
        reversible: false,
      },
      {
        id: "edit_message",
        label: "Edit message",
        consequence: "Resume the workflow with edited customer-facing copy.",
        reversible: true,
      },
      {
        id: "do_not_send",
        label: "Do not send",
        consequence: "Complete the workflow without customer notification.",
        reversible: true,
      },
    ],
    ...(resumeUrl ? { resume: { mode: "webhook", url: resumeUrl } } : {}),
    metadata: {
      refundRequestId: request.id,
      refundChoice,
      generatedBy: "examples/customer-refund-approval",
    },
  };
}

function draftCustomerMessage(
  request: RefundRequest,
  refundChoice: NonNullable<RefundApprovalState["refundChoice"]>,
): string {
  if (refundChoice === "approve_refund") {
    return `Hi ${request.customerName}, your ${formatUsd(request.amountUsd)} refund for Order #${request.orderId} has been approved. The funds should return to your original payment method shortly.`;
  }

  if (refundChoice === "offer_store_credit") {
    return `Hi ${request.customerName}, we reviewed Order #${request.orderId}. We cannot issue a cash refund under the policy, but we can offer store credit for ${formatUsd(request.amountUsd)}.`;
  }

  return `Hi ${request.customerName}, we reviewed Order #${request.orderId} and cannot approve this refund request under the current policy.`;
}

function requireRequest(state: RefundApprovalState): RefundRequest {
  if (!state.request) {
    throw new Error("Refund request is missing from graph state");
  }

  return state.request;
}

function requireDecision(state: RefundApprovalState): RefundDecision {
  if (!state.decision) {
    throw new Error("Refund decision is missing from graph state");
  }

  return state.decision;
}

function requireRefundChoice(
  state: RefundApprovalState,
): NonNullable<RefundApprovalState["refundChoice"]> {
  if (!state.refundChoice) {
    throw new Error("Refund choice is missing from graph state");
  }

  return state.refundChoice;
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}
