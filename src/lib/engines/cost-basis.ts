// Cost Basis Engine
// Implements FIFO, LIFO, HIFO accounting methods for Norwegian tax reporting.
// All values in NOK. Uses Decimal.js for precision.

import Decimal from "decimal.js";
import type {
  TaxLot,
  DisposalMatch,
  DisposalResult,
  CostingMethod,
  TaxLotSource,
  CanonicalTx,
} from "@/lib/types";

Decimal.set({ precision: 36, rounding: Decimal.ROUND_HALF_UP });

export interface CostBasisEngineState {
  lots: Map<string, TaxLot[]>; // assetId -> sorted lots
}

export function createCostBasisEngine(
  existingLots: TaxLot[] = []
): CostBasisEngineState {
  const lots = new Map<string, TaxLot[]>();
  for (const lot of existingLots) {
    if (!lots.has(lot.assetId)) lots.set(lot.assetId, []);
    lots.get(lot.assetId)!.push(lot);
  }
  return { lots };
}

/**
 * Record an acquisition — creates a new tax lot.
 */
export function recordAcquisition(
  state: CostBasisEngineState,
  tx: CanonicalTx,
  costBasisNok: Decimal,
  sourceType: TaxLotSource
): TaxLot {
  const lot: TaxLot = {
    id: `lot_${tx.id}`,
    workspaceId: tx.workspaceId,
    assetId: tx.assetId,
    assetSymbol: tx.assetSymbol,
    acquisitionTxId: tx.id,
    acquisitionDate: tx.timestamp,
    originalAmount: tx.amount,
    remainingAmount: tx.amount,
    costBasisNok,
    sourceType,
    taxYear: tx.timestamp.getFullYear(),
  };

  if (!state.lots.has(tx.assetId)) state.lots.set(tx.assetId, []);
  state.lots.get(tx.assetId)!.push(lot);

  return lot;
}

/**
 * Process a disposal and match against existing lots.
 * Returns disposal result with matched lots, gain/loss, and warnings.
 */
export function processDisposal(
  state: CostBasisEngineState,
  tx: CanonicalTx,
  proceedsNok: Decimal,
  method: CostingMethod
): DisposalResult {
  const assetLots = state.lots.get(tx.assetId) ?? [];
  const availableLots = assetLots.filter((l) =>
    l.remainingAmount.greaterThan(0)
  );

  const warnings: string[] = [];
  const matches: DisposalMatch[] = [];

  let remainingToDispose = tx.amount.abs();
  let totalCostBasis = new Decimal(0);

  // Sort lots by the chosen method
  const sortedLots = sortLots(availableLots, method);

  if (availableLots.length === 0) {
    warnings.push(
      `No acquisition history found for ${tx.assetSymbol}. Cost basis is unknown.`
    );
  }

  let lotIndex = 0;
  while (remainingToDispose.greaterThan(0)) {
    if (lotIndex >= sortedLots.length) {
      warnings.push(
        `Insufficient lot history to cover disposal of ${remainingToDispose.toFixed(8)} ${tx.assetSymbol}. ` +
          `Missing cost basis will be recorded as zero (worst case).`
      );
      break;
    }

    const lot = sortedLots[lotIndex];
    const matchableAmount = Decimal.min(lot.remainingAmount, remainingToDispose);

    // Pro-rata cost basis
    const lotCostBasisPerUnit = lot.costBasisNok.div(lot.originalAmount);
    const allocatedCostBasis = lotCostBasisPerUnit.mul(matchableAmount);
    const proRataProceeds = proceedsNok
      .mul(matchableAmount)
      .div(tx.amount.abs());
    const gainLoss = proRataProceeds.minus(allocatedCostBasis);

    matches.push({
      id: `dm_${tx.id}_${lot.id}`,
      disposalTxId: tx.id,
      taxLotId: lot.id,
      matchedAmount: matchableAmount,
      allocatedCostBasisNok: allocatedCostBasis,
      proceedsNok: proRataProceeds,
      gainLossNok: gainLoss,
      costingMethod: method,
    });

    totalCostBasis = totalCostBasis.plus(allocatedCostBasis);

    // Update remaining lot amount (mutates state)
    lot.remainingAmount = lot.remainingAmount.minus(matchableAmount);
    remainingToDispose = remainingToDispose.minus(matchableAmount);
    lotIndex++;
  }

  const totalGainLoss = proceedsNok.minus(totalCostBasis);
  const confidence: DisposalResult["confidence"] =
    warnings.length === 0
      ? "full"
      : matches.length > 0
        ? "partial"
        : "estimated";

  return {
    disposalTxId: tx.id,
    assetId: tx.assetId,
    assetSymbol: tx.assetSymbol,
    timestamp: tx.timestamp,
    totalAmount: tx.amount.abs(),
    totalProceedsNok: proceedsNok,
    totalCostBasisNok: totalCostBasis,
    totalGainLossNok: totalGainLoss,
    matches,
    warnings,
    confidence,
  };
}

function sortLots(lots: TaxLot[], method: CostingMethod): TaxLot[] {
  switch (method) {
    case "FIFO":
      return [...lots].sort(
        (a, b) => a.acquisitionDate.getTime() - b.acquisitionDate.getTime()
      );
    case "LIFO":
      return [...lots].sort(
        (a, b) => b.acquisitionDate.getTime() - a.acquisitionDate.getTime()
      );
    case "HIFO":
      // Highest cost basis per unit first — minimizes gain
      return [...lots].sort((a, b) => {
        const costPerA = a.costBasisNok.div(a.originalAmount);
        const costPerB = b.costBasisNok.div(b.originalAmount);
        return costPerB.minus(costPerA).toNumber();
      });
    case "SPECIFIC_ID":
      // Placeholder — specific identification requires user selection
      // Fall back to FIFO
      return [...lots].sort(
        (a, b) => a.acquisitionDate.getTime() - b.acquisitionDate.getTime()
      );
    default:
      return lots;
  }
}

/**
 * Calculate current holdings for an asset.
 */
export function getHoldings(
  state: CostBasisEngineState,
  assetId: string
): { totalAmount: Decimal; totalCostBasisNok: Decimal; lotCount: number } {
  const lots = state.lots.get(assetId) ?? [];
  const activeLots = lots.filter((l) => l.remainingAmount.greaterThan(0));

  const totalAmount = activeLots.reduce(
    (sum, l) => sum.plus(l.remainingAmount),
    new Decimal(0)
  );

  // Pro-rata cost basis for remaining amounts
  const totalCostBasisNok = activeLots.reduce((sum, l) => {
    const fraction = l.originalAmount.greaterThan(0)
      ? l.remainingAmount.div(l.originalAmount)
      : new Decimal(0);
    return sum.plus(l.costBasisNok.mul(fraction));
  }, new Decimal(0));

  return { totalAmount, totalCostBasisNok, lotCount: activeLots.length };
}
