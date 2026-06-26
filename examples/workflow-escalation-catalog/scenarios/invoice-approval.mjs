const slug = "invoice-approval";
const trigger = "Amount is above budget, vendor is unknown, or PO is missing.";

export const scenario = {
  slug,
  name: "Invoice approval",
  activity: "AI reviews an invoice before payment",
  trigger,
  policy: "finance.invoice.approval.v1",
  escalation: {
    agentId: "invoice-review-agent",
    runId: "invoice-run-2026-06-25-acme-4187",
    subject: "Invoice INV-4187 requires approval before payment",
    question:
      "Should TryAgent approve payment for a $18,450 invoice from Northstar Analytics without a matching purchase order?",
    evidence: [
      "Invoice INV-4187 is for $18,450, which is $3,450 above the approved analytics budget.",
      "Vendor Northstar Analytics is not found in the approved vendor registry.",
      "No purchase order number was provided on the invoice or in the intake record.",
      "Payment terms are net 15 and the due date is 2026-07-10.",
    ],
    choices: [
      {
        id: "approve-payment",
        label: "Approve payment",
        consequence:
          "Payment can be scheduled immediately despite the budget, vendor, and PO exceptions.",
        reversible: false,
      },
      {
        id: "request-finance-review",
        label: "Request finance review",
        consequence:
          "Payment remains on hold while finance validates the vendor, budget owner, and missing PO.",
        reversible: true,
      },
      {
        id: "reject-invoice",
        label: "Reject invoice",
        consequence:
          "The invoice is returned to the requester and vendor until a valid PO or approval path is provided.",
        reversible: true,
      },
    ],
    severity: "high",
    metadata: {
      workflowSlug: slug,
      trigger,
      invoiceId: "INV-4187",
      vendorName: "Northstar Analytics",
      amountUsd: 18450,
    },
  },
  decision: {
    choice: "request-finance-review",
    reason:
      "Finance should validate the unknown vendor and missing PO before approving an over-budget payment.",
    response: {
      nextAction:
        "Hold payment and route the invoice to finance with the budget variance, vendor status, and missing PO evidence.",
    },
  },
  expectedEvidence: /above the approved analytics budget|not found in the approved vendor registry|No purchase order/i,
};
