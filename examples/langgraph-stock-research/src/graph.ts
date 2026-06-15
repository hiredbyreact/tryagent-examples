import {
  Annotation,
  END,
  MemorySaver,
  START,
  StateGraph,
  interrupt,
} from "@langchain/langgraph";
import type { EscalateInput } from "@tryagent/sdk";
import {
  assessInvestmentThesis,
  draftClientMemo,
  draftCompletedSummary,
} from "./research.js";
import type {
  CommitteeDecision,
  ComplianceReviewResume,
  InvestmentCommitteeResume,
  InvestmentThesis,
  StockResearchGraphOptions,
  StockResearchSnapshot,
  StockResearchState,
  TryAgentStockResearchInterruptPayload,
} from "./types.js";

const StockResearchAnnotation = Annotation.Root({
  ticker: Annotation<string>(),
  runId: Annotation<string>(),
  clientId: Annotation<string>(),
  snapshot: Annotation<StockResearchSnapshot | undefined>(),
  thesis: Annotation<InvestmentThesis | undefined>(),
  status: Annotation<StockResearchState["status"] | undefined>(),
  committeeEscalationId: Annotation<string | undefined>(),
  complianceEscalationId: Annotation<string | undefined>(),
  committeeDecision: Annotation<CommitteeDecision | undefined>(),
  committeeNotes: Annotation<string | undefined>(),
  committeeReviewedBy: Annotation<string | undefined>(),
  complianceAction: Annotation<StockResearchState["complianceAction"] | undefined>(),
  clientMemo: Annotation<string | undefined>(),
  summary: Annotation<string | undefined>(),
});

export function createStockResearchGraph(options: StockResearchGraphOptions) {
  const reviewThreshold = options.reviewThreshold ?? 70;

  return new StateGraph(StockResearchAnnotation)
    .addNode("loadResearchSnapshot", async (state) => {
      return {
        snapshot: await options.researchStore.getSnapshot(
          state.ticker,
          state.clientId,
        ),
      };
    })
    .addNode("buildInvestmentThesis", (state) => {
      return {
        thesis: assessInvestmentThesis(requireSnapshot(state), reviewThreshold),
      };
    })
    .addNode("requestInvestmentCommitteeReview", (state) => {
      const snapshot = requireSnapshot(state);
      const thesis = requireThesis(state);
      const review = interrupt<
        TryAgentStockResearchInterruptPayload,
        InvestmentCommitteeResume
      >({
        kind: "tryagent_investment_committee_review",
        policy: options.investmentPolicy,
        tryagentInput: buildInvestmentCommitteeEscalation({
          snapshot,
          thesis,
          runId: state.runId,
          resumeUrl: options.resumeUrl,
        }),
      });

      return {
        status: "awaiting_human" as const,
        committeeEscalationId: review.escalationId,
        committeeDecision: review.decision,
        committeeNotes: review.notes,
        committeeReviewedBy: review.reviewedBy,
      };
    })
    .addNode("requestComplianceReview", (state) => {
      const snapshot = requireSnapshot(state);
      const thesis = requireThesis(state);
      const committeeDecision = requireCommitteeDecision(state);
      const draftMemo = draftClientMemo({
        snapshot,
        thesis,
        committeeDecision,
        committeeNotes: state.committeeNotes,
      });
      const review = interrupt<
        TryAgentStockResearchInterruptPayload,
        ComplianceReviewResume
      >({
        kind: "tryagent_research_compliance_review",
        policy: options.compliancePolicy,
        draftMemo,
        tryagentInput: buildComplianceEscalation({
          snapshot,
          thesis,
          committeeDecision,
          draftMemo,
          runId: state.runId,
          resumeUrl: options.resumeUrl,
        }),
      });

      const clientMemo =
        review.action === "block_publication"
          ? undefined
          : review.memo ?? draftMemo;

      return {
        status: "completed" as const,
        complianceEscalationId: review.escalationId,
        complianceAction: review.action,
        clientMemo,
        summary: draftCompletedSummary(snapshot, thesis, committeeDecision),
      };
    })
    .addNode("finishResearchMemo", (state) => {
      const snapshot = requireSnapshot(state);
      const thesis = requireThesis(state);
      const committeeDecision = thesis.stance;

      return {
        status: "completed" as const,
        committeeDecision,
        clientMemo: draftClientMemo({
          snapshot,
          thesis,
          committeeDecision,
        }),
        summary: draftCompletedSummary(snapshot, thesis),
      };
    })
    .addEdge(START, "loadResearchSnapshot")
    .addEdge("loadResearchSnapshot", "buildInvestmentThesis")
    .addConditionalEdges(
      "buildInvestmentThesis",
      (state) =>
        state.thesis?.requiresHumanReview
          ? "requestInvestmentCommitteeReview"
          : "finishResearchMemo",
      {
        requestInvestmentCommitteeReview: "requestInvestmentCommitteeReview",
        finishResearchMemo: "finishResearchMemo",
      },
    )
    .addEdge("requestInvestmentCommitteeReview", "requestComplianceReview")
    .addEdge("requestComplianceReview", END)
    .addEdge("finishResearchMemo", END)
    .compile({ checkpointer: new MemorySaver() });
}

