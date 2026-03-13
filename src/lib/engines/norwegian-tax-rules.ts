// Norwegian Tax Rules Engine
// Versioned, configurable rules for Norwegian crypto tax treatment.
// Rules are versioned per tax year and can be overridden.

import type { TransactionType, NorwegianTaxRule } from "@/lib/types";

/**
 * Norwegian tax rules for crypto assets.
 *
 * Key principles (Skatteetaten guidance):
 * - Crypto is taxed as capital asset (formuesobjekt)
 * - Disposal events (sale, swap) trigger capital gain/loss calculation
 * - Rewards and income events may be taxable as income (alminnelig inntekt)
 * - Self-transfers between own wallets are NOT taxable events
 * - All values must be in NOK at transaction date
 * - Year-end holdings may be relevant for wealth tax (formueskatt)
 *
 * DISCLAIMER: These rules represent best-effort interpretation of Norwegian tax law.
 * Users should consult a tax advisor for complex situations.
 * Rules may be updated as Skatteetaten provides further guidance.
 */

export interface TaxRuleOverride {
  transactionType: TransactionType;
  taxYear?: number; // null = all years
  isTaxableDisposal?: boolean;
  isTaxableIncomeOnReceipt?: boolean;
  reason: string;
}

// Default Norwegian tax rules by transaction type
// These are the engine's built-in rules for Norway, versioned by tax year.
const NORWAY_RULES_2023_2024: Record<
  TransactionType,
  Omit<NorwegianTaxRule, "transactionType" | "taxYear">
