import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNok(
  value: number | string | null | undefined,
  opts: { decimals?: number; showSign?: boolean } = {}
): string {
  if (value == null) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";

  const { decimals = 2, showSign = false } = opts;
  const formatted = new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(num));

  if (showSign) {
    if (num > 0) return `+${formatted}`;
    if (num < 0) return `-${formatted}`;
  }
  return num < 0 ? `-${formatted}` : formatted;
}

export function formatAmount(
  value: number | string | null | undefined,
  symbol?: string,
  decimals = 6
): string {
  if (value == null) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";

  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(num);

  return symbol ? `${formatted} ${symbol}` : formatted;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("nb-NO", { dateStyle: "short" }).format(d);
}

export function formatPercent(
  value: number | string | null | undefined,
  opts: { decimals?: number; showSign?: boolean } = {}
): string {
  if (value == null) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";

  const { decimals = 1, showSign = false } = opts;
  const sign = showSign && num > 0 ? "+" : "";
  return `${sign}${num.toFixed(decimals)}%`;
}

export function getTxTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    MARKET_BUY: "Buy",
    MARKET_SELL: "Sell",
    SPOT_SWAP: "Swap",
    FIAT_DEPOSIT: "Fiat Deposit",
    FIAT_WITHDRAWAL: "Fiat Withdrawal",
    CRYPTO_DEPOSIT: "Deposit",
    CRYPTO_WITHDRAWAL: "Withdrawal",
    SELF_TRANSFER: "Self Transfer",
    BRIDGE_OUT: "Bridge Out",
    BRIDGE_IN: "Bridge In",
    STAKING_REWARD: "Staking Reward",
    STAKING_DEPOSIT: "Staking Deposit",
    STAKING_WITHDRAWAL: "Staking Withdrawal",
    AIRDROP: "Airdrop",
    MINING_REWARD: "Mining Reward",
    LENDING_INTEREST: "Lending Interest",
    LENDING_DEPOSIT: "Lending Deposit",
    LENDING_WITHDRAWAL: "Lending Withdrawal",
    LP_DEPOSIT: "LP Deposit",
    LP_WITHDRAWAL: "LP Withdrawal",
    NFT_PURCHASE: "NFT Purchase",
    NFT_SALE: "NFT Sale",
    NFT_MINT: "NFT Mint",
    REFERRAL_REWARD: "Referral Reward",
    FEE: "Fee",
    RECEIVE: "Receive",
    SEND: "Send",
    BURN: "Burn",
    GIFT_IN: "Gift In",
    GIFT_OUT: "Gift Out",
    HARD_FORK: "Hard Fork",
    TOKEN_MIGRATION: "Token Migration",
    LOST_ASSET: "Lost Asset",
    MANUAL_ADJUSTMENT: "Manual Adjustment",
    UNKNOWN: "Unknown",
  };
  return labels[type] ?? type;
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case "CRITICAL":
      return "text-red-600 bg-red-50 border-red-200";
    case "WARNING":
      return "text-amber-600 bg-amber-50 border-amber-200";
    case "INFO":
      return "text-blue-600 bg-blue-50 border-blue-200";
    default:
      return "text-gray-600 bg-gray-50 border-gray-200";
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "NORMALIZED":
      return "text-green-700 bg-green-50";
    case "FLAGGED":
      return "text-amber-700 bg-amber-50";
    case "RESOLVED":
      return "text-blue-700 bg-blue-50";
    case "IGNORED":
      return "text-gray-500 bg-gray-50";
    default:
      return "text-gray-600 bg-gray-50";
  }
}
