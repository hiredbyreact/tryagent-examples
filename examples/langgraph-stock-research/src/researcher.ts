import type { StockResearchSnapshot, RiskAssessment } from "./types.js";

const SAMPLE_STOCKS: Record<string, StockResearchSnapshot> = {
  MSFT: {
    ticker: "MSFT",
    companyName: "Microsoft Corporation",
    priceChangePercent: 1.1,
    peRatio: 31,
    debtToEquity: 0.4,
    headlines: ["Cloud revenue expands with stable margins"],
  },
  NVDA: {
    ticker: "NVDA",
    companyName: "Nvidia Corporation",
    priceChangePercent: 9.2,
    peRatio: 78,
    debtToEquity: 2.4,
    headlines: ["AI chip demand surges while analysts debate valuation risk"],
  },
  TSLA: {
    ticker: "TSLA",
    companyName: "Tesla, Inc.",
    priceChangePercent: -7.8,
    peRatio: 92,
    debtToEquity: 1.8,
    headlines: ["Margins remain under pressure after price reductions"],
  },
};

export function createStaticStockResearcher(
  overrides: Record<string, StockResearchSnapshot> = {},
) {
  const stocks = { ...SAMPLE_STOCKS, ...normalizeOverrides(overrides) };

  return {
    async research(ticker: string): Promise<StockResearchSnapshot> {
      const symbol = normalizeTicker(ticker);
      const known = stocks[symbol];
      if (known) {
        return known;
      }

      return {
        ticker: symbol,
        companyName: `${symbol} Corporation`,
        priceChangePercent: 2.3,
        peRatio: 36,
        debtToEquity: 0.8,
        headlines: [`${symbol} has mixed analyst coverage this week`],
      };
    },
  };
}

export function assessResearch(
  research: StockResearchSnapshot,
  reviewThreshold: number,
): RiskAssessment {
  const evidence: string[] = [];
  let score = 0;

  const priceMove = Math.abs(research.priceChangePercent);
  if (priceMove >= 7) {
    score += 25;
    evidence.push(
      `Price moved ${research.priceChangePercent.toFixed(1)}%, above the 7% volatility threshold.`,
    );
  } else {
    evidence.push(
      `Price moved ${research.priceChangePercent.toFixed(1)}%, inside the normal volatility band.`,
    );
  }

  if (research.peRatio >= 60) {
    score += 25;
    evidence.push(`P/E ratio is ${research.peRatio}, which is valuation-sensitive.`);
  } else {
    evidence.push(`P/E ratio is ${research.peRatio}, below the valuation trigger.`);
  }

  if (research.debtToEquity >= 2) {
    score += 20;
    evidence.push(
      `Debt-to-equity is ${research.debtToEquity.toFixed(1)}, above the leverage trigger.`,
    );
  } else {
    evidence.push(
      `Debt-to-equity is ${research.debtToEquity.toFixed(1)}, below the leverage trigger.`,
    );
  }

  const headlineText = research.headlines.join(" ").toLowerCase();
  if (/(risk|pressure|probe|lawsuit|downgrade|debate)/.test(headlineText)) {
    score += 15;
    evidence.push(`Headline risk detected: ${research.headlines[0]}`);
  } else {
    evidence.push(`Headlines are constructive: ${research.headlines[0]}`);
  }

  const level = score >= 70 ? "high" : score >= 40 ? "medium" : "low";
  const recommendation =
    level === "high" ? "watchlist" : level === "medium" ? "watchlist" : "approve";

  return {
    score,
    level,
    recommendation,
    requiresHumanReview: score >= reviewThreshold,
    evidence: [`Risk score: ${score}/100 (${level}).`, ...evidence],
  };
}

export function draftReport(
  research: StockResearchSnapshot,
  risk: RiskAssessment,
): string {
  return [
    `${research.companyName} (${research.ticker}) research summary`,
    `Recommendation: ${risk.recommendation}`,
    `Risk: ${risk.level} (${risk.score}/100)`,
    ...risk.evidence,
  ].join("\n");
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function normalizeOverrides(
  overrides: Record<string, StockResearchSnapshot>,
): Record<string, StockResearchSnapshot> {
  return Object.fromEntries(
    Object.entries(overrides).map(([ticker, snapshot]) => [
      normalizeTicker(ticker),
      { ...snapshot, ticker: normalizeTicker(snapshot.ticker) },
    ]),
  );
}
