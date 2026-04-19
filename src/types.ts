export type MembershipPeriod = {
  enteredAt: string | null;
  leftAt: string | null;
};

export type DividendInfo = {
  hasDividend: boolean;
  dividendRate: number | null;
  dividendYield: number | null;
  currency: string | null;
};

export type MetricSnapshot = {
  marketCap: number | null;
  price: number | null;
  currency: string | null;
  trailingPE: number | null;
  forwardPE: number | null;
  priceToBook: number | null;
  returnOnEquity: number | null;
  profitMargins: number | null;
  operatingMargins: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  averageDailyVolume: number | null;
};

export type CompanyRecord = {
  ticker: string;
  yahooTicker: string;
  security: string;
  sector: string;
  subIndustry: string;
  sourceIndex?: string;
  headquarters?: string;
  cik?: string;
  founded?: string;
  currentMember: boolean;
  currentMemberSince: string | null;
  lastLeftAt: string | null;
  membershipHistory: MembershipPeriod[];
  dividend: DividendInfo;
  metrics: MetricSnapshot;
  scores: {
    fallOutRisk: number | null;
    entryScore: number | null;
    undervaluedScore: number | null;
    overvaluedScore: number | null;
  };
};

export type RankedCompany = CompanyRecord & {
  rank: number;
  commentary: string;
};

export type MembershipChange = {
  date: string;
  ticker: string;
  security: string;
};

export type PredictionData = {
  generatedAt: string;
  possibleFallOut: RankedCompany[];
  possibleEntrants: RankedCompany[];
  undervalued: RankedCompany[];
  overvalued: RankedCompany[];
};

export type SnapshotData = {
  generatedAt: string;
  schedule: {
    nextSnapshotAt: string;
  };
  methodology: {
    disclaimer: string;
    fallOutFactors: string[];
    entryFactors: string[];
    valuationFactors: string[];
  };
  summary: {
    currentConstituentCount: number;
    candidateUniverseCount: number;
    dividendPayers: number;
    nonDividendPayers: number;
  };
  sources: Array<{
    label: string;
    url: string;
  }>;
  recentChanges: {
    joinedLast7Days: MembershipChange[];
    leftLast7Days: MembershipChange[];
  };
  currentMembers: CompanyRecord[];
};
