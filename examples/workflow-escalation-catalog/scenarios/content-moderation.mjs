const slug = "content-moderation";
const trigger = "Content is borderline toxic, scammy, or policy-ambiguous.";

export const scenario = {
  slug,
  name: "Content moderation",
  activity: "AI reviews user-generated posts",
  trigger,
  policy: "content.moderation.borderline-review.v1",
  escalation: {
    agentId: "content-moderation-agent",
    runId: "run-content-moderation-001",
    subject: "Borderline user post needs moderation decision",
    question:
      "Should this user-generated post be allowed, limited, or removed under the content policy?",
    evidence: [
      "Post contains borderline toxic language aimed at another user.",
      "Message includes a suspicious external link with urgent money-related claims.",
      "Policy classifier marked the content as ambiguous rather than clearly violating.",
    ],
    choices: [
      {
        id: "allow",
        label: "Allow post",
        consequence:
          "Publishes the post without restrictions and records the reviewer rationale.",
        reversible: true,
      },
      {
        id: "limit",
        label: "Limit distribution",
        consequence:
          "Keeps the post visible to the author but reduces reach while preserving an audit trail.",
        reversible: true,
      },
      {
        id: "remove",
        label: "Remove post",
        consequence:
          "Deletes the post from public surfaces and notifies the author about the moderation action.",
        reversible: true,
      },
    ],
    severity: "medium",
    metadata: {
      workflowSlug: slug,
      trigger,
      contentType: "user-post",
      reviewQueue: "trust-and-safety",
    },
  },
  decision: {
    choice: "limit",
    reason:
      "The post has scam and toxicity signals, but the evidence is ambiguous enough to limit distribution instead of removing it outright.",
  },
  expectedEvidence: /suspicious external link/i,
};
