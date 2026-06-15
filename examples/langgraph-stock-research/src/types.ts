import type { EscalateInput, Escalation } from "@tryagent/sdk";

export type StockResearchSnapshot = {
  ticker: string;
  companyName: string;
  priceChangePercent: number;
  peRatio: number;
  debtToEquity: number;
  headlines: string[];
};

export type RiskAssessment = {
  score: number;
  level: "low" | "medium" | "high";
  recommendation: "approve" | "watchlist" | "reject";
  requiresHumanReview: boolean;
  evidence: string[];
};

export type StockResearchState = {
  ticker: string;
  runId: string;
  research?: StockResearchSnapshot;
  risk?: RiskAssessment;
  status?: "completed" | "awaiting_human";
  escalationId?: string;
  report?: string;
};

export type StockResearcher = {
  research(ticker: string): Promise<StockResearchSnapshot>;
};

export type TryAgentEscalationClient = {
  escalate(policy: string, input: EscalateInput): Promise<Escalation>;
};

export type StockResearchGraphOptions = {
  tryagent: TryAgentEscalationClient;
  researcher: StockResearcher;
  policy: string;
  resumeUrl?: string;
  reviewThreshold?: number;
};
