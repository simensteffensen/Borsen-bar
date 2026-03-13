"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function getIssues(
  workspaceId: string,
  opts: {
    status?: string;
    severity?: string;
    type?: string;
    page?: number;
    pageSize?: number;
  } = {}
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  const { page = 1, pageSize = 50, status, severity, type } = opts;

  const where: Record<string, unknown> = { workspaceId };
  if (status) where.resolutionStatus = status;
  if (severity) where.severity = severity;
  if (type) where.type = type;

  const [issues, total] = await Promise.all([
    prisma.issue.findMany({
      where,
      include: {
        linkedTx: { include: { asset: true } },
      },
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.issue.count({ where }),
  ]);

  return { issues, total, page, pageSize };
}

export async function getIssueCounts(workspaceId: string) {
  const [critical, warning, info, total] = await Promise.all([
    prisma.issue.count({ where: { workspaceId, severity: "CRITICAL", resolutionStatus: "OPEN" } }),
    prisma.issue.count({ where: { workspaceId, severity: "WARNING", resolutionStatus: "OPEN" } }),
    prisma.issue.count({ where: { workspaceId, severity: "INFO", resolutionStatus: "OPEN" } }),
    prisma.issue.count({ where: { workspaceId, resolutionStatus: "OPEN" } }),
  ]);
  return { critical, warning, info, total };
}

const resolveIssueSchema = z.object({
  issueId: z.string(),
  resolution: z.enum(["RESOLVED", "IGNORED"]),
  notes: z.string().optional(),
});

export async function resolveIssue(data: z.infer<typeof resolveIssueSchema>) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  const user = await prisma.user.findUniqueOrThrow({ where: { clerkId } });
  const validated = resolveIssueSchema.parse(data);

  const issue = await prisma.issue.update({
    where: { id: validated.issueId },
    data: {
      resolutionStatus: validated.resolution,
      resolvedAt: new Date(),
      resolvedById: user.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: issue.workspaceId,
      userId: user.id,
      action: `RESOLVE_ISSUE_${validated.resolution}`,
      entityType: "Issue",
      entityId: issue.id,
      metadata: { notes: validated.notes },
    },
  });

  revalidatePath(`/dashboard/${issue.workspaceId}/issues`);
  return issue;
}
