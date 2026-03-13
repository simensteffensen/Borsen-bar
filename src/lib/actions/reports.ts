"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import type { ReportType } from "@prisma/client";

export async function generateTaxReportAction(
  workspaceId: string,
  taxYear: number,
  _formData: FormData
): Promise<void> {
  await generateTaxReport(workspaceId, taxYear);
}

export async function generateTaxReport(
  workspaceId: string,
  taxYear: number,
  options: {
    costingMethod?: "FIFO" | "HIFO" | "LIFO";
    includeWealthTax?: boolean;
  } = {}
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  const { costingMethod = "FIFO" } = options;

  // Fetch all disposal matches for the year
  const disposals = await prisma.disposalMatch.findMany({
    where: {
      workspaceId,
      disposalTx: {
        timestamp: {
          gte: new Date(`${taxYear}-01-01`),
          lt: new Date(`${taxYear + 1}-01-01`),
        },
      },
    },
    include: {
      disposalTx: { include: { asset: true } },
      taxLot: true,
    },
  });

  // Aggregate gains and losses
  let totalGainNok = new Decimal(0);
  let totalLossNok = new Decimal(0);

  for (const match of disposals) {
    const gainLoss = new Decimal(match.gainLossNok.toString());
    if (gainLoss.greaterThan(0)) {
      totalGainNok = totalGainNok.plus(gainLoss);
    } else {
      totalLossNok = totalLossNok.plus(gainLoss.abs());
    }
  }

  const netGainLoss = totalGainNok.minus(totalLossNok);

  // Fetch income transactions
  const incomeTypes = [
    "STAKING_REWARD",
    "MINING_REWARD",
    "AIRDROP",
    "LENDING_INTEREST",
    "REFERRAL_REWARD",
    "YIELD_FARMING_REWARD",
    "GOVERNANCE_REWARD",
    "ROYALTY_INCOME",
  ];

  const incomeTxs = await prisma.canonicalTransaction.findMany({
    where: {
      workspaceId,
      type: { in: incomeTypes as never[] },
      timestamp: {
        gte: new Date(`${taxYear}-01-01`),
        lt: new Date(`${taxYear + 1}-01-01`),
      },
    },
    include: { asset: true },
  });

  let totalIncomeNok = new Decimal(0);
  for (const tx of incomeTxs) {
    if (tx.fiatValue) {
      totalIncomeNok = totalIncomeNok.plus(new Decimal(tx.fiatValue.toString()));
    }
  }

  // Open issues count
  const openIssues = await prisma.issue.count({
    where: { workspaceId, resolutionStatus: "OPEN" },
  });

  const summary = {
    taxYear,
    currency: "NOK",
    costingMethod,
    totalRealizedGainNok: totalGainNok.toFixed(2),
    totalRealizedLossNok: totalLossNok.toFixed(2),
    netRealizedGainLossNok: netGainLoss.toFixed(2),
    totalTaxableIncomeNok: totalIncomeNok.toFixed(2),
    disposalCount: disposals.length,
    incomeEventCount: incomeTxs.length,
    openIssueCount: openIssues,
    confidence: openIssues === 0 ? "high" : openIssues < 5 ? "medium" : "low",
    generatedAt: new Date().toISOString(),
  };

  const report = await prisma.taxReport.create({
    data: {
      workspaceId,
      taxYear,
      reportType: "TAX_SUMMARY" as ReportType,
      summary,
      assumptions: {
        costingMethod,
        country: "NO",
        rules: "Norway 2023+ rules",
      },
      status: "DRAFT",
    },
  });

  revalidatePath(`/dashboard/${workspaceId}/reports`);
  return report;
}

export async function getReports(workspaceId: string) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  return prisma.taxReport.findMany({
    where: { workspaceId },
    orderBy: [{ taxYear: "desc" }, { generatedAt: "desc" }],
  });
}

export async function getReportDetail(reportId: string) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  return prisma.taxReport.findUnique({ where: { id: reportId } });
}
