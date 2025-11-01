import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const vaults = await prisma.vault.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      balance: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(vaults, { status: 200 });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  // minimal validation + mapping
  const name = String(body.name || "").trim();
  const target = Number(body.target || 0);
  const dueDate = body.dueDate ? new Date(body.dueDate) : null;
  const requireKeyholder = Boolean(body.requireKeyholder);

  if (!name)
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!Number.isFinite(target) || target <= 0)
    return NextResponse.json(
      { error: "Target must be a positive number" },
      { status: 400 }
    );

  const created = await prisma.vault.create({
    data: {
      userId,
      name,
      target,
      saved: 0,
      locked: 0,
      dueDate,
      isLocked: false,
      requireKeyholder,
    },
    select: {
      id: true,
      name: true,
      target: true,
      saved: true,
      locked: true,
      dueDate: true,
      isLocked: true,
      requireKeyholder: true,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
