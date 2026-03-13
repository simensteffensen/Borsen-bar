// Unit tests for the cost basis engine
// Tests all required scenarios from the spec

import Decimal from "decimal.js";
import {
  createCostBasisEngine,
  recordAcquisition,
  processDisposal,
  getHoldings,
} from "@/lib/engines/cost-basis";
import type { CanonicalTx } from "@/lib/types";

function makeTx(overrides: Partial<CanonicalTx> = {}): CanonicalTx {
  return {
    id: `tx_${Math.random().toString(36).slice(2)}`,
    workspaceId: "ws_test",
    timestamp: new Date("2023-06-01"),
    type: "MARKET_BUY",
    assetId: "asset_btc",
    assetSymbol: "BTC",
    amount: new Decimal("1"),
    fiatCurrency: "NOK",
    direction: "IN",
    status: "NORMALIZED",
    ...overrides,
  };
}

describe("Cost Basis Engine", () => {
  describe("FIFO method", () => {
    it("simple buy and sell — full lot", () => {
      const state = createCostBasisEngine();

      const buyTx = makeTx({
        timestamp: new Date("2023-01-01"),
        amount: new Decimal("1"),
      });
      recordAcquisition(state, buyTx, new Decimal("200000"), "PURCHASE");

      const sellTx = makeTx({
        id: "sell_1",
        type: "MARKET_SELL",
        direction: "OUT",
        timestamp: new Date("2023-06-01"),
        amount: new Decimal("1"),
      });

      const result = processDisposal(state, sellTx, new Decimal("300000"), "FIFO");

      expect(result.totalProceedsNok.toFixed(2)).toBe("300000.00");
      expect(result.totalCostBasisNok.toFixed(2)).toBe("200000.00");
      expect(result.totalGainLossNok.toFixed(2)).toBe("100000.00");
      expect(result.matches).toHaveLength(1);
      expect(result.warnings).toHaveLength(0);
      expect(result.confidence).toBe("full");
    });

    it("FIFO — oldest lot consumed first", () => {
      const state = createCostBasisEngine();

      const buy1 = makeTx({ id: "buy1", timestamp: new Date("2022-01-01"), amount: new Decimal("1") });
      const buy2 = makeTx({ id: "buy2", timestamp: new Date("2023-01-01"), amount: new Decimal("1") });

      recordAcquisition(state, buy1, new Decimal("100000"), "PURCHASE"); // older, cheaper
      recordAcquisition(state, buy2, new Decimal("200000"), "PURCHASE"); // newer, more expensive

      const sell = makeTx({
        id: "sell1",
        type: "MARKET_SELL",
        direction: "OUT",
        amount: new Decimal("1"),
      });
      const result = processDisposal(state, sell, new Decimal("250000"), "FIFO");

      // Should use the oldest lot (100000 cost basis)
      expect(result.totalCostBasisNok.toFixed(2)).toBe("100000.00");
      expect(result.totalGainLossNok.toFixed(2)).toBe("150000.00");
    });

    it("HIFO — most expensive lot consumed first", () => {
      const state = createCostBasisEngine();

      const buy1 = makeTx({ id: "buy1", timestamp: new Date("2022-01-01"), amount: new Decimal("1") });
      const buy2 = makeTx({ id: "buy2", timestamp: new Date("2023-01-01"), amount: new Decimal("1") });

      recordAcquisition(state, buy1, new Decimal("100000"), "PURCHASE");
      recordAcquisition(state, buy2, new Decimal("200000"), "PURCHASE"); // most expensive

      const sell = makeTx({
        id: "sell1",
        type: "MARKET_SELL",
        direction: "OUT",
        amount: new Decimal("1"),
      });
      const result = processDisposal(state, sell, new Decimal("250000"), "HIFO");

      // Should use the most expensive lot (200000 cost basis)
      expect(result.totalCostBasisNok.toFixed(2)).toBe("200000.00");
      expect(result.totalGainLossNok.toFixed(2)).toBe("50000.00");
    });

    it("partial disposal — consumes part of a lot", () => {
      const state = createCostBasisEngine();

      const buy = makeTx({ amount: new Decimal("2") });
      recordAcquisition(state, buy, new Decimal("400000"), "PURCHASE");

      const sell = makeTx({
        id: "sell1",
        type: "MARKET_SELL",
        direction: "OUT",
        amount: new Decimal("1"),
      });
      const result = processDisposal(state, sell, new Decimal("250000"), "FIFO");

      expect(result.totalCostBasisNok.toFixed(2)).toBe("200000.00"); // half the lot
      expect(result.totalGainLossNok.toFixed(2)).toBe("50000.00");

      // Check remaining holdings
      const holdings = getHoldings(state, "asset_btc");
      expect(holdings.totalAmount.toFixed(8)).toBe("1.00000000");
    });

    it("partial disposal across multiple lots", () => {
      const state = createCostBasisEngine();

      const buy1 = makeTx({ id: "b1", timestamp: new Date("2022-01-01"), amount: new Decimal("1") });
      const buy2 = makeTx({ id: "b2", timestamp: new Date("2022-06-01"), amount: new Decimal("1") });

      recordAcquisition(state, buy1, new Decimal("100000"), "PURCHASE");
      recordAcquisition(state, buy2, new Decimal("200000"), "PURCHASE");

      const sell = makeTx({
        id: "s1",
        type: "MARKET_SELL",
        direction: "OUT",
        amount: new Decimal("1.5"),
      });
      const result = processDisposal(state, sell, new Decimal("225000"), "FIFO");

      expect(result.matches).toHaveLength(2);
      // First lot fully used (100k) + 0.5 of second lot (100k) = 200k cost basis
      expect(result.totalCostBasisNok.toFixed(2)).toBe("200000.00");
    });

    it("missing cost basis — warns but continues", () => {
      const state = createCostBasisEngine(); // empty — no lots

      const sell = makeTx({
        id: "sell_no_history",
        type: "MARKET_SELL",
        direction: "OUT",
        amount: new Decimal("1"),
      });
      const result = processDisposal(state, sell, new Decimal("300000"), "FIFO");

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.confidence).toBe("estimated");
    });

    it("staking reward creates lot with correct source type", () => {
      const state = createCostBasisEngine();

      const reward = makeTx({
        type: "STAKING_REWARD",
        direction: "IN",
        amount: new Decimal("0.01"),
      });
      const lot = recordAcquisition(state, reward, new Decimal("5000"), "REWARD");

      expect(lot.sourceType).toBe("REWARD");
      expect(lot.originalAmount.toFixed(8)).toBe("0.01000000");
      expect(lot.costBasisNok.toFixed(2)).toBe("5000.00");
    });

    it("fee in same asset reduces holdings", () => {
      const state = createCostBasisEngine();

      const buy = makeTx({ amount: new Decimal("1") });
      recordAcquisition(state, buy, new Decimal("200000"), "PURCHASE");

      // Fee of 0.001 BTC
      const fee = makeTx({
        id: "fee1",
        type: "FEE",
        direction: "OUT",
        amount: new Decimal("0.001"),
      });
      processDisposal(state, fee, new Decimal("200"), "FIFO");

      const holdings = getHoldings(state, "asset_btc");
      expect(holdings.totalAmount.toNumber()).toBeCloseTo(0.999, 6);
    });

    it("multi-year carry — lot from 2021 used in 2023 disposal", () => {
      const state = createCostBasisEngine();

      const oldBuy = makeTx({
        id: "old_buy",
        timestamp: new Date("2021-03-15"),
        amount: new Decimal("1"),
      });
      recordAcquisition(state, oldBuy, new Decimal("500000"), "PURCHASE");

      const sell2023 = makeTx({
        id: "sell_2023",
        type: "MARKET_SELL",
        direction: "OUT",
        timestamp: new Date("2023-11-01"),
        amount: new Decimal("1"),
      });
      const result = processDisposal(state, sell2023, new Decimal("350000"), "FIFO");

      expect(result.totalGainLossNok.toFixed(2)).toBe("-150000.00"); // loss
      expect(result.matches[0].taxLotId).toContain("old_buy");
    });
  });
});

