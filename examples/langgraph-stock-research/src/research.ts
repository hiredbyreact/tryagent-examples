import type {
  CommitteeDecision,
  InvestmentThesis,
  StockResearchSnapshot,
} from "./types.js";

const CLIENT_PORTFOLIOS = {
  client_42: {
    clientId: "client_42",
    mandate: "balanced growth mandate",
    riskProfile: "balanced",
    currentSectorExposurePercent: 18,
    currentPositionPercent: 2.5,
    maxSingleNamePositionPercent: 6,
  },
} as const;

const SAMPLE_RESEARCH: Record<string, Omit<StockResearchSnapshot, "portfolio">> =
  {
    MSFT: {
      ticker: "MSFT",
      companyName: "Microsoft Corporation",
      sector: "Software",
      asOf: "2026-06-01",
      priceChangePercent: 1.1,
      peRatio: 31,
      revenueGrowthPercent: 14,
      debtToEquity: 0.4,
      analystConsensus: "bullish",
      catalysts: [
        "Cloud revenue growth remains durable",
        "Operating margins are stable",
      ],
      risks: ["Enterprise software budgets could slow"],
      recentHeadlines: ["Cloud revenue expands with stable margins"],
    },
    NVDA: {
      ticker: "NVDA",
      companyName: "Nvidia Corporation",
      sector: "Semiconductors",
      asOf: "2026-06-01",
      priceChangePercent: 8.8,
      peRatio: 78,
      revenueGrowthPercent: 42,
      debtToEquity: 2.4,
      analystConsensus: "bullish",
      catalysts: [
        "Accelerated computing demand remains strong",
        "Enterprise AI infrastructure budgets continue to expand",
      ],
      risks: [
        "Valuation remains sensitive to margin compression",
        "Export controls could affect data center revenue",
      ],
      recentHeadlines: [
        "AI chip demand surges while analysts debate valuation risk",
        "Investors monitor export-control exposure",
      ],
    },
    TSLA: {
      ticker: "TSLA",
      companyName: "Tesla, Inc.",
      sector: "Automobiles",
      asOf: "2026-06-01",
      priceChangePercent: -7.8,
      peRatio: 92,
      revenueGrowthPercent: 3,
      debtToEquity: 1.8,
      analystConsensus: "neutral",
      catalysts: ["Energy storage backlog continues to grow"],
      risks: [
        "Automotive margins remain under pressure",
        "Consensus estimates have been revised lower",
      ],
      recentHeadlines: ["Margins remain under pressure after price reductions"],
    },
  };

export function createStaticStockResearchStore(
  overrides: Record<string, StockResearchSnapshot> = {},
) {
  const snapshots = { ...SAMPLE_RESEARCH, ...normalizeOverrides(overrides) };

  return {
    async getSnapshot(
      ticker: string,
      clientId: string,
    ): Promise<StockResearchSnapshot> {
      const symbol = normalizeTicker(ticker);
      const known = snapshots[symbol] ?? createFallbackSnapshot(symbol);
      const portfolio = CLIENT_PORTFOLIOS.client_42;

      return {
        ...known,
        ticker: symbol,
        portfolio: {
          ...portfolio,
          clientId,
        },
      };
    },
  };
}

