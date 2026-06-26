const slug = "contract-clause-review";
const trigger =
  "Contract contains non-standard payment, termination, or liability terms.";

export const scenario = {
  slug,
  name: "Contract clause review",
  activity: "AI reviews a simple contract",
  trigger,
  policy: "legal.contract-clause-review.v1",
  escalation: {
    agentId: "contract-review-agent",
    runId: "contract-run-2026-06-25-supply-2074",
    subject: "Service agreement contains non-standard commercial terms",
    question:
      "Should TryAgent approve this service agreement, request legal review, or reject the non-standard clauses before signature?",
    evidence: [
      "Contract CTR-2074 changes payment terms from standard net 30 to net 7 with late fees after 3 days.",
      "Termination clause requires 90 days notice instead of the standard 30 days notice.",
      "Liability clause removes the usual cap and makes the customer responsible for indirect damages.",
      "Counterparty is requesting signature by 2026-07-01 for a $42,000 annual services agreement.",
    ],
    choices: [
      {
        id: "approve-contract",
        label: "Approve contract",
        consequence:
          "The agreement can proceed to signature with non-standard payment, termination, and liability terms accepted.",
        reversible: false,
      },
      {
        id: "request-legal-review",
        label: "Request legal review",
        consequence:
          "Signature remains blocked while legal reviews the payment, termination, and liability exceptions.",
        reversible: true,
      },
      {
        id: "request-standard-terms",
        label: "Request standard terms",
        consequence:
          "The counterparty receives a redline restoring standard net 30 payment, 30-day termination, and capped liability terms.",
        reversible: true,
      },
    ],
    severity: "high",
    metadata: {
      workflowSlug: slug,
      trigger,
      contractId: "CTR-2074",
      counterparty: "Summit Supply Co.",
      annualValueUsd: 42000,
    },
  },
  decision: {
    choice: "request-legal-review",
    reason:
      "Legal should review the uncapped liability and accelerated payment terms before anyone accepts the non-standard contract language.",
  },
  expectedEvidence: /Contract CTR-2074 changes payment terms from standard net 30 to net 7/i,
};
