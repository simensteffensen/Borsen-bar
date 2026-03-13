"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { revalidatePath } from "next/cache";

export async function getTransactions(
  workspaceId: string,
  opts: {
    page?: number;
    pageSize?: number;
    status?: string;
    type?: string;
    assetSymbol?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  const {
    page = 1,
    pageSize = 50,
    status,
    type,
    assetSymbol,
    startDate,
    endDate,
  } = opts;

  const where: Record<string, unknown> = { workspaceId };
  if (status) where.status = status;
  if (type) where.type = type;
  if (assetSymbol) {
    where.asset = { symbol: { equals: assetSymbol, mode: "insensitive" } };
  }
  if (startDate || endDate) {
    where.timestamp = {
      ...(startDate && { gte: startDate }),
      ...(endDate && { lte: endDate }),
    };
  }

  const [transactions, total] = await Promise.all([
    prisma.canonicalTransaction.findMany({
      where,
      include: {
        asset: true,
        feeAsset: true,
        sourceAccount: true,
        destinationAccount: true,
        issues: { where: { resolutionStatus: "OPEN" } },
      },
      orderBy: { timestamp: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.canonicalTransaction.count({ where }),
  ]);

  return { transactions, total, page, pageSize };
}

export async function getTransactionDetail(txId: string) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  return prisma.canonicalTransaction.findUnique({
    where: { id: txId },
    include: {
      asset: true,
      feeAsset: true,
      sourceAccount: true,
      destinationAccount: true,
      rawRecord: true,
      taxLots: true,
      disposalMatches: {
        include: { taxLot: { include: { asset: true } } },
      },
      issues: true,
      transactionGroup: true,
    },
  });
}

const overrideSchema = z.object({
  txId: z.string(),
  type: z.string().optional(),
  taxable: z.boolean().optional(),
  notes: z.string().optional(),
  status: z.enum(["NORMALIZED", "FLAGGED", "RESOLVED", "IGNORED"]).optional(),
});

export async function overrideTransaction(data: z.infer<typeof overrideSchema>) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  const user = await prisma.user.findUniqueOrThrow({ where: { clerkId } });
  const validated = overrideSchema.parse(data);

  const tx = await prisma.canonicalTransaction.findUniqueOrThrow({
    where: { id: validated.txId },
  });

  const before = { type: tx.type, taxable: tx.taxable, notes: tx.notes, status: tx.status };

  const updated = await prisma.canonicalTransaction.update({
    where: { id: validated.txId },
    data: {
      ...(validated.type && { type: validated.type as never }),
      ...(validated.taxable !== undefined && { taxable: validated.taxable }),
      ...(validated.notes !== undefined && { notes: validated.notes }),
      ...(validated.status && { status: validated.status }),
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      workspaceId: tx.workspaceId,
      userId: user.id,
      action: "OVERRIDE_TRANSACTION",
      entityType: "CanonicalTransaction",
      entityId: tx.id,
      before,
      after: {
        type: updated.type,
        taxable: updated.taxable,
        notes: updated.notes,
        status: updated.status,
      },
    },
  });

  revalidatePath(`/dashboard/${tx.workspaceId}/transactions`);
  return updated;
}
