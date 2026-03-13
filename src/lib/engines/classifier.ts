// Transaction Classification Engine
// Maps raw imported transaction data to canonical TransactionType.
// Rules are deterministic and auditable.

import type { TransactionType, Direction } from "@/lib/types";

export interface ClassificationInput {
  rawType: string;
  direction?: "in" | "out" | "internal";
  provider?: string;
  notes?: string;
  amount?: number;
  hasCounterpart?: boolean;
}

export interface ClassificationResult {
  type: TransactionType;
  direction: Direction;
  confidence: number; // 0-1
  reason: string;
  requiresReview: boolean;
}

// Exchange-specific type mappings
const BINANCE_TYPE_MAP: Record<string, TransactionType> = {
  buy: "MARKET_BUY",
  sell: "MARKET_SELL",
  deposit: "CRYPTO_DEPOSIT",
  withdrawal: "CRYPTO_WITHDRAWAL",
  "fiat deposit": "FIAT_DEPOSIT",
  "fiat withdrawal": "FIAT_WITHDRAWAL",
  fee: "FEE",
  referral: "REFERRAL_REWARD",
  "staking rewards": "STAKING_REWARD",
  "savings interest": "LENDING_INTEREST",
  "flexible savings interest": "LENDING_INTEREST",
  airdrop: "AIRDROP",
  "small assets exchange bnb": "SPOT_SWAP",
  "transaction buy": "MARKET_BUY",
  "transaction sell": "MARKET_SELL",
  "commission history": "FEE",
  "launchpool earnings": "STAKING_REWARD",
};

const COINBASE_TYPE_MAP: Record<string, TransactionType> = {
  buy: "MARKET_BUY",
  sell: "MARKET_SELL",
  send: "SEND",
  receive: "RECEIVE",
  "coinbase earn": "STAKING_REWARD",
  rewards: "STAKING_REWARD",
  interest: "LENDING_INTEREST",
  "learning reward": "REFERRAL_REWARD",
  convert: "SPOT_SWAP",
  deposit: "FIAT_DEPOSIT",
  withdrawal: "FIAT_WITHDRAWAL",
  airdrop: "AIRDROP",
  "advanced trade buy": "MARKET_BUY",
  "advanced trade sell": "MARKET_SELL",
};

const KRAKEN_TYPE_MAP: Record<string, TransactionType> = {
  trade: "SPOT_SWAP",
  deposit: "CRYPTO_DEPOSIT",
  withdrawal: "CRYPTO_WITHDRAWAL",
  transfer: "SELF_TRANSFER",
  spend: "MARKET_SELL",
  receive: "MARKET_BUY",
  staking: "STAKING_REWARD",
  earn: "STAKING_REWARD",
  "margin trade": "MARKET_SELL",
  dividend: "STAKING_REWARD",
};

const PROVIDER_MAPS: Record<string, Record<string, TransactionType>> = {
  binance: BINANCE_TYPE_MAP,
  coinbase: COINBASE_TYPE_MAP,
  kraken: KRAKEN_TYPE_MAP,
};

// Generic keyword mapping
const GENERIC_KEYWORD_MAP: Array<{
  keywords: string[];
  type: TransactionType;
  priority: number;
}> = [
  { keywords: ["staking reward", "staking income", "staking"], type: "STAKING_REWARD", priority: 10 },
  { keywords: ["airdrop"], type: "AIRDROP", priority: 10 },
  { keywords: ["mining", "mined"], type: "MINING_REWARD", priority: 10 },
  { keywords: ["bridge"], type: "BRIDGE_OUT", priority: 8 },
  { keywords: ["swap", "convert", "exchange"], type: "SPOT_SWAP", priority: 7 },
  { keywords: ["buy", "purchased"], type: "MARKET_BUY", priority: 6 },
  { keywords: ["sell", "sold"], type: "MARKET_SELL", priority: 6 },
  { keywords: ["transfer", "send"], type: "SEND", priority: 5 },
  { keywords: ["receive", "deposit"], type: "RECEIVE", priority: 5 },
  { keywords: ["fee", "commission"], type: "FEE", priority: 9 },
  { keywords: ["interest", "yield"], type: "LENDING_INTEREST", priority: 8 },
  { keywords: ["referral", "cashback"], type: "REFERRAL_REWARD", priority: 8 },
  { keywords: ["nft", "mint"], type: "NFT_MINT", priority: 9 },
];