export function assessInvestmentThesis(
  snapshot: StockResearchSnapshot,
  reviewThreshold: number,
): InvestmentThesis {
  const evidence: string[] = [];
  const complianceNotes: string[] = [
    "Client memo must state that this is example research workflow data.",
    "Client memo must state that it is not personalized financial advice.",
  ];
  let score = 0;

  const priceMove = Math.abs(snapshot.priceChangePercent);
  if (priceMove >= 7) {
    score += 20;
    evidence.push(
      `${snapshot.ticker} moved ${snapshot.priceChangePercent.toFixed(1)}%, above the 7% volatility trigger.`,
    );
  } else {
    evidence.push(
      `${snapshot.ticker} moved ${snapshot.priceChangePercent.toFixed(1)}%, inside the normal volatility band.`,
    );
  }

  if (snapshot.peRatio >= 60) {
    score += 25;
    evidence.push(`P/E ratio is ${snapshot.peRatio}, which is valuation-sensitive.`);
  } else {
    evidence.push(`P/E ratio is ${snapshot.peRatio}, below the valuation trigger.`);
  }

  if (snapshot.debtToEquity >= 2) {
    score += 15;
    evidence.push(
      `Debt-to-equity is ${snapshot.debtToEquity.toFixed(1)}, above the leverage trigger.`,
    );
  } else {
    evidence.push(
      `Debt-to-equity is ${snapshot.debtToEquity.toFixed(1)}, below the leverage trigger.`,
    );
  }

  const projectedPosition =
    snapshot.portfolio.currentPositionPercent + suggestedPositionSize(snapshot);
  if (projectedPosition > snapshot.portfolio.maxSingleNamePositionPercent) {
    score += 20;
    evidence.push(
      `Suggested position would reach ${projectedPosition.toFixed(1)}%, above the ${snapshot.portfolio.maxSingleNamePositionPercent.toFixed(1)}% single-name limit.`,
    );
  } else {
    evidence.push(
      `Suggested position would remain at ${projectedPosition.toFixed(1)}%, within the single-name limit.`,
    );
  }

  const headlineText = [
    ...snapshot.recentHeadlines,
    ...snapshot.risks,
  ].join(" ").toLowerCase();
  if (/(risk|pressure|export|probe|lawsuit|downgrade|debate)/.test(headlineText)) {
    score += 15;
    evidence.push(`Headline or risk language needs review: ${snapshot.recentHeadlines[0]}`);
  } else {
    evidence.push(`Headlines are constructive: ${snapshot.recentHeadlines[0]}`);
  }

  const level = score >= 70 ? "high" : score >= 40 ? "medium" : "low";
  const stance =
    level === "high"
      ? "move_to_watchlist"
      : snapshot.analystConsensus === "bearish"
        ? "reject_thesis"
        : "approve_buy";

  return {
    score,
    level,
    stance,
    requiresHumanReview: score >= reviewThreshold,
    summary: `${snapshot.companyName} has a ${level}-risk ${stance.replaceAll("_", " ")} thesis for ${snapshot.portfolio.mandate}.`,
    evidence: [`Thesis score: ${score}/100 (${level}).`, ...evidence],
    complianceNotes,
  };
}

export function draftClientMemo({
  snapshot,
  thesis,
  committeeDecision,
  committeeNotes,
}: {
  snapshot: StockResearchSnapshot;
  thesis: InvestmentThesis;
  committeeDecision: CommitteeDecision;
  committeeNotes?: string;
}): string {
  const stance = formatDecision(committeeDecision);
  const suggestedAction =
    committeeDecision === "approve_buy"
      ? "Consider a modest add within the existing portfolio guardrails."
      : committeeDecision === "move_to_watchlist"
        ? "Move the name to the watchlist until valuation or risk signals improve."
        : "Do not publish a buy thesis for this account.";

  return [
    `${snapshot.companyName} (${snapshot.ticker}) research memo`,
    `Client mandate: ${snapshot.portfolio.mandate}.`,
    `Research stance: ${stance}.`,
    `Suggested action: ${suggestedAction}`,
    `Thesis: ${thesis.summary}`,
    `Catalysts: ${snapshot.catalysts.join("; ")}.`,
    `Key risks: ${snapshot.risks.join("; ")}.`,
    committeeNotes ? `Committee note: ${committeeNotes}` : undefined,
    "Important: this memo uses static sample data for a workflow example and is not personalized financial advice.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function draftCompletedSummary(
  snapshot: StockResearchSnapshot,
  thesis: InvestmentThesis,
  decision?: CommitteeDecision,
): string {
  const humanDecision = decision
    ? `Human decision: ${formatDecision(decision)}.`
    : "Auto-approved by workflow thresholds.";

  return [
    `${snapshot.companyName} (${snapshot.ticker}) research workflow completed.`,
    `Thesis score: ${thesis.score}/100 (${thesis.level}).`,
    humanDecision,
  ].join("\n");
}

function createFallbackSnapshot(
  ticker: string,
): Omit<StockResearchSnapshot, "portfolio"> {
  return {
    ticker,
    companyName: `${ticker} Corporation`,
    sector: "Multi-sector",
    asOf: "2026-06-01",
    priceChangePercent: 2.3,
    peRatio: 36,
    revenueGrowthPercent: 8,
    debtToEquity: 0.8,
    analystConsensus: "neutral",
    catalysts: [`${ticker} has mixed analyst coverage this week`],
    risks: ["Research coverage is incomplete"],
    recentHeadlines: [`${ticker} has mixed analyst coverage this week`],
  };
}

function suggestedPositionSize(snapshot: StockResearchSnapshot): number {
  return snapshot.analystConsensus === "bullish" ? 4 : 2;
}

function formatDecision(decision: CommitteeDecision): string {
  return decision.replaceAll("_", " ");
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function normalizeOverrides(
  overrides: Record<string, StockResearchSnapshot>,
): Record<string, Omit<StockResearchSnapshot, "portfolio">> {
  return Object.fromEntries(
    Object.entries(overrides).map(([ticker, snapshot]) => {
      const { portfolio: _portfolio, ...research } = snapshot;
      return [
        normalizeTicker(ticker),
        { ...research, ticker: normalizeTicker(snapshot.ticker) },
      ];
    }),
  );
}