> = {
  FIAT_DEPOSIT: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: false,
    requiresPriceLookup: false,
    requiresManualReview: false,
    gainLossCategory: "none",
    relevantForWealthTax: false,
    disclaimers: [],
    confidence: "high",
  },
  FIAT_WITHDRAWAL: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: false,
    requiresPriceLookup: false,
    requiresManualReview: false,
    gainLossCategory: "none",
    relevantForWealthTax: false,
    disclaimers: [],
    confidence: "high",
  },
  CRYPTO_DEPOSIT: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: true,
    consumesTaxLot: false,
    requiresPriceLookup: true,
    requiresManualReview: false,
    gainLossCategory: "none",
    relevantForWealthTax: true,
    disclaimers: [
      "Deposit establishes cost basis at market value at time of deposit if no prior acquisition cost is known.",
    ],
    confidence: "medium",
  },
  CRYPTO_WITHDRAWAL: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: false,
    requiresPriceLookup: true,
    requiresManualReview: false,
    gainLossCategory: "none",
    relevantForWealthTax: false,
    disclaimers: [
      "Withdrawal to own wallet is not taxable. Ensure destination wallet is marked as own.",
    ],
    confidence: "medium",
  },
  MARKET_BUY: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: true,
    consumesTaxLot: false,
    requiresPriceLookup: true,
    requiresManualReview: false,
    gainLossCategory: "none",
    relevantForWealthTax: true,
    disclaimers: [],
    confidence: "high",
  },
  MARKET_SELL: {
    isTaxableDisposal: true,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: true,
    requiresPriceLookup: true,
    requiresManualReview: false,
    gainLossCategory: "capital_gain",
    relevantForWealthTax: false,
    disclaimers: [],
    confidence: "high",
  },
  SPOT_SWAP: {
    isTaxableDisposal: true,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: true, // creates lot for received asset
    consumesTaxLot: true, // consumes lot for sent asset
    requiresPriceLookup: true,
    requiresManualReview: false,
    gainLossCategory: "capital_gain",
    relevantForWealthTax: true,
    disclaimers: [
      "Swap between crypto assets is a taxable disposal event in Norway (Skatteetaten 2021 guidance).",
    ],
    confidence: "high",
  },
  FEE: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: true,
    requiresPriceLookup: true,
    requiresManualReview: false,
    gainLossCategory: "none",
    relevantForWealthTax: false,
    disclaimers: ["Fees paid in crypto may reduce cost basis or increase disposal proceeds."],
    confidence: "medium",
  },
  REFERRAL_REWARD: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: true,
    createsTaxLot: true,
    consumesTaxLot: false,
    requiresPriceLookup: true,
    requiresManualReview: false,
    gainLossCategory: "income",
    relevantForWealthTax: true,
    disclaimers: [
      "Referral rewards are generally taxable as income in Norway at receipt value.",
    ],
    confidence: "medium",
  },
  CASHBACK: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: true,
    createsTaxLot: true,
    consumesTaxLot: false,
    requiresPriceLookup: true,
    requiresManualReview: true,
    gainLossCategory: "income",
    relevantForWealthTax: true,
    disclaimers: [
      "Tax treatment of cashback in crypto is uncertain. Consult a tax advisor.",
    ],
    confidence: "low",
  },
  INTEREST: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: true,
    createsTaxLot: true,
    consumesTaxLot: false,
    requiresPriceLookup: true,
    requiresManualReview: false,
    gainLossCategory: "income",
    relevantForWealthTax: true,
    disclaimers: [
      "Interest income from crypto lending is taxable as income at receipt value (NOK).",
    ],
    confidence: "high",
  },
  RECEIVE: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: true,
    consumesTaxLot: false,
    requiresPriceLookup: true,
    requiresManualReview: true,
    gainLossCategory: "none",
    relevantForWealthTax: true,
    disclaimers: [
      "Incoming transfer classified as receive. Review to confirm this is not a sale proceeds or income event.",
    ],
    confidence: "low",
  },
  SEND: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: false,
    requiresPriceLookup: true,
    requiresManualReview: true,
    gainLossCategory: "none",
    relevantForWealthTax: false,
    disclaimers: [
      "Outgoing transfer classified as send. Review to confirm this is not a sale or gift.",
    ],
    confidence: "low",
  },
  SELF_TRANSFER: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: false,
    requiresPriceLookup: false,
    requiresManualReview: false,
    gainLossCategory: "none",
    relevantForWealthTax: false,
    disclaimers: [
      "Transfer between own wallets is not a taxable event. Cost basis is preserved.",
    ],
    confidence: "high",
  },
  BRIDGE_OUT: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: false,
    requiresPriceLookup: false,
    requiresManualReview: false,
    gainLossCategory: "none",
    relevantForWealthTax: false,
    disclaimers: [
      "Bridge to another chain is not taxable if same asset and same owner. Must be matched with bridge-in.",
    ],
    confidence: "high",
  },
  BRIDGE_IN: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: false,
    requiresPriceLookup: false,
    requiresManualReview: false,
    gainLossCategory: "none",
    relevantForWealthTax: false,
    disclaimers: ["Bridge in continues cost basis from bridge-out."],
    confidence: "high",
  },
  SMART_CONTRACT_INTERACTION: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: false,
    requiresPriceLookup: false,
    requiresManualReview: true,
    gainLossCategory: "uncertain",
    relevantForWealthTax: false,
    disclaimers: [
      "Smart contract interactions require manual review to determine tax treatment.",
    ],
    confidence: "low",
  },
  TOKEN_APPROVAL: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: false,
    requiresPriceLookup: false,
    requiresManualReview: false,
    gainLossCategory: "none",
    relevantForWealthTax: false,
    disclaimers: ["Token approval is a non-taxable metadata event."],
    confidence: "high",
  },
  WRAPPED_TOKEN_MINT: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: false,
    requiresPriceLookup: false,
    requiresManualReview: false,
    gainLossCategory: "none",
    relevantForWealthTax: false,
    disclaimers: [
      "Wrapping a token (e.g. ETH -> WETH) is not a disposal in Norway as long as the underlying economic ownership is unchanged.",
    ],
    confidence: "medium",
  },
  WRAPPED_TOKEN_BURN: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: false,
    requiresPriceLookup: false,
    requiresManualReview: false,
    gainLossCategory: "none",
    relevantForWealthTax: false,
    disclaimers: ["Unwrapping a token is not a disposal."],
    confidence: "medium",
  },
  LP_DEPOSIT: {
    isTaxableDisposal: true,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: true,
    consumesTaxLot: true,
    requiresPriceLookup: true,
    requiresManualReview: true,
    gainLossCategory: "capital_gain",
    relevantForWealthTax: true,
    disclaimers: [
      "LP deposit may be treated as disposal of underlying tokens in Norway. Treatment is uncertain and under review. Consult a tax advisor.",
    ],
    confidence: "low",
  },
  LP_WITHDRAWAL: {
    isTaxableDisposal: true,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: true,
    consumesTaxLot: true,
    requiresPriceLookup: true,
    requiresManualReview: true,
    gainLossCategory: "capital_gain",
    relevantForWealthTax: false,
    disclaimers: [
      "LP withdrawal treatment is uncertain in Norway. May trigger disposal event. Consult a tax advisor.",
    ],
    confidence: "low",
  },
  STAKING_DEPOSIT: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: false,
    requiresPriceLookup: false,
    requiresManualReview: false,
    gainLossCategory: "none",
    relevantForWealthTax: true,
    disclaimers: [
      "Staking deposit is not a disposal. Holdings are still yours. Lock-up period may affect wealth tax.",
    ],
    confidence: "high",
  },
  STAKING_WITHDRAWAL: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: false,
    requiresPriceLookup: false,
    requiresManualReview: false,
    gainLossCategory: "none",
    relevantForWealthTax: true,
    disclaimers: [],
    confidence: "high",
  },
  STAKING_REWARD: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: true,
    createsTaxLot: true,
    consumesTaxLot: false,
    requiresPriceLookup: true,
    requiresManualReview: false,
    gainLossCategory: "income",
    relevantForWealthTax: true,
    disclaimers: [
      "Staking rewards are taxable as income in Norway at the time of receipt at market value (NOK).",
    ],
    confidence: "high",
  },
  LENDING_DEPOSIT: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: false,
    requiresPriceLookup: false,
    requiresManualReview: false,
    gainLossCategory: "none",
    relevantForWealthTax: true,
    disclaimers: [],
    confidence: "high",
  },
  LENDING_WITHDRAWAL: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: false,
    requiresPriceLookup: false,
    requiresManualReview: false,
    gainLossCategory: "none",
    relevantForWealthTax: true,
    disclaimers: [],
    confidence: "high",
  },
  LENDING_INTEREST: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: true,
    createsTaxLot: true,
    consumesTaxLot: false,
    requiresPriceLookup: true,
    requiresManualReview: false,
    gainLossCategory: "income",
    relevantForWealthTax: true,
    disclaimers: ["Lending interest is taxable income in Norway."],
    confidence: "high",
  },
  BORROW: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: false,
    requiresPriceLookup: false,
    requiresManualReview: true,
    gainLossCategory: "none",
    relevantForWealthTax: false,
    disclaimers: [
      "Borrowing crypto is not a disposal. Outstanding loans may be relevant for wealth deduction.",
    ],
    confidence: "medium",
  },
  REPAYMENT: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: false,
    requiresPriceLookup: false,
    requiresManualReview: false,
    gainLossCategory: "none",
    relevantForWealthTax: false,
    disclaimers: [],
    confidence: "high",
  },
  LIQUIDATION: {
    isTaxableDisposal: true,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: true,
    requiresPriceLookup: true,
    requiresManualReview: true,
    gainLossCategory: "capital_gain",
    relevantForWealthTax: false,
    disclaimers: [
      "Liquidation is treated as a forced disposal. Gain/loss calculated at liquidation price.",
    ],
    confidence: "medium",
  },
  YIELD_FARMING_REWARD: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: true,
    createsTaxLot: true,
    consumesTaxLot: false,
    requiresPriceLookup: true,
    requiresManualReview: false,
    gainLossCategory: "income",
    relevantForWealthTax: true,
    disclaimers: ["Yield farming rewards are taxable income in Norway."],
    confidence: "medium",
  },
  GOVERNANCE_REWARD: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: true,
    createsTaxLot: true,
    consumesTaxLot: false,
    requiresPriceLookup: true,
    requiresManualReview: false,
    gainLossCategory: "income",
    relevantForWealthTax: true,
    disclaimers: ["Governance rewards are treated as income in Norway."],
    confidence: "medium",
  },
  REBASING_EVENT: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: false,
    requiresPriceLookup: false,
    requiresManualReview: true,
    gainLossCategory: "uncertain",
    relevantForWealthTax: true,
    disclaimers: [
      "Rebasing events (supply adjustments) have uncertain tax treatment in Norway. Requires manual review.",
    ],
    confidence: "low",
  },
  VAULT_DEPOSIT: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: false,
    requiresPriceLookup: false,
    requiresManualReview: true,
    gainLossCategory: "uncertain",
    relevantForWealthTax: true,
    disclaimers: [
      "Vault deposit tax treatment depends on vault mechanics. Review required.",
    ],
    confidence: "low",
  },
  VAULT_WITHDRAWAL: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: false,
    requiresPriceLookup: false,
    requiresManualReview: true,
    gainLossCategory: "uncertain",
    relevantForWealthTax: true,
    disclaimers: ["Vault withdrawal tax treatment depends on vault mechanics."],
    confidence: "low",
  },
  NFT_PURCHASE: {
    isTaxableDisposal: true, // pays crypto (disposal)
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: true,
    consumesTaxLot: true,
    requiresPriceLookup: true,
    requiresManualReview: false,
    gainLossCategory: "capital_gain",
    relevantForWealthTax: true,
    disclaimers: [
      "Purchasing NFT with crypto triggers disposal of crypto paid. NFT itself creates new tax lot.",
    ],
    confidence: "high",
  },
  NFT_SALE: {
    isTaxableDisposal: true,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: true,
    requiresPriceLookup: true,
    requiresManualReview: false,
    gainLossCategory: "capital_gain",
    relevantForWealthTax: false,
    disclaimers: [],
    confidence: "high",
  },
  NFT_MINT: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: true,
    consumesTaxLot: false,
    requiresPriceLookup: true,
    requiresManualReview: true,
    gainLossCategory: "none",
    relevantForWealthTax: true,
    disclaimers: [
      "NFT mint cost basis is the cost of minting (gas + mint price). NFT value at mint may be uncertain.",
    ],
    confidence: "medium",
  },
  ROYALTY_INCOME: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: true,
    createsTaxLot: true,
    consumesTaxLot: false,
    requiresPriceLookup: true,
    requiresManualReview: false,
    gainLossCategory: "income",
    relevantForWealthTax: true,
    disclaimers: ["NFT royalty income is taxable as ordinary income in Norway."],
    confidence: "high",
  },
  MARKETPLACE_FEE: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: true,
    requiresPriceLookup: true,
    requiresManualReview: false,
    gainLossCategory: "none",
    relevantForWealthTax: false,
    disclaimers: [],
    confidence: "high",
  },
  AIRDROP: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: true,
    createsTaxLot: true,
    consumesTaxLot: false,
    requiresPriceLookup: true,
    requiresManualReview: true,
    gainLossCategory: "income",
    relevantForWealthTax: true,
    disclaimers: [
      "Airdrops are generally taxable as income in Norway at market value on receipt date. Low-value airdrops may be de minimis. Consult a tax advisor.",
    ],
    confidence: "medium",
  },
  MINING_REWARD: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: true,
    createsTaxLot: true,
    consumesTaxLot: false,
    requiresPriceLookup: true,
    requiresManualReview: false,
    gainLossCategory: "income",
    relevantForWealthTax: true,
    disclaimers: [
      "Mining rewards are taxable as income in Norway at market value on receipt date.",
    ],
    confidence: "high",
  },
  HARD_FORK: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: true,
    createsTaxLot: true,
    consumesTaxLot: false,
    requiresPriceLookup: true,
    requiresManualReview: true,
    gainLossCategory: "income",
    relevantForWealthTax: true,
    disclaimers: [
      "Hard fork receipts may be taxable as income in Norway. Treatment is uncertain for zero-value forks.",
    ],
    confidence: "low",
  },
  TOKEN_MIGRATION: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: false,
    requiresPriceLookup: false,
    requiresManualReview: true,
    gainLossCategory: "none",
    relevantForWealthTax: true,
    disclaimers: [
      "Token migration (1:1 swap to new contract) is generally not a disposal if economic substance is unchanged. Manual review recommended.",
    ],
    confidence: "medium",
  },
  BURN: {
    isTaxableDisposal: true,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: true,
    requiresPriceLookup: true,
    requiresManualReview: true,
    gainLossCategory: "capital_gain",
    relevantForWealthTax: false,
    disclaimers: [
      "Token burn may be treated as disposal with proceeds = 0, resulting in a capital loss.",
    ],
    confidence: "low",
  },
  GIFT_OUT: {
    isTaxableDisposal: true,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: true,
    requiresPriceLookup: true,
    requiresManualReview: true,
    gainLossCategory: "capital_gain",
    relevantForWealthTax: false,
    disclaimers: [
      "Gifting crypto is generally treated as disposal at market value in Norway.",
    ],
    confidence: "medium",
  },
  GIFT_IN: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: true,
    consumesTaxLot: false,
    requiresPriceLookup: true,
    requiresManualReview: true,
    gainLossCategory: "none",
    relevantForWealthTax: true,
    disclaimers: [
      "Receiving crypto as gift: cost basis is market value at time of receipt for tax purposes.",
    ],
    confidence: "medium",
  },
  LOST_ASSET: {
    isTaxableDisposal: true,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: true,
    requiresPriceLookup: false,
    requiresManualReview: true,
    gainLossCategory: "capital_gain",
    relevantForWealthTax: false,
    disclaimers: [
      "Loss of crypto due to theft/loss may generate a capital loss. Requires documentation for Skatteetaten.",
    ],
    confidence: "low",
  },
  MANUAL_ADJUSTMENT: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: false,
    requiresPriceLookup: false,
    requiresManualReview: true,
    gainLossCategory: "uncertain",
    relevantForWealthTax: false,
    disclaimers: ["Manual adjustment — review required to determine tax treatment."],
    confidence: "low",
  },
  UNKNOWN: {
    isTaxableDisposal: false,
    isTaxableIncomeOnReceipt: false,
    createsTaxLot: false,
    consumesTaxLot: false,
    requiresPriceLookup: false,
    requiresManualReview: true,
    gainLossCategory: "uncertain",
    relevantForWealthTax: false,
    disclaimers: ["Unknown transaction type — manual review required."],
    confidence: "low",
  },
};

