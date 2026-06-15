import { INTERRUPT, isInterrupted } from "@langchain/langgraph";
import { parseTickerArg } from "./cli-args.js";
import { createTryAgentClientFromEnv } from "./env.js";
import { createStockResearchGraph } from "./graph.js";
import { createStaticStockResearchStore } from "./research.js";
import type { TryAgentStockResearchInterruptPayload } from "./types.js";

const ticker = parseTickerArg(process.argv.slice(2));
if (!ticker) {
  console.error(
    "Usage: pnpm --filter @tryagent/langgraph-stock-research-example start -- <TICKER>",
  );
  process.exit(1);
}

const investmentPolicy =
  process.env.TRYAGENT_INVESTMENT_POLICY_KEY ??
  "research.investment_committee";
const compliancePolicy =
  process.env.TRYAGENT_COMPLIANCE_POLICY_KEY ?? "research.compliance_review";
const clientId = process.env.STOCK_RESEARCH_CLIENT_ID ?? "client_42";
const runId =
  process.env.LANGGRAPH_THREAD_ID ??
  `stock-${ticker.toLowerCase()}-${clientId}-${Date.now()}`;

const tryagent = createTryAgentClientFromEnv();
const graph = createStockResearchGraph({
  researchStore: createStaticStockResearchStore(),
  investmentPolicy,
  compliancePolicy,
  resumeUrl: process.env.TRYAGENT_RESUME_URL,
});
const config = { configurable: { thread_id: runId } };

const result = await graph.invoke({ ticker, runId, clientId }, config);

if (isInterrupted(result)) {
  const activeInterrupt = result[INTERRUPT][0];
  const payload =
    activeInterrupt.value as TryAgentStockResearchInterruptPayload;
  const escalation = await tryagent.escalate(
    payload.policy,
    payload.tryagentInput,
  );

  console.log(
    JSON.stringify(
      {
        ticker,
        clientId,
        runId,
        status: "awaiting_human",
        interruptId: activeInterrupt.id,
        interruptKind: payload.kind,
        escalationId: escalation.id,
        nextStep:
          "Resume this LangGraph thread with new Command({ resume: ... }) when TryAgent returns a decision.",
        resumeExample:
          payload.kind === "tryagent_investment_committee_review"
            ? {
                escalationId: escalation.id,
                decision: "move_to_watchlist",
                reviewedBy: "pm@example.com",
                notes: "Valuation risk is acceptable for watchlist, not a new buy.",
              }
            : {
                escalationId: escalation.id,
                action: "publish_memo",
                memo: payload.draftMemo,
              },
      },
      null,
      2,
    ),
  );
} else {
  console.log(
    JSON.stringify(
      {
        ticker: result.ticker,
        clientId: result.clientId,
        runId: result.runId,
        status: result.status,
        committeeDecision: result.committeeDecision,
        complianceAction: result.complianceAction,
        summary: result.summary,
        clientMemo: result.clientMemo,
      },
      null,
      2,
    ),
  );
}
