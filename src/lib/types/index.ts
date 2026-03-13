// TaxMate Core Domain Types
// All business logic types live here, decoupled from Prisma models.

import { Decimal } from "decimal.js";

export type Currency = "NOK" | "USD" | "EUR" | "GBP";

export type Chain =
  | "ethereum"
  | "arbitrum"
  | "base"
  | "optimism"
  | "bsc"
  | "polygon"
  | "solana"
  | "avalanche"
  | string;

// ─────────────────────────────────────────────
// TRANSACTION CLASSIFICATION
// ─────────────────────────────────────────────

export type TransactionType =
  | "FIAT_DEPOSIT"
  | "FIAT_WITHDRAWAL"
  | "CRYPTO_DEPOSIT"
  | "CRYPTO_WITHDRAWAL"
  | "MARKET_BUY"
  | "MARKET_SELL"
  | "SPOT_SWAP"
  | "FEE"
  | "REFERRAL_REWARD"
  | "CASHBACK"
  | "INTEREST"
  | "RECEIVE"
  | "SEND"
  | "SELF_TRANSFER"
  | "BRIDGE_OUT"
  | "BRIDGE_IN"
  | "SMART_CONTRACT_INTERACTION"
  | "TOKEN_APPROVAL"
  | "WRAPPED_TOKEN_MINT"
  | "WRAPPED_TOKEN_BURN"
  | "LP_DEPOSIT"
  | "LP_WITHDRAWAL"
  | "STAKING_DEPOSIT"
  | "STAKING_WITHDRAWAL"
  | "STAKING_REWARD"
  | "LENDING_DEPOSIT"
  | "LENDING_WITHDRAWAL"
  | "LENDING_INTEREST"
  | "BORROW"
  | "REPAYMENT"
  | "LIQUIDATION"
  | "YIELD_FARMING_REWARD"
  | "GOVERNANCE_REWARD"
  | "REBASING_EVENT"
  | "VAULT_DEPOSIT"
  | "VAULT_WITHDRAWAL"
  | "NFT_PURCHASE"
  | "NFT_SALE"
  | "NFT_MINT"
  | "ROYALTY_INCOME"
  | "MARKETPLACE_FEE"
  | "AIRDROP"
  | "MINING_REWARD"
  | "HARD_FORK"
  | "TOKEN_MIGRATION"
  | "BURN"
  | "GIFT_OUT"
  | "GIFT_IN"
  | "LOST_ASSET"
  | "MANUAL_ADJUSTMENT"
  | "UNKNOWN";

export type Direction = "IN" | "OUT" | "INTERNAL";
export type TxStatus = "NORMALIZED" | "FLAGGED" | "RESOLVED" | "IGNORED";
export type CostingMethod = "FIFO" | "LIFO" | "HIFO" | "SPECIFIC_ID";

// ─────────────────────────────────────────────
// NORWEGIAN TAX RULE OUTPUT
// ─────────────────────────────────────────────

export interface NorwegianTaxRule {
  transactionType: TransactionType;
  taxYear: number;

  // Core tax treatment
  isTaxableDisposal: boolean;
  isTaxableIncomeOnReceipt: boolean;
  createsTaxLot: boolean;
  consumesTaxLot: boolean;
  requiresPriceLookup: boolean;
  requiresManualReview: boolean;

  // Gain/loss treatment
  gainLossCategory: "capital_gain" | "income" | "none" | "uncertain";

  // Wealth tax
  relevantForWealthTax: boolean;

  // Assumptions / disclaimers
  disclaimers: string[];
  confidence: "high" | "medium" | "low";
}

// ─────────────────────────────────────────────
// CANONICAL TRANSACTION (in-memory)
// ─────────────────────────────────────────────

export interface CanonicalTx {
  id: string;
  workspaceId: string;
  rawRecordId?: string;
  txHash?: string;
  externalTxId?: string;
  timestamp: Date;
  sourceAccountId?: string;
  destinationAccountId?: string;
  transactionGroupId?: string;
  type: TransactionType;
  subtype?: string;
  assetId: string;
  assetSymbol: string;
  amount: Decimal;
  feeAssetId?: string;
  feeAssetSymbol?: string;
  feeAmount?: Decimal;
  fiatCurrency: Currency;
  fiatValue?: Decimal;
  fiatValueSource?: PriceSource;
  pricePerUnit?: Decimal;
  direction: Direction;
  taxable?: boolean;
  notes?: string;
  confidenceScore?: Decimal;
  status: TxStatus;
}

export type PriceSource =
  | "COINGECKO_DIRECT"
  | "COINGECKO_USD_NOK"
  | "COINGECKO_INDIRECT"
  | "EXCHANGE_REPORTED"
  | "USER_MANUAL"
  | "ESTIMATED"
  | "STABLECOIN_PEGGED";

// ─────────────────────────────────────────────
// COST BASIS ENGINE TYPES
// ─────────────────────────────────────────────

export interface TaxLot {
  id: string;
  workspaceId: string;
  assetId: string;
  assetSymbol: string;
  acquisitionTxId: string;
  acquisitionDate: Date;
  originalAmount: Decimal;
  remainingAmount: Decimal;
  costBasisNok: Decimal;
  sourceType: TaxLotSource;
  taxYear: number;
}

export type TaxLotSource =
  | "PURCHASE"
  | "REWARD"
  | "AIRDROP"
  | "MINING"
  | "GIFT"
  | "FORK"
  | "MIGRATION"
  | "MANUAL";

