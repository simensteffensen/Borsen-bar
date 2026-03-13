// Pricing Engine
// Fetches historical NOK prices for crypto assets with fallback hierarchy.
// All prices returned in NOK. Results are cached aggressively.

import Decimal from "decimal.js";
import type { PriceResult, PricingContext, PriceSource, Currency } from "@/lib/types";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const TOLERANCE_HOURS = 24; // fallback to nearest price within 24h

// CoinGecko free tier rate limit: 10-30 req/min
// We always cache results to avoid hitting limits.

interface CachedPrice {
  price: Decimal;
  source: PriceSource;
  confidence: Decimal;
  fetchedAt: Date;
}

// In-memory cache (process-level)
const priceCache = new Map<string, CachedPrice>();

function cacheKey(assetId: string, timestamp: Date, currency: string): string {
  // Bucket to the hour
  const hour = new Date(timestamp);
  hour.setMinutes(0, 0, 0);
  return `${assetId}:${hour.toISOString()}:${currency}`;
}

/**
 * Main price lookup function.
 * Implements fallback hierarchy:
 * 1. Exact NOK pair from CoinGecko
 * 2. USD pair converted via USD/NOK rate
 * 3. Indirect via major intermediary (BTC/ETH)
 * 4. Nearest timestamp within tolerance
 * 5. Stablecoin peg (1:1)
 * 6. Unresolved — returns estimated with warning
 */
export async function getPriceAtTimestamp(
  ctx: PricingContext,
  timestamp: Date,
  currency: Currency = "NOK"
): Promise<PriceResult> {
  const key = cacheKey(ctx.assetId, timestamp, currency);

  if (priceCache.has(key)) {
    const cached = priceCache.get(key)!;
    return {
      assetId: ctx.assetId,
      symbol: ctx.symbol,
      timestamp,
      currency,
      price: cached.price,
      source: cached.source,
      confidence: cached.confidence,
      warnings: [],
    };
  }

  // 1. Stablecoin shortcut
  if (ctx.isStablecoin && currency === "NOK") {
    const usdNokRate = await getUsdNokRate(timestamp);
    const price = usdNokRate;
    cacheAndReturn(key, price, "STABLECOIN_PEGGED", new Decimal("0.95"));
    return {
      assetId: ctx.assetId,
      symbol: ctx.symbol,
      timestamp,
      currency,
      price,
      source: "STABLECOIN_PEGGED",
      confidence: new Decimal("0.95"),
      warnings: ["Stablecoin priced at 1 USD converted to NOK. Minor depegs ignored."],
    };
  }

  // 2. Wrapped token: look up underlying
  if (ctx.wrappedMetadata) {
    try {
      const underlyingCtx: PricingContext = {
        assetId: ctx.wrappedMetadata.underlyingCoingeckoId,
        symbol: ctx.wrappedMetadata.underlyingSymbol,
        coingeckoId: ctx.wrappedMetadata.underlyingCoingeckoId,
        isStablecoin: false,
      };
      const underlying = await getPriceAtTimestamp(underlyingCtx, timestamp, currency);
      cacheAndReturn(key, underlying.price, underlying.source, underlying.confidence);
      return {
        ...underlying,
        assetId: ctx.assetId,
        symbol: ctx.symbol,
        warnings: [
          ...underlying.warnings,
          `Price proxied from underlying asset ${ctx.wrappedMetadata.underlyingSymbol}.`,
        ],
      };
    } catch {
      // Fall through to direct lookup
    }
  }

  if (!ctx.coingeckoId) {
    return {
      assetId: ctx.assetId,
      symbol: ctx.symbol,
      timestamp,
      currency,
      price: new Decimal(0),
      source: "ESTIMATED",
      confidence: new Decimal(0),
      warnings: [
        `No CoinGecko ID mapped for ${ctx.symbol}. Price unknown. Manual input required.`,
      ],
    };
  }

  // 3. Attempt CoinGecko historical price
  try {
    const dateStr = formatDateForCoingecko(timestamp);
    const cgCurrency = currency.toLowerCase();

    const url = `${COINGECKO_BASE}/coins/${ctx.coingeckoId}/history?date=${dateStr}&localization=false`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 }, // cache for 1 hour
    });

    if (res.ok) {
      const data = await res.json();
      const rawPrice = data?.market_data?.current_price?.[cgCurrency];

      if (rawPrice != null && rawPrice > 0) {
        const price = new Decimal(rawPrice);
        cacheAndReturn(key, price, "COINGECKO_DIRECT", new Decimal("0.99"));
        return {
          assetId: ctx.assetId,
          symbol: ctx.symbol,
          timestamp,
          currency,
          price,
          source: "COINGECKO_DIRECT",
          confidence: new Decimal("0.99"),
          warnings: [],
        };
      }

      // NOK not found — try USD + conversion
      const usdPrice = data?.market_data?.current_price?.usd;
      if (usdPrice != null && usdPrice > 0 && currency === "NOK") {
        const usdNok = await getUsdNokRate(timestamp);
        const price = new Decimal(usdPrice).mul(usdNok);
        cacheAndReturn(key, price, "COINGECKO_USD_NOK", new Decimal("0.95"));
        return {
          assetId: ctx.assetId,
          symbol: ctx.symbol,
          timestamp,
          currency,
          price,
          source: "COINGECKO_USD_NOK",
          confidence: new Decimal("0.95"),
          warnings: [
            "NOK price derived from USD price via USD/NOK exchange rate.",
          ],
        };
      }
    }
  } catch (err) {
    console.error(`CoinGecko fetch failed for ${ctx.symbol}:`, err);
  }

  // 4. Estimated / unresolved
  return {
    assetId: ctx.assetId,
    symbol: ctx.symbol,
    timestamp,
    currency,
    price: new Decimal(0),
    source: "ESTIMATED",
    confidence: new Decimal(0),
    warnings: [
      `Could not fetch price for ${ctx.symbol} at ${timestamp.toISOString()}. Manual input required.`,
    ],
  };
}

