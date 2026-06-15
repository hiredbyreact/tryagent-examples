import type { RefundDecision, RefundRequest } from "./types.js";

const SAMPLE_REQUESTS: Record<string, RefundRequest> = {
  refund_low_value_duplicate_shipping: {
    id: "refund_low_value_duplicate_shipping",
    orderId: "A1001",
    customerId: "cus_1042",
    customerName: "Maya Chen",
    customerTier: "pro",
    amountUsd: 24.99,
    reason: "Customer was charged twice for shipping.",
    daysSincePurchase: 9,
    priorRefundCount: 0,
    policyWindowDays: 30,
    deliveryStatus: "delivered",
    fraudSignals: [],
  },
  refund_high_value_late: {
    id: "refund_high_value_late",
    orderId: "A1009",
    customerId: "cus_8871",
    customerName: "Jordan Patel",
    customerTier: "enterprise",
    amountUsd: 429,
    reason: "Customer requests a full refund after a late replacement shipment.",
    daysSincePurchase: 47,
    priorRefundCount: 2,
    policyWindowDays: 30,
    deliveryStatus: "late",
    fraudSignals: ["Multiple refunds on adjacent orders"],
  },
  refund_lost_package: {
    id: "refund_lost_package",
    orderId: "A1017",
    customerId: "cus_2208",
    customerName: "Avery Williams",
    customerTier: "standard",
    amountUsd: 119.5,
    reason: "Carrier marked the package lost after warehouse handoff.",
    daysSincePurchase: 18,
    priorRefundCount: 0,
    policyWindowDays: 30,
    deliveryStatus: "lost",
    fraudSignals: [],
  },
};

export function createStaticRefundRequestStore(
  overrides: Record<string, RefundRequest> = {},
) {
  const requests = { ...SAMPLE_REQUESTS, ...normalizeOverrides(overrides) };

  return {
    async getRequest(requestId: string): Promise<RefundRequest> {
      const normalizedId = normalizeRequestId(requestId);
      const request = requests[normalizedId];
      if (!request) {
        throw new Error(`Unknown refund request: ${requestId}`);
      }

      return request;
    },
  };
}

export function assessRefundRequest(
  request: RefundRequest,
  reviewThreshold: number,
): RefundDecision {
  const evidence: string[] = [];
  let score = 0;

  if (request.amountUsd >= 250) {
    score += 35;
    evidence.push(`Refund amount is ${formatUsd(request.amountUsd)}, above the $250 review threshold.`);
  } else {
    evidence.push(`Refund amount is ${formatUsd(request.amountUsd)}, below the $250 review threshold.`);
  }

  if (request.daysSincePurchase > request.policyWindowDays) {
    score += 25;
    evidence.push(
      `Request is ${request.daysSincePurchase} days after purchase, outside the ${request.policyWindowDays}-day policy window.`,
    );
  } else {
    evidence.push(
      `Request is ${request.daysSincePurchase} days after purchase, inside the ${request.policyWindowDays}-day policy window.`,
    );
  }

  if (request.priorRefundCount >= 2) {
    score += 20;
    evidence.push(`Customer has ${request.priorRefundCount} prior refunds, which requires support ops review.`);
  } else {
    evidence.push(`Customer has ${request.priorRefundCount} prior refunds.`);
  }

  if (request.deliveryStatus === "lost") {
    score -= 15;
    evidence.push("Carrier marked the package lost, which supports an automatic refund.");
  } else if (request.deliveryStatus === "late") {
    score += 10;
    evidence.push("Shipment was late, so a full refund may exceed policy without reviewer approval.");
  } else {
    evidence.push(`Delivery status is ${request.deliveryStatus}.`);
  }

  if (request.fraudSignals.length > 0) {
    score += 25;
    evidence.push(`Fraud signal: ${request.fraudSignals[0]}.`);
  } else {
    evidence.push("No fraud signals were found.");
  }

  score = Math.max(0, Math.min(100, score));
  const level = score >= 70 ? "high" : score >= 40 ? "medium" : "low";
  const recommendation =
    level === "low"
      ? "approve_refund"
      : level === "medium"
        ? "offer_store_credit"
        : "offer_store_credit";

  return {
    score,
    level,
    recommendation,
    requiresHumanReview: score >= reviewThreshold,
    evidence: [`Risk score: ${score}/100 (${level}).`, ...evidence],
  };
}

export function draftRefundSummary(
  request: RefundRequest,
  decision: RefundDecision,
): string {
  const outcome =
    decision.requiresHumanReview
      ? "Needs human approval"
      : decision.recommendation === "approve_refund"
        ? "Auto-approved"
        : "Auto-resolved";

  return [
    `${outcome}: ${formatUsd(request.amountUsd)} refund for Order #${request.orderId}`,
    `Customer: ${request.customerName} (${request.customerTier})`,
    `Reason: ${request.reason}`,
    `Recommendation: ${decision.recommendation}`,
    `Risk: ${decision.level} (${decision.score}/100)`,
    ...decision.evidence,
  ].join("\n");
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function normalizeRequestId(requestId: string): string {
  return requestId.trim().toLowerCase();
}

function normalizeOverrides(
  overrides: Record<string, RefundRequest>,
): Record<string, RefundRequest> {
  return Object.fromEntries(
    Object.entries(overrides).map(([requestId, request]) => [
      normalizeRequestId(requestId),
      { ...request, id: normalizeRequestId(request.id) },
    ]),
  );
}
