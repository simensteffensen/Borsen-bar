"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseCsv, computeChecksum } from "@/lib/importers/csv-parser";
import { classifyTransaction } from "@/lib/engines/classifier";
import type { DataSourceType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

const createDataSourceSchema = z.object({
  workspaceId: z.string(),
  type: z.enum(["EXCHANGE_API", "EXCHANGE_CSV", "WALLET_ADDRESS", "BLOCKCHAIN_ADDRESS", "MANUAL"]),
  providerName: z.string().min(1),
  label: z.string().min(1),
});

export async function createDataSource(formData: FormData) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  const user = await prisma.user.findUniqueOrThrow({ where: { clerkId } });

  const data = createDataSourceSchema.parse({
    workspaceId: formData.get("workspaceId"),
    type: formData.get("type"),
    providerName: formData.get("providerName"),
    label: formData.get("label"),
  });

  // Verify workspace membership
  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId: data.workspaceId, userId: user.id },
  });
  if (!member) throw new Error("Unauthorized");

  const dataSource = await prisma.dataSource.create({
    data: {
      workspaceId: data.workspaceId,
      type: data.type as DataSourceType,
      providerName: data.providerName,
      label: data.label,
    },
  });

  revalidatePath(`/dashboard/${data.workspaceId}/imports`);
  redirect(`/dashboard/${data.workspaceId}/imports`);
}

export async function importCsvFile(
  workspaceId: string,
  dataSourceId: string,
  csvText: string
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  const user = await prisma.user.findUniqueOrThrow({ where: { clerkId } });

  // Verify access
  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId: user.id },
  });
  if (!member) throw new Error("Unauthorized");

  // Update sync status
  await prisma.dataSource.update({
    where: { id: dataSourceId },
    data: { syncStatus: "RUNNING" },
  });

  try {
    const { mapper, rows, errors } = parseCsv(csvText);

    let importedCount = 0;
    let skippedCount = 0;
    const importErrors = [...errors];

    // Find or create base asset for ETH as example
    // In production, this would use asset resolution service
    for (const row of rows) {
      try {
        const checksum = await computeChecksum(row.rawData);

        // Skip duplicates
        const existing = await prisma.rawImportRecord.findUnique({
          where: { dataSourceId_checksum: { dataSourceId, checksum } },
        });

        if (existing) {
          skippedCount++;
          continue;
        }

        // Find or create asset
        const asset = await prisma.asset.upsert({
          where: {
            symbol_chain_contractAddress: {
              symbol: row.asset.toUpperCase(),
              chain: null as unknown as string,
              contractAddress: null as unknown as string,
            },
          },
          create: {
            symbol: row.asset.toUpperCase(),
            name: row.asset,
          },
          update: {},
        });

        // Classify transaction
        const classification = classifyTransaction({
          rawType: row.type,
          provider: mapper.name,
          amount: parseFloat(row.amount),
        });

        // Create raw import record
        await prisma.rawImportRecord.create({
          data: {
            workspaceId,
            dataSourceId,
            externalId: row.externalId,
            rawPayload: row.rawData as unknown as Prisma.InputJsonValue,
            checksum,

            // Create canonical transaction inline
            canonicalTransaction: {
              create: {
                workspaceId,
                timestamp: row.timestamp,
                type: classification.type,
                direction: classification.direction,
                assetId: asset.id,
                amount: Math.abs(parseFloat(row.amount)),
                fiatCurrency: "NOK",
                status: classification.requiresReview ? "FLAGGED" : "NORMALIZED",
                confidenceScore: classification.confidence,
                notes: row.notes,
                metadata: {
                  rawType: row.type,
                  classificationReason: classification.reason,
                  provider: mapper.name,
                },
              },
            },
          },
        });

        importedCount++;
      } catch (err) {
        importErrors.push({
          message: err instanceof Error ? err.message : "Unknown error",
          externalId: row.externalId,
        });
      }
    }

    await prisma.dataSource.update({
      where: { id: dataSourceId },
      data: {
        syncStatus: importErrors.length > 0 ? "PARTIAL" : "SUCCESS",
        lastSyncedAt: new Date(),
        importMetadata: {
          lastImport: {
            totalRows: rows.length,
            importedCount,
            skippedCount,
            errorCount: importErrors.length,
            mapper: mapper.name,
          },
        } as unknown as Prisma.InputJsonValue,
      },
    });

    revalidatePath(`/dashboard/${workspaceId}`);

    return {
      dataSourceId,
      totalRows: rows.length,
      importedCount,
      skippedCount,
      errorCount: importErrors.length,
      errors: importErrors,
      warnings: [],
    };
  } catch (err) {
    await prisma.dataSource.update({
      where: { id: dataSourceId },
      data: { syncStatus: "FAILED" },
    });
    throw err;
  }
}

export async function getDataSources(workspaceId: string) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  return prisma.dataSource.findMany({
    where: { workspaceId },
    include: {
      _count: { select: { rawImportRecords: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