export function getNorwegianTaxRule(
  type: TransactionType,
  taxYear: number,
  overrides?: TaxRuleOverride[]
): NorwegianTaxRule {
  const base = NORWAY_RULES_2023_2024[type] ?? NORWAY_RULES_2023_2024.UNKNOWN;

  const rule: NorwegianTaxRule = {
    transactionType: type,
    taxYear,
    ...base,
  };

  // Apply user/admin overrides
  if (overrides) {
    for (const override of overrides) {
      if (
        override.transactionType === type &&
        (!override.taxYear || override.taxYear === taxYear)
      ) {
        if (override.isTaxableDisposal !== undefined) {
          rule.isTaxableDisposal = override.isTaxableDisposal;
        }
        if (override.isTaxableIncomeOnReceipt !== undefined) {
          rule.isTaxableIncomeOnReceipt = override.isTaxableIncomeOnReceipt;
        }
        rule.disclaimers = [
          ...rule.disclaimers,
          `Override applied: ${override.reason}`,
        ];
      }
    }
  }

  return rule;
}

export function getRuleForYear(taxYear: number) {
  // Future: return year-specific rule tables
  // For now, 2023+ rules apply
  return (type: TransactionType, overrides?: TaxRuleOverride[]) =>
    getNorwegianTaxRule(type, taxYear, overrides);
}