describe("Norwegian Tax Rules", () => {
  it("swap is a taxable disposal", async () => {
    const { getNorwegianTaxRule } = await import("@/lib/engines/norwegian-tax-rules");
    const rule = getNorwegianTaxRule("SPOT_SWAP", 2023);
    expect(rule.isTaxableDisposal).toBe(true);
    expect(rule.createsTaxLot).toBe(true);
    expect(rule.consumesTaxLot).toBe(true);
  });

  it("self-transfer is not taxable", async () => {
    const { getNorwegianTaxRule } = await import("@/lib/engines/norwegian-tax-rules");
    const rule = getNorwegianTaxRule("SELF_TRANSFER", 2023);
    expect(rule.isTaxableDisposal).toBe(false);
    expect(rule.isTaxableIncomeOnReceipt).toBe(false);
    expect(rule.gainLossCategory).toBe("none");
  });

  it("staking reward is taxable income", async () => {
    const { getNorwegianTaxRule } = await import("@/lib/engines/norwegian-tax-rules");
    const rule = getNorwegianTaxRule("STAKING_REWARD", 2023);
    expect(rule.isTaxableIncomeOnReceipt).toBe(true);
    expect(rule.gainLossCategory).toBe("income");
    expect(rule.createsTaxLot).toBe(true);
  });

  it("market sell is taxable disposal with capital gain category", async () => {
    const { getNorwegianTaxRule } = await import("@/lib/engines/norwegian-tax-rules");
    const rule = getNorwegianTaxRule("MARKET_SELL", 2023);
    expect(rule.isTaxableDisposal).toBe(true);
    expect(rule.gainLossCategory).toBe("capital_gain");
    expect(rule.consumesTaxLot).toBe(true);
  });

  it("airdrop is taxable income and creates lot", async () => {
    const { getNorwegianTaxRule } = await import("@/lib/engines/norwegian-tax-rules");
    const rule = getNorwegianTaxRule("AIRDROP", 2023);
    expect(rule.isTaxableIncomeOnReceipt).toBe(true);
    expect(rule.createsTaxLot).toBe(true);
    expect(rule.requiresManualReview).toBe(true);
  });
});

