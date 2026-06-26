const slug = "customer-support-policy-exception";
const trigger = "Customer asks for something outside policy.";

export const scenario = {
  slug,
  name: "Customer support policy exception",
  activity: "AI answers support tickets",
  trigger,
  policy: "support-policy-exception",
  escalation: {
    agentId: "support-ticket-agent",
    runId: "run_support_policy_exception_001",
    subject: "Customer requests courtesy refund outside policy",
    question:
      "Should the agent make a one-time policy exception for a customer requesting a refund after the standard eligibility window?",
    evidence: [
      "Ticket SUP-1042: Customer asks for a refund 18 days after the 30-day return window closed.",
      "Policy excerpt: Support agents may not approve refunds outside the return window without manager approval.",
      "Customer context: Account has 4 years of tenure, no previous courtesy exceptions, and active annual subscription renewal next month.",
    ],
    choices: [
      {
        id: "approve-one-time-exception",
        label: "Approve one-time exception",
        consequence:
          "Issue a courtesy refund and record that the customer has used their one-time exception.",
        reversible: false,
      },
      {
        id: "deny-and-explain-policy",
        label: "Deny and explain policy",
        consequence:
          "Send a policy-based denial with alternative retention options such as account credit or setup assistance.",
        reversible: true,
      },
      {
        id: "offer-account-credit",
        label: "Offer account credit",
        consequence:
          "Decline the refund but apply a limited account credit for the next billing period.",
        reversible: true,
      },
    ],
    severity: "medium",
    metadata: {
      workflowSlug: slug,
      trigger,
      ticketId: "SUP-1042",
      requestedAmountUsd: 149,
    },
  },
  decision: {
    choice: "offer-account-credit",
    reason:
      "The request is outside refund policy, but customer history supports a reversible retention gesture that avoids setting a refund precedent.",
  },
  expectedEvidence: /Ticket SUP-1042: Customer asks for a refund 18 days after the 30-day return window closed\./,
};
