import type { EscalateInput } from "@tryagent/sdk";

export type RefundRequest = {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  customerTier: "standard" | "pro" | "enterprise";
  amountUsd: number;
  reason: string;
  daysSincePurchase: number;
  priorRefundCount: number;
  policyWindowDays: number;
  deliveryStatus: "delivered" | "late" | "lost" | "returned";
  fraudSignals: string[];
};

export type RefundDecision = {
  score: number;
  level: "low" | "medium" | "high";
  recommendation: "approve_refund" | "offer_store_credit" | "deny_refund";
  requiresHumanReview: boolean;
  evidence: string[];
};

export type RefundApprovalState = {
  requestId: string;
  runId: string;
  request?: RefundRequest;
  decision?: RefundDecision;
  status?: "completed" | "awaiting_human";
  approvalEscalationId?: string;
  messageReviewEscalationId?: string;
  refundChoice?: RefundChoice;
  customerMessage?: string;
  summary?: string;
};

export type RefundRequestStore = {
  getRequest(requestId: string): Promise<RefundRequest>;
};

export type RefundChoice =
  | "approve_refund"
  | "offer_store_credit"
  | "deny_refund";

export type MessageReviewAction =
  | "send_message"
  | "edit_message"
  | "do_not_send";

export type RefundDecisionResume = {
  escalationId: string;
  choice: RefundChoice;
  answeredBy?: string;
};

export type CustomerMessageReviewResume = {
  escalationId: string;
  action: MessageReviewAction;
  message?: string;
};

export type TryAgentInterruptPayload = {
  kind: "tryagent_refund_decision" | "tryagent_customer_message_review";
  policy: string;
  tryagentInput: EscalateInput;
  draftMessage?: string;
};

export type RefundApprovalGraphOptions = {
  requestStore: RefundRequestStore;
  policy: string;
  messageReviewPolicy?: string;
  resumeUrl?: string;
  reviewThreshold?: number;
};
