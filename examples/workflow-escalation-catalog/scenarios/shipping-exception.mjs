const slug = "shipping-exception";
const trigger =
  "Package is late, damaged, or customer requests compensation.";

export const scenario = {
  slug,
  name: "Shipping exception",
  activity: "AI tracks an order shipment",
  trigger,
  policy: "shipping.exception.review.v1",
  escalation: {
    agentId: "shipping-tracking-agent",
    runId: "shipping-run-2026-06-25-ord-9304",
    subject: "Order ORD-9304 shipment exception needs compensation decision",
    question:
      "Should TryAgent refund shipping, send a replacement, or escalate to carrier claims for a delayed and damaged customer package?",
    evidence: [
      "Order ORD-9304 was promised by 2026-06-24 but the carrier scan shows delivery occurred on 2026-06-26.",
      "Customer uploaded photos showing the outer carton crushed and the product sleeve torn.",
      "Customer requested compensation because the order was intended for an event on 2026-06-25.",
      "Carrier tracking event CX-771 marks the shipment as delivered with visible damage noted at handoff.",
    ],
    choices: [
      {
        id: "refund-shipping",
        label: "Refund shipping",
        consequence:
          "Refunds the expedited shipping fee while keeping the delivered order active.",
        reversible: false,
      },
      {
        id: "send-replacement",
        label: "Send replacement",
        consequence:
          "Creates a replacement shipment and records the damaged delivery evidence for carrier recovery.",
        reversible: true,
      },
      {
        id: "open-carrier-claim",
        label: "Open carrier claim",
        consequence:
          "Holds customer compensation while operations validates photos and files a carrier claim.",
        reversible: true,
      },
    ],
    severity: "high",
    metadata: {
      workflowSlug: slug,
      trigger,
      orderId: "ORD-9304",
      carrierEventId: "CX-771",
      promisedDeliveryDate: "2026-06-24",
      actualDeliveryDate: "2026-06-26",
    },
  },
  decision: {
    choice: "send-replacement",
    reason:
      "The package was both late and visibly damaged, and the customer missed the event date, so replacing the order addresses the customer impact while preserving claim evidence.",
  },
  expectedEvidence: /Order ORD-9304 was promised by 2026-06-24 but the carrier scan shows delivery occurred on 2026-06-26\./,
};
