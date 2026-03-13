"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import Decimal from "decimal.js";

export interface HoldingRow {
  assetId: string;
  symbol: string;
  name: string | null;
  totalAmount: string;
  unrealizedCostBasisNok: string;
  currentValueNok: string | null;
  unrealizedGainLossNok: string | null;
  lotCount: number;
}

export async function getHoldings(workspaceId: string): Promise<HoldingRow[]> {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  // Aggregate remaining amounts from tax lots
  const lots = await prisma.taxLot.findMany({
    where: { workspaceId },
    include: { asset: true },
  });

  // Group by asset
  const byAsset = new Map<
    string,
    {
      asset: { id: string; symbol: string; name: string | null };
      totalAmount: Decimal;
      totalCostBasisNok: Decimal;
      lotCount: number;
    }
  >();

  for (const lot of lots) {
    const remaining = new Decimal(lot.remainingAmount.toString());
    if (remaining.lessThanOrEqualTo(0)) continue;

    const key = lot.assetId;
    if (!byAsset.has(key)) {
      byAsset.set(key, {
        asset: lot.asset,
        totalAmount: new Decimal(0),
        totalCostBasisNok: new Decimal(0),
        lotCount: 0,
      });
    }

    const entry = byAsset.get(key)!;
    entry.totalAmount = entry.totalAmount.plus(remaining);

    // Pro-rata cost basis
    const originalAmount = new Decimal(lot.originalAmount.toString());
    if (originalAmount.greaterThan(0)) {
      const fraction = remaining.div(originalAmount);
      entry.totalCostBasisNok = entry.totalCostBasisNok.plus(
        new Decimal(lot.costBasisNok.toString()).mul(fraction)
      );
    }
    entry.lotCount++;
  }

  const rows: HoldingRow[] = [];
  for (const [assetId, data] of byAsset) {
    rows.push({
      assetId,
      symbol: data.asset.symbol,
      name: data.asset.name,
      totalAmount: data.totalAmount.toFixed(8),
      unrealizedCostBasisNok: data.totalCostBasisNok.toFixed(2),
      currentValueNok: null, // Would come from pricing engine in production
      unrealizedGainLossNok: null,
      lotCount: data.lotCount,
    });
  }

  return rows.sort((a, b) =>
    parseFloat(b.unrealizedCostBasisNok) - parseFloat(a.unrealizedCostBasisNok)
  );
}

export async function getTaxLots(workspaceId: string, assetId?: string) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  return prisma.taxLot.findMany({
    where: {
      workspaceId,
      ...(assetId && { assetId }),
    },
    include: {
      asset: true,
      acquisitionTx: true,
    },
    orderBy: { acquisitionDate: "asc" },
  });
}
