const slug = "account-risk-review";
const trigger = "User has suspicious behavior but not enough certainty to block.";

export const scenario = {
  slug,
  name: "Account risk review",
  activity: "AI monitors signups or user activity",
  trigger,
  policy: "account.risk.review.v1",
  escalation: {
    agentId: "account-risk-agent",
    runId: "account-risk-run-2026-06-25-user-7429",
    subject: "Account USER-7429 needs risk review before enforcement",
    question:
      "Should TryAgent allow, restrict, or suspend this account while the suspicious activity remains below the automatic block threshold?",
    evidence: [
      "User USER-7429 created three workspaces from the same device fingerprint within 12 minutes.",
      "Login telemetry shows a new country, new ASN, and failed password reset attempts before signup completion.",
      "Risk score is 71 out of 100, below the automatic block threshold of 85 but above the manual review threshold of 65.",
      "No confirmed chargeback, abuse report, or policy violation has been linked to the account yet.",
    ],
    choices: [
      {
        id: "allow-with-monitoring",
        label: "Allow with monitoring",
        consequence:
          "Keeps the account active while adding enhanced risk monitoring and audit notes for future activity.",
        reversible: true,
      },
      {
        id: "restrict-sensitive-actions",
        label: "Restrict sensitive actions",
        consequence:
          "Temporarily blocks workspace invites, billing changes, and API key creation until trust and safety reviews the account.",
        reversible: true,
      },
      {
        id: "suspend-account",
        label: "Suspend account",
        consequence:
          "Disables account access immediately and requires a support appeal before the user can resume activity.",
        reversible: true,
      },
    ],
    severity: "high",
    metadata: {
      workflowSlug: slug,
      trigger,
      userId: "USER-7429",
      riskScore: 71,
      automaticBlockThreshold: 85,
      reviewQueue: "trust-and-safety",
    },
  },
  decision: {
    choice: "restrict-sensitive-actions",
    reason:
      "The account has multiple suspicious signup and login signals, but no confirmed abuse, so temporary restrictions preserve safety without fully blocking the user.",
  },
  expectedEvidence: /Risk score is 71 out of 100, below the automatic block threshold of 85/i,
};
