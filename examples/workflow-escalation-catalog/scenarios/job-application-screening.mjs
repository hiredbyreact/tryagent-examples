const slug = "job-application-screening";
const trigger =
  "Candidate is close to meeting requirements but not obvious.";

export const scenario = {
  slug,
  name: "Job application screening",
  activity: "AI screens candidates",
  trigger,
  policy: "job-application-screening",
  escalation: {
    agentId: "recruiting-screening-agent",
    runId: "run_job_application_screening_001",
    subject: "Candidate is near the hiring bar for product engineer role",
    question:
      "Should the agent advance this candidate, request a recruiter review, or reject the application based on the mixed screening evidence?",
    evidence: [
      "Application APP-7264: Candidate has 4 years of product engineering experience against a 5-year target.",
      "Resume evidence: Candidate has shipped React and TypeScript features, but does not list production NestJS ownership.",
      "Screening note: Portfolio includes relevant startup work and strong customer-facing project examples.",
      "Requirement gap: Role asks for prior ownership of PostgreSQL-backed services and on-call production support.",
    ],
    choices: [
      {
        id: "advance-to-interview",
        label: "Advance to interview",
        consequence:
          "Move the candidate into the interview pipeline despite the experience and backend ownership gaps.",
        reversible: true,
      },
      {
        id: "request-recruiter-review",
        label: "Request recruiter review",
        consequence:
          "Pause automated screening while a recruiter evaluates whether the adjacent experience satisfies the role requirements.",
        reversible: true,
      },
      {
        id: "reject-application",
        label: "Reject application",
        consequence:
          "Send the candidate a rejection and close the application for this role.",
        reversible: false,
      },
    ],
    severity: "medium",
    metadata: {
      workflowSlug: slug,
      trigger,
      applicationId: "APP-7264",
      role: "Product Engineer",
      candidateExperienceYears: 4,
      targetExperienceYears: 5,
    },
  },
  decision: {
    choice: "request-recruiter-review",
    reason:
      "The candidate is close to the stated requirements and has relevant product engineering evidence, but the backend ownership gap needs human review before advancing or rejecting.",
  },
  expectedEvidence: /Candidate has 4 years of product engineering experience against a 5-year target/i,
};