function buildInvestmentCommitteeEscalation({
  snapshot,
  thesis,
  runId,
  resumeUrl,
}: {
  snapshot: StockResearchSnapshot;
  thesis: InvestmentThesis;
  runId: string;
  resumeUrl?: string;
}): EscalateInput {
  return {
    agentId: "portfolio-research-langgraph",
    runId,
    subject: {
      type: "stock_research",
      id: snapshot.ticker,
      label: `${snapshot.companyName} (${snapshot.ticker}) for ${snapshot.portfolio.clientId}`,
    },
    question: `Approve the proposed ${snapshot.ticker} research stance before drafting a client memo?`,
    evidence: [
      thesis.summary,
      ...thesis.evidence,
      `Mandate: ${snapshot.portfolio.mandate}.`,
      `Current sector exposure: ${snapshot.portfolio.currentSectorExposurePercent.toFixed(1)}%.`,
    ],
    choices: [
      {
        id: "approve_buy",
        label: "Approve buy thesis",
        consequence: "Draft a client memo that supports a new or increased position.",
        recommended: thesis.stance === "approve_buy",
        reversible: false,
      },
      {
        id: "move_to_watchlist",
        label: "Move to watchlist",
        consequence: "Draft a memo that explains why the name should be monitored.",
        recommended: thesis.stance === "move_to_watchlist",
        reversible: true,
      },
      {
        id: "reject_thesis",
        label: "Reject thesis",
        consequence: "Stop publication and record why the recommendation was rejected.",
        recommended: thesis.stance === "reject_thesis",
        reversible: true,
      },
    ],
    ...(resumeUrl ? { resume: { mode: "webhook", url: resumeUrl } } : {}),
    metadata: {
      ticker: snapshot.ticker,
      clientId: snapshot.portfolio.clientId,
      thesisScore: String(thesis.score),
      thesisLevel: thesis.level,
      generatedBy: "examples/langgraph-stock-research",
    },
  };
}

function buildComplianceEscalation({
  snapshot,
  thesis,
  committeeDecision,
  draftMemo,
  runId,
  resumeUrl,
}: {
  snapshot: StockResearchSnapshot;
  thesis: InvestmentThesis;
  committeeDecision: CommitteeDecision;
  draftMemo: string;
  runId: string;
  resumeUrl?: string;
}): EscalateInput {
  return {
    agentId: "portfolio-research-langgraph",
    runId,
    subject: {
      type: "research_memo",
      id: `${snapshot.ticker}:memo`,
      label: `${snapshot.companyName} (${snapshot.ticker}) client memo`,
    },
    question: `Approve this ${snapshot.ticker} client memo for publication?`,
    evidence: [
      `Investment committee decision: ${committeeDecision}.`,
      `Thesis score: ${thesis.score}/100 (${thesis.level}).`,
      ...thesis.complianceNotes,
      `Draft memo: ${draftMemo}`,
    ],
    choices: [
      {
        id: "publish_memo",
        label: "Publish memo",
        consequence: "Send the memo to the client workflow.",
        recommended: true,
        reversible: false,
      },
      {
        id: "revise_memo",
        label: "Revise memo",
        consequence: "Resume the graph with edited client-facing language.",
        reversible: true,
      },
      {
        id: "block_publication",
        label: "Block publication",
        consequence: "Complete the workflow without a client-facing memo.",
        reversible: true,
      },
    ],
    ...(resumeUrl ? { resume: { mode: "webhook", url: resumeUrl } } : {}),
    metadata: {
      ticker: snapshot.ticker,
      clientId: snapshot.portfolio.clientId,
      committeeDecision,
      generatedBy: "examples/langgraph-stock-research",
    },
  };
}

function requireSnapshot(state: StockResearchState): StockResearchSnapshot {
  if (!state.snapshot) {
    throw new Error("Stock research snapshot is missing from graph state");
  }

  return state.snapshot;
}

function requireThesis(state: StockResearchState): InvestmentThesis {
  if (!state.thesis) {
    throw new Error("Investment thesis is missing from graph state");
  }

  return state.thesis;
}

function requireCommitteeDecision(state: StockResearchState): CommitteeDecision {
  if (!state.committeeDecision) {
    throw new Error("Investment committee decision is missing from graph state");
  }

  return state.committeeDecision;
}