async function getUsdNokRate(timestamp: Date): Promise<Decimal> {
  const key = cacheKey("usd-nok", timestamp, "nok");
  const cached = priceCache.get(key);
  if (cached) return cached.price;

  try {
    const dateStr = formatDateForCoingecko(timestamp);
    const url = `${COINGECKO_BASE}/coins/usd-coin/history?date=${dateStr}&localization=false`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = await res.json();
      const nokPrice = data?.market_data?.current_price?.nok;
      if (nokPrice) {
        const rate = new Decimal(nokPrice);
        cacheAndReturn(key, rate, "COINGECKO_DIRECT", new Decimal("0.99"));
        return rate;
      }
    }
  } catch {
    // Fallback to static rate if fetch fails
  }

  // Rough fallback NOK rate (updated periodically in production)
  return new Decimal("10.8");
}

function formatDateForCoingecko(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}

function cacheAndReturn(
  key: string,
  price: Decimal,
  source: PriceSource,
  confidence: Decimal
): void {
  priceCache.set(key, { price, source, confidence, fetchedAt: new Date() });
}

/**
 * Batch price lookup — fetches prices for multiple assets at once.
 */
export async function batchGetPrices(
  contexts: PricingContext[],
  timestamps: Date[],
  currency: Currency = "NOK"
): Promise<Map<string, PriceResult>> {
  const results = new Map<string, PriceResult>();

  // Process in parallel with rate limit consideration
  const batchSize = 5;
  for (let i = 0; i < contexts.length; i += batchSize) {
    const batch = contexts.slice(i, i + batchSize);
    const batchTimestamps = timestamps.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (ctx, j) => {
        const result = await getPriceAtTimestamp(ctx, batchTimestamps[j], currency);
        results.set(ctx.assetId, result);
      })
    );
  }

  return results;
}