export function classifyTransaction(
  input: ClassificationInput
): ClassificationResult {
  const rawLower = input.rawType.toLowerCase().trim();

  // 1. Provider-specific mapping
  if (input.provider) {
    const providerMap = PROVIDER_MAPS[input.provider.toLowerCase()];
    if (providerMap) {
      const type = providerMap[rawLower] ?? providerMap[rawLower.replace(/_/g, " ")];
      if (type) {
        return {
          type,
          direction: inferDirection(type, input.direction),
          confidence: 0.95,
          reason: `Matched ${input.provider} type map: "${input.rawType}" -> ${type}`,
          requiresReview: false,
        };
      }
    }
  }

  // 2. Generic keyword matching (sorted by priority)
  const sorted = [...GENERIC_KEYWORD_MAP].sort((a, b) => b.priority - a.priority);
  for (const entry of sorted) {
    if (entry.keywords.some((kw) => rawLower.includes(kw))) {
      return {
        type: entry.type,
        direction: inferDirection(entry.type, input.direction),
        confidence: 0.7,
        reason: `Keyword match: "${rawLower}" contains known keyword for ${entry.type}`,
        requiresReview: false,
      };
    }
  }

  // 3. Direction-only fallback
  if (input.direction === "in") {
    return {
      type: "RECEIVE",
      direction: "IN",
      confidence: 0.4,
      reason: "Classified as RECEIVE based on inbound direction only",
      requiresReview: true,
    };
  }
  if (input.direction === "out") {
    return {
      type: "SEND",
      direction: "OUT",
      confidence: 0.4,
      reason: "Classified as SEND based on outbound direction only",
      requiresReview: true,
    };
  }

  // 4. Unknown
  return {
    type: "UNKNOWN",
    direction: "INTERNAL",
    confidence: 0,
    reason: `Could not classify raw type: "${input.rawType}"`,
    requiresReview: true,
  };
}

function inferDirection(type: TransactionType, hint?: "in" | "out" | "internal"): Direction {
  if (hint === "in") return "IN";
  if (hint === "out") return "OUT";
  if (hint === "internal") return "INTERNAL";

  const inbound: TransactionType[] = [
    "FIAT_DEPOSIT", "CRYPTO_DEPOSIT", "MARKET_BUY", "RECEIVE", "BRIDGE_IN",
    "STAKING_REWARD", "LENDING_INTEREST", "REFERRAL_REWARD", "CASHBACK",
    "AIRDROP", "MINING_REWARD", "HARD_FORK", "GIFT_IN", "WRAPPED_TOKEN_MINT",
    "NFT_MINT", "ROYALTY_INCOME", "YIELD_FARMING_REWARD", "GOVERNANCE_REWARD",
    "INTEREST",
  ];
  const outbound: TransactionType[] = [
    "FIAT_WITHDRAWAL", "CRYPTO_WITHDRAWAL", "MARKET_SELL", "SEND", "BRIDGE_OUT",
    "BURN", "GIFT_OUT", "LOST_ASSET", "WRAPPED_TOKEN_BURN", "FEE", "MARKETPLACE_FEE",
  ];
  const internal: TransactionType[] = [
    "SELF_TRANSFER", "TOKEN_APPROVAL", "SMART_CONTRACT_INTERACTION",
    "TOKEN_MIGRATION", "REBASING_EVENT",
  ];

  if (inbound.includes(type)) return "IN";
  if (outbound.includes(type)) return "OUT";
  if (internal.includes(type)) return "INTERNAL";
  return "INTERNAL";
}
