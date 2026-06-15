import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { assessResearch, draftReport } from "./researcher.js";
import type {
  StockResearchGraphOptions,
  StockResearchSnapshot,
  StockResearchState,
  RiskAssessment,
} from "./types.js";

const StockResearchAnnotation = Annotation.Root({
  ticker: Annotation<string>(),
  runId: Annotation<string>(),
  research: Annotation<StockResearchSnapshot | undefined>(),
  risk: Annotation<RiskAssessment | undefined>(),
  status: Annotation<StockResearchState["status"] | undefined>(),
  escalationId: Annotation<string | undefined>(),
  report: Annotation<string | undefined>(),
});

export function createStockResearchGraph(options: StockResearchGraphOptions) {
  const reviewThreshold = options.reviewThreshold ?? 70;

  return new StateGraph(StockResearchAnnotation)
    .addNode("fetchResearch", async (state) => {
      return {
        research: await options.researcher.research(state.ticker),
      };
    })
    .addNode("assessRisk", async (state) => {
      const research = requireResearch(state);
      return {
        risk: assessResearch(research, reviewThreshold),
      };
    })
    .addNode("requestHumanReview", async (state) => {
      const research = requireResearch(state);
      const risk = requireRisk(state);
      const report = draftReport(research, risk);
      const escalation = await options.tryagent.escalate(options.policy, {
        agentId: "stock-research-langgraph",
        runId: state.runId,
        subject: {
          type: "stock",
          id: research.ticker,
          label: `${research.companyName} (${research.ticker})`,
        },
        question: `Review ${research.ticker} before publishing this stock research recommendation?`,
        evidence: risk.evidence,
        choices: [
          {
            id: "approve",
            label: "Approve recommendation",
            consequence: "Publish the recommendation to the requesting workflow.",
            reversible: true,
          },
          {
            id: "watchlist",
            label: "Move to watchlist",
            consequence: "Hold the position for follow-up research.",
            recommended: risk.recommendation === "watchlist",
            reversible: true,
          },
          {
            id: "reject",
            label: "Reject recommendation",
            consequence: "Stop the workflow without publishing the recommendation.",
            reversible: false,
          },
        ],
        ...(options.resumeUrl
          ? { resume: { mode: "webhook", url: options.resumeUrl } }
          : {}),
        metadata: {
          riskScore: risk.score,
          riskLevel: risk.level,
          generatedBy: "examples/langgraph-stock-research",
        },
      });

      return {
        status: "awaiting_human" as const,
        escalationId: escalation.id,
        report,
      };
    })
    .addNode("finishReport", async (state) => {
      const research = requireResearch(state);
      const risk = requireRisk(state);

      return {
        status: "completed" as const,
        report: draftReport(research, risk),
      };
    })
    .addEdge(START, "fetchResearch")
    .addEdge("fetchResearch", "assessRisk")
    .addConditionalEdges(
      "assessRisk",
      (state) =>
        state.risk?.requiresHumanReview ? "requestHumanReview" : "finishReport",
      {
        requestHumanReview: "requestHumanReview",
        finishReport: "finishReport",
      },
    )
    .addEdge("requestHumanReview", END)
    .addEdge("finishReport", END)
    .compile();
}

function requireResearch(state: StockResearchState): StockResearchSnapshot {
  if (!state.research) {
    throw new Error("Stock research is missing from graph state");
  }

  return state.research;
}

function requireRisk(state: StockResearchState): RiskAssessment {
  if (!state.risk) {
    throw new Error("Risk assessment is missing from graph state");
  }

  return state.risk;
}