export interface DisposalMatch {
  id: string;
  disposalTxId: string;
  taxLotId: string;
  matchedAmount: Decimal;
  allocatedCostBasisNok: Decimal;
  proceedsNok: Decimal;
  gainLossNok: Decimal;
  costingMethod: CostingMethod;
}

export interface DisposalResult {
  disposalTxId: string;
  assetId: string;
  assetSymbol: string;
  timestamp: Date;
  totalAmount: Decimal;
  totalProceedsNok: Decimal;
  totalCostBasisNok: Decimal;
  totalGainLossNok: Decimal;
  matches: DisposalMatch[];
  warnings: string[];
  confidence: "full" | "partial" | "estimated";
}

// ─────────────────────────────────────────────
// PRICING ENGINE TYPES
// ─────────────────────────────────────────────

export interface PriceResult {
  assetId: string;
  symbol: string;
  timestamp: Date;
  currency: Currency;
  price: Decimal;
  source: PriceSource;
  confidence: Decimal;
  warnings: string[];
}

export interface PricingContext {
  assetId: string;
  symbol: string;
  coingeckoId?: string;
  isStablecoin: boolean;
  wrappedMetadata?: { underlyingSymbol: string; underlyingCoingeckoId: string };
}

// ─────────────────────────────────────────────
// RECONCILIATION ENGINE TYPES
// ─────────────────────────────────────────────

export interface ReconciliationMatch {
  type:
    | "own_transfer"
    | "bridge_pair"
    | "duplicate"
    | "fee_association"
    | "swap_pair";
  confidence: number;
  txIds: string[];
  metadata: Record<string, unknown>;
}

export interface ReconciliationResult {
  matches: ReconciliationMatch[];
  issues: DetectedIssue[];
}

// ─────────────────────────────────────────────
// ISSUE TYPES
// ─────────────────────────────────────────────

export type IssueSeverity = "CRITICAL" | "WARNING" | "INFO";
export type IssueType =
  | "MISSING_COST_BASIS"
  | "UNMATCHED_TRANSFER"
  | "DUPLICATE_TRANSACTION"
  | "MISSING_PRICE"
  | "UNKNOWN_ASSET"
  | "UNCLASSIFIED_TX"
  | "IMPOSSIBLE_BALANCE"
  | "DISPOSAL_EXCEEDS_HOLDINGS"
  | "PARTIAL_HISTORY"
  | "TIMESTAMP_MISMATCH"
  | "AMBIGUOUS_OWNERSHIP"
  | "FEE_INCONSISTENCY"
  | "UNSUPPORTED_TX_TYPE";

export interface DetectedIssue {
  workspaceId: string;
  severity: IssueSeverity;
  type: IssueType;
  title: string;
  description: string;
  linkedTxId?: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  suggestedResolution?: Record<string, unknown>;
}

// ─────────────────────────────────────────────
// REPORT TYPES
// ─────────────────────────────────────────────

export interface TaxSummary {
  workspaceId: string;
  taxYear: number;
  currency: Currency;

  // Realized
  totalRealizedGainNok: Decimal;
  totalRealizedLossNok: Decimal;
  netRealizedGainLossNok: Decimal;

  // Income
  totalTaxableIncomeNok: Decimal;
  incomeBreakdown: IncomeBreakdownItem[];

  // Holdings
  holdingsAtYearEnd: HoldingSnapshot[];
  totalHoldingsValueNok: Decimal;

  // Meta
  openIssueCount: number;
  confidenceLevel: "high" | "medium" | "low";
  assumptions: string[];
  warnings: string[];
  generatedAt: Date;
}

export interface IncomeBreakdownItem {
  type: TransactionType;
  label: string;
  totalNok: Decimal;
  txCount: number;
}

export interface HoldingSnapshot {
  assetId: string;
  symbol: string;
  amount: Decimal;
  valueNok: Decimal;
  priceNok: Decimal;
  priceSource: PriceSource;
  confidence: Decimal;
}

// ─────────────────────────────────────────────
// IMPORT TYPES
// ─────────────────────────────────────────────

export interface RawTransaction {
  externalId?: string;
  timestamp: Date;
  type: string;
  asset: string;
  amount: string;
  feeAsset?: string;
  feeAmount?: string;
  price?: string;
  currency?: string;
  txHash?: string;
  notes?: string;
  rawData: Record<string, unknown>;
}

export interface ImportResult {
  dataSourceId: string;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: ImportError[];
  warnings: string[];
}

export interface ImportError {
  row?: number;
  externalId?: string;
  message: string;
  data?: Record<string, unknown>;
}

// ─────────────────────────────────────────────
// DASHBOARD TYPES
// ─────────────────────────────────────────────

export interface DashboardMetrics {
  portfolioValueNok: Decimal;
  portfolioChangePercent: Decimal;
  realizedGainLossNok: Decimal;
  taxableIncomeNok: Decimal;
  estimatedTaxNok: Decimal;
  openIssueCount: number;
  criticalIssueCount: number;
  lastSyncAt?: Date;
  topAssets: AssetAllocation[];
  recentTransactions: CanonicalTx[];
}

export interface AssetAllocation {
  assetId: string;
  symbol: string;
  name?: string;
  amount: Decimal;
  valueNok: Decimal;
  percentOfPortfolio: Decimal;
  unrealizedGainLossNok: Decimal;
}

export interface PortfolioHistoryPoint {
  date: Date;
  valueNok: Decimal;
}
