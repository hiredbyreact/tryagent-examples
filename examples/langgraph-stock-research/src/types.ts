import type { EscalateInput } from "@tryagent/sdk";

export type PortfolioContext = {
  clientId: string;
  mandate: string;
  riskProfile: "conservative" | "balanced" | "growth";
  currentSectorExposurePercent: number;
  currentPositionPercent: number;
  maxSingleNamePositionPercent: number;
};

export type StockResearchSnapshot = {
  ticker: string;
  companyName: string;
  sector: string;
  asOf: string;
  priceChangePercent: number;
  peRatio: number;
  revenueGrowthPercent: number;
  debtToEquity: number;
  analystConsensus: "bullish" | "neutral" | "bearish";
  catalysts: string[];
  risks: string[];
  recentHeadlines: string[];
  portfolio: PortfolioContext;
};

export type InvestmentThesis = {
  score: number;
  level: "low" | "medium" | "high";
  stance: "approve_buy" | "move_to_watchlist" | "reject_thesis";
  requiresHumanReview: boolean;
  summary: string;
  evidence: string[];
  complianceNotes: string[];
};

export type CommitteeDecision =
  | "approve_buy"
  | "move_to_watchlist"
  | "reject_thesis";

export type ComplianceAction =
  | "publish_memo"
  | "revise_memo"
  | "block_publication";

export type InvestmentCommitteeResume = {
  escalationId: string;
  decision: CommitteeDecision;
  reviewedBy?: string;
  notes?: string;
};

export type ComplianceReviewResume = {
  escalationId: string;
  action: ComplianceAction;
  memo?: string;
  reviewedBy?: string;
};

export type StockResearchState = {
  ticker: string;
  runId: string;
  clientId: string;
  snapshot?: StockResearchSnapshot;
  thesis?: InvestmentThesis;
  status?: "completed" | "awaiting_human";
  committeeEscalationId?: string;
  complianceEscalationId?: string;
  committeeDecision?: CommitteeDecision;
  committeeNotes?: string;
  committeeReviewedBy?: string;
  complianceAction?: ComplianceAction;
  clientMemo?: string;
  summary?: string;
};

export type StockResearchStore = {
  getSnapshot(ticker: string, clientId: string): Promise<StockResearchSnapshot>;
};

export type TryAgentStockResearchInterruptPayload = {
  kind:
    | "tryagent_investment_committee_review"
    | "tryagent_research_compliance_review";
  policy: string;
  tryagentInput: EscalateInput;
  draftMemo?: string;
};

export type StockResearchGraphOptions = {
  researchStore: StockResearchStore;
  investmentPolicy: string;
  compliancePolicy: string;
  resumeUrl?: string;
  reviewThreshold?: number;
};
