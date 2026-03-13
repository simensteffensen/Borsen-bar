// CSV Import Parser
// Handles exchange CSV imports and maps to RawTransaction format.
// Each exchange has its own column mapper.

import type { RawTransaction, ImportResult, ImportError } from "@/lib/types";
import { classifyTransaction } from "@/lib/engines/classifier";

export interface CsvRow {
  [key: string]: string;
}

export interface ExchangeMapper {
  name: string;
  detectColumns(headers: string[]): boolean;
  mapRow(row: CsvRow): RawTransaction | null;
}

// ─────────────────────────────────────────────
// BINANCE MAPPER
// ─────────────────────────────────────────────

const binanceMapper: ExchangeMapper = {
  name: "binance",
  detectColumns(headers) {
    const lower = headers.map((h) => h.toLowerCase());
    return lower.includes("utc_time") && lower.includes("operation");
  },
  mapRow(row) {
    const rawType = row["Operation"] ?? row["operation"] ?? "";
    if (!rawType) return null;

    const classification = classifyTransaction({
      rawType,
      provider: "binance",
    });

    return {
      externalId: row["Order_ID"] || undefined,
      timestamp: parseDate(row["UTC_Time"] ?? row["utc_time"]),
      type: rawType,
      asset: row["Coin"] ?? row["coin"] ?? "",
      amount: row["Change"] ?? row["change"] ?? "0",
      feeAsset: undefined,
      feeAmount: undefined,
      price: undefined,
      currency: "USD",
      txHash: undefined,
      notes: rawType,
      rawData: row,
    };
  },
};

// ─────────────────────────────────────────────
// COINBASE MAPPER
// ─────────────────────────────────────────────

const coinbaseMapper: ExchangeMapper = {
  name: "coinbase",
  detectColumns(headers) {
    const lower = headers.map((h) => h.toLowerCase());
    return (
      lower.includes("transaction type") &&
      lower.includes("asset") &&
      lower.includes("quantity transacted")
    );
  },
  mapRow(row) {
    const rawType = row["Transaction Type"] ?? "";
    return {
      externalId: undefined,
      timestamp: parseDate(row["Timestamp"]),
      type: rawType,
      asset: row["Asset"] ?? "",
      amount: row["Quantity Transacted"] ?? "0",
      feeAsset: "USD",
      feeAmount: row["Fees and/or Spread"] ?? undefined,
      price: row["Spot Price at Transaction"] ?? undefined,
      currency: row["Spot Price Currency"] ?? "USD",
      txHash: undefined,
      notes: row["Notes"] ?? rawType,
      rawData: row,
    };
  },
};

// ─────────────────────────────────────────────
// KRAKEN MAPPER
// ─────────────────────────────────────────────

const krakenMapper: ExchangeMapper = {
  name: "kraken",
  detectColumns(headers) {
    const lower = headers.map((h) => h.toLowerCase());
    return lower.includes("txid") && lower.includes("type") && lower.includes("asset");
  },
  mapRow(row) {
    const rawType = row["type"] ?? "";
    return {
      externalId: row["txid"] ?? undefined,
      timestamp: parseDate(row["time"]),
      type: rawType,
      asset: normalizeKrakenAsset(row["asset"] ?? ""),
      amount: row["amount"] ?? "0",
      feeAsset: normalizeKrakenAsset(row["asset"] ?? ""),
      feeAmount: row["fee"] ?? undefined,
      price: undefined,
      currency: "USD",
      txHash: row["refid"] ?? undefined,
      notes: rawType,
      rawData: row,
    };
  },
};

function normalizeKrakenAsset(asset: string): string {
  // Kraken prefixes assets with X or Z
  const map: Record<string, string> = {
    XXBT: "BTC",
    XETH: "ETH",
    ZUSD: "USD",
    ZEUR: "EUR",
    XLTC: "LTC",
    XXLM: "XLM",
    XREP: "REP",
    XZEC: "ZEC",
  };
  return map[asset] ?? asset.replace(/^[XZ]/, "");
}

// ─────────────────────────────────────────────
// GENERIC / UNIVERSAL CSV MAPPER
// ─────────────────────────────────────────────

const genericMapper: ExchangeMapper = {
  name: "generic",
  detectColumns(_headers) {
    return true; // Fallback — always matches
  },
  mapRow(row) {
    // Try to find common column names
    const dateVal = row["date"] ?? row["Date"] ?? row["timestamp"] ?? row["Timestamp"] ?? row["time"];
    const typeVal = row["type"] ?? row["Type"] ?? row["operation"] ?? row["Operation"] ?? "unknown";
    const assetVal = row["asset"] ?? row["Asset"] ?? row["currency"] ?? row["Currency"] ?? row["coin"] ?? "";
    const amountVal = row["amount"] ?? row["Amount"] ?? row["quantity"] ?? row["Quantity"] ?? "0";

    if (!dateVal) return null;

    return {
      externalId: row["id"] ?? row["ID"] ?? undefined,
      timestamp: parseDate(dateVal),
      type: typeVal,
      asset: assetVal,
      amount: amountVal,
      feeAsset: row["fee_currency"] ?? row["Fee Currency"] ?? undefined,
      feeAmount: row["fee"] ?? row["Fee"] ?? undefined,
      price: row["price"] ?? row["Price"] ?? undefined,
      currency: row["currency"] ?? row["Currency"] ?? "USD",
      txHash: row["tx_hash"] ?? row["TxHash"] ?? row["hash"] ?? undefined,
      notes: row["notes"] ?? row["Notes"] ?? row["description"] ?? undefined,
      rawData: row,
    };
  },
};

const MAPPERS: ExchangeMapper[] = [
  binanceMapper,
  coinbaseMapper,
  krakenMapper,
  genericMapper,
];

/**
 * Auto-detect exchange from CSV headers and parse rows.
 */
export function parseCsv(csvText: string): {
  mapper: ExchangeMapper;
  rows: RawTransaction[];
  errors: ImportError[];
} {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return { mapper: genericMapper, rows: [], errors: [{ message: "CSV is empty or has no data rows" }] };
  }

  const headers = parseCsvLine(lines[0]);
  const mapper = MAPPERS.find((m) => m.detectColumns(headers)) ?? genericMapper;

  const rows: RawTransaction[] = [];
  const errors: ImportError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const values = parseCsvLine(line);
      const row: CsvRow = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] ?? "";
      });

      const tx = mapper.mapRow(row);
      if (tx) rows.push(tx);
    } catch (err) {
      errors.push({
        row: i + 1,
        message: err instanceof Error ? err.message : "Parse error",
      });
    }
  }

  return { mapper, rows, errors };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseDate(dateStr: string): Date {
  if (!dateStr) throw new Error("Missing date");
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${dateStr}`);
  return d;
}

/**
 * Compute checksum for deduplication.
 */
export async function computeChecksum(data: unknown): Promise<string> {
  const text = JSON.stringify(data);
  const encoder = new TextEncoder();
  const buffer = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