describe("Transaction Classifier", () => {
  it("classifies Binance buy", async () => {
    const { classifyTransaction } = await import("@/lib/engines/classifier");
    const result = classifyTransaction({ rawType: "buy", provider: "binance" });
    expect(result.type).toBe("MARKET_BUY");
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it("classifies Binance staking reward", async () => {
    const { classifyTransaction } = await import("@/lib/engines/classifier");
    const result = classifyTransaction({ rawType: "Staking Rewards", provider: "binance" });
    expect(result.type).toBe("STAKING_REWARD");
  });

  it("classifies Coinbase convert as swap", async () => {
    const { classifyTransaction } = await import("@/lib/engines/classifier");
    const result = classifyTransaction({ rawType: "convert", provider: "coinbase" });
    expect(result.type).toBe("SPOT_SWAP");
  });

  it("falls back to UNKNOWN for unrecognized type", async () => {
    const { classifyTransaction } = await import("@/lib/engines/classifier");
    const result = classifyTransaction({ rawType: "some_completely_unknown_type_xyz" });
    expect(result.type).toBe("UNKNOWN");
    expect(result.requiresReview).toBe(true);
  });
});

describe("CSV Parser", () => {
  it("detects Coinbase format and parses row", async () => {
    const { parseCsv } = await import("@/lib/importers/csv-parser");
    const csv = `Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes
2023-01-15T10:00:00Z,Buy,BTC,0.1,USD,20000,2000,2010,10,
2023-02-10T14:00:00Z,Sell,ETH,1.0,USD,1500,1500,1490,10,`;

    const { mapper, rows, errors } = parseCsv(csv);
    expect(mapper.name).toBe("coinbase");
    expect(rows).toHaveLength(2);
    expect(errors).toHaveLength(0);
    expect(rows[0].type).toBe("Buy");
    expect(rows[0].asset).toBe("BTC");
  });
});
