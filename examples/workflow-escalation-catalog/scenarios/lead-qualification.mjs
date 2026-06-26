const slug = "lead-qualification";
const trigger = "Lead looks high-value but has missing info.";

export const scenario = {
  slug,
  name: "Lead qualification",
  activity: "AI qualifies inbound sales leads",
  trigger,
  policy: "lead-qualification",
  escalation: {
    agentId: "sales-qualification-agent",
    runId: "run_lead_qualification_001",
    subject: "High-value inbound lead missing required qualification details",
    question:
      "Should the agent route this high-value inbound lead to sales now, request the missing details first, or mark it for nurture?",
    evidence: [
      "Lead LQ-8831: Form submission from Northstar BioSystems indicates 1,200 employees and projected annual spend above $250,000.",
      "Missing qualification fields: buying timeline, implementation owner, and confirmed budget authority were not provided.",
      "Engagement signal: Lead requested enterprise pricing and downloaded the security whitepaper within 10 minutes.",
    ],
    choices: [
      {
        id: "route-to-sales-now",
        label: "Route to sales now",
        consequence:
          "Create an urgent sales task despite incomplete qualification data so an account executive can follow up while intent is fresh.",
        reversible: true,
      },
      {
        id: "request-missing-details",
        label: "Request missing details",
        consequence:
          "Send a qualification email asking for timeline, owner, and budget authority before assigning the lead to sales.",
        reversible: true,
      },
      {
        id: "mark-for-nurture",
        label: "Mark for nurture",
        consequence:
          "Keep the lead out of the active sales queue and enroll it in a lower-priority nurture sequence.",
        reversible: true,
      },
    ],
    severity: "medium",
    metadata: {
      workflowSlug: slug,
      trigger,
      leadId: "LQ-8831",
      company: "Northstar BioSystems",
      projectedAnnualSpendUsd: 250000,
    },
  },
  decision: {
    choice: "route-to-sales-now",
    reason:
      "The lead has strong enterprise value and intent signals, so sales should follow up quickly while collecting the missing qualification details.",
  },
  expectedEvidence: /Lead LQ-8831: Form submission from Northstar BioSystems indicates 1,200 employees and projected annual spend above \$250,000\./,
};
