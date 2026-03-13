"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  taxCountry: z.string().default("NO"),
  baseCurrency: z.string().default("NOK"),
});

export async function createWorkspace(formData: FormData) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  const user = await prisma.user.findUniqueOrThrow({
    where: { clerkId },
  });

  const data = createWorkspaceSchema.parse({
    name: formData.get("name"),
    taxCountry: formData.get("taxCountry"),
    baseCurrency: formData.get("baseCurrency"),
  });

  const workspace = await prisma.workspace.create({
    data: {
      ownerId: user.id,
      name: data.name,
      taxCountry: data.taxCountry,
      baseCurrency: data.baseCurrency,
    },
  });

  // Add owner as member
  await prisma.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      role: "OWNER",
    },
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard/${workspace.id}`);
}

export async function getWorkspaces() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return [];

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return [];

  return prisma.workspace.findMany({
    where: {
      members: { some: { userId: user.id } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getWorkspace(id: string) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  const user = await prisma.user.findUniqueOrThrow({ where: { clerkId } });

  return prisma.workspace.findFirst({
    where: {
      id,
      members: { some: { userId: user.id } },
    },
    include: {
      dataSources: true,
      _count: {
        select: {
          transactions: true,
          issues: { where: { resolutionStatus: "OPEN" } },
          taxReports: true,
        },
      },
    },
  });
}
