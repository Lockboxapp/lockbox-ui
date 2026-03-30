// ============================================================
// app/api/boxes/[id]/route.ts
// GET    /api/boxes/:id        — get a single box
// PATCH  /api/boxes/:id        — update box (including lock action)
// DELETE /api/boxes/:id        — close/delete a box
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BOX_STATUS } from "@/lib/types";

// ------------------------------------------------------------
// GET — fetch a single box by id (must belong to authed user)
// ------------------------------------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const box = await prisma.box.findUnique({
      where: { id: params.id },
      include: {
        keyholder: true,
        unlockRequests: {
          orderBy: { requestedAt: "desc" },
        },
      },
    });

    if (!box) {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }

    // Ensure the box belongs to the requesting user
    if (box.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(box);
  } catch (error) {
    console.error("[GET /api/boxes/:id]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ------------------------------------------------------------
// PATCH — update a box
// Handles general updates AND the lock action
// Body: { name?, description?, targetAmount?, action?: "lock" | "unlock", lockUntil? }
//
// LOCK RULES (server-enforced, never trust the client):
//   - Box must be in FUNDING status to lock
//   - lockUntil must be a future date
//   - Once locked, status moves to LOCKED server-side
// ------------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const box = await prisma.box.findUnique({
      where: { id: params.id },
    });

    if (!box) {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }

    if (box.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, targetAmount, action, lockUntil } = body;

    // --------------------------------------------------------
    // LOCK ACTION — server enforces all lock rules
    // --------------------------------------------------------
    if (action === "lock") {
      // Only boxes in CREATED or FUNDING status can be locked
      if (
        box.status !== BOX_STATUS.CREATED &&
        box.status !== BOX_STATUS.FUNDING
      ) {
        return NextResponse.json(
          { error: `Cannot lock a box with status: ${box.status}` },
          { status: 400 }
        );
      }

      if (!lockUntil) {
        return NextResponse.json(
          { error: "lockUntil is required to lock a box" },
          { status: 400 }
        );
      }

      const lockDate = new Date(lockUntil);

      // Lock date must be in the future
      if (lockDate <= new Date()) {
        return NextResponse.json(
          { error: "lockUntil must be a future date" },
          { status: 400 }
        );
      }

      const lockedBox = await prisma.box.update({
        where: { id: params.id },
        data: {
          status: BOX_STATUS.LOCKED,
          lockUntil: lockDate,
        },
        include: { keyholder: true },
      });

      return NextResponse.json(lockedBox);
    }

    // --------------------------------------------------------
    // GENERAL UPDATE — name, description, targetAmount
    // --------------------------------------------------------
    const updatedBox = await prisma.box.update({
      where: { id: params.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description }),
        ...(targetAmount !== undefined && {
          targetAmount: targetAmount ? Math.round(targetAmount * 100) : null,
        }),
      },
    });

    return NextResponse.json(updatedBox);
  } catch (error) {
    console.error("[PATCH /api/boxes/:id]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ------------------------------------------------------------
// DELETE — close a box (sets status to CLOSED)
// Hard delete is not allowed — we keep the record for audit trail
// ------------------------------------------------------------
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const box = await prisma.box.findUnique({
      where: { id: params.id },
    });

    if (!box) {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }

    if (box.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Cannot close a locked box — must go through unlock flow first
    if (box.status === BOX_STATUS.LOCKED) {
      return NextResponse.json(
        { error: "Cannot close a locked box. Submit an unlock request first." },
        { status: 400 }
      );
    }

    const closedBox = await prisma.box.update({
      where: { id: params.id },
      data: { status: BOX_STATUS.CLOSED },
    });

    return NextResponse.json(closedBox);
  } catch (error) {
    console.error("[DELETE /api/boxes/:id]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
