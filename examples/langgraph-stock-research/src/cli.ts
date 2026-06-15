import { parseTickerArg } from "./cli-args.js";
import { createTryAgentClientFromEnv } from "./env.js";
import { createStockResearchGraph } from "./graph.js";
import { createStaticStockResearcher } from "./researcher.js";

const ticker = parseTickerArg(process.argv.slice(2));
if (!ticker) {
  console.error("Usage: pnpm --filter @tryagent/langgraph-stock-research-example start -- <TICKER>");
  process.exit(1);
}

const policy = process.env.TRYAGENT_POLICY_KEY ?? "stock.research_approval";
const runId =
  process.env.LANGGRAPH_THREAD_ID ??
  `stock-${ticker.toLowerCase()}-${Date.now()}`;

const graph = createStockResearchGraph({
  tryagent: createTryAgentClientFromEnv(),
  researcher: createStaticStockResearcher(),
  policy,
  resumeUrl: process.env.TRYAGENT_RESUME_URL,
});

const result = await graph.invoke({ ticker, runId });

console.log(
  JSON.stringify(
    {
      ticker: result.ticker,
      runId: result.runId,
      status: result.status,
      escalationId: result.escalationId,
      report: result.report,
    },
    null,
    2,
  ),
);
