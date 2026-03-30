// ============================================================
// app/api/boxes/route.ts
// GET  /api/boxes  — list all boxes for the authed user
// POST /api/boxes  — create a new box
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BOX_STATUS } from "@/lib/types";

// ------------------------------------------------------------
// GET — return all boxes for the authenticated user
// ------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const boxes = await prisma.box.findMany({
      where: { userId: session.user.id },
      include: {
        keyholder: true,
        unlockRequests: {
          where: { status: "PENDING" },
          orderBy: { requestedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(boxes);
  } catch (error) {
    console.error("[GET /api/boxes]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ------------------------------------------------------------
// POST — create a new box for the authenticated user
// ------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, targetAmount, lockUntil } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const box = await prisma.box.create({
      data: {
        name: name.trim(),
        description: description ?? null,
        targetAmount: targetAmount ? Math.round(targetAmount * 100) : null,
        lockUntil: lockUntil ? new Date(lockUntil) : null,
        status: BOX_STATUS.CREATED,
        userId: session.user.id,
      },
    });

    return NextResponse.json(box, { status: 201 });
  } catch (error) {
    console.error("[POST /api/boxes]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
