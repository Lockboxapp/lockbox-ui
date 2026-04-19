// ============================================================
// app/api/keyholder/optout/route.ts
// GET  — returns opt-out context for the page (owner name, box count)
// POST — processes opt-out, sets REVOKED + revokedBy='KEYHOLDER', notifies owner
// ============================================================
// No session auth. Token IS the auth — matches the /keyholder approval page pattern.
// Token is base64(KeyholderRelationship.id). Owner is notified regardless of
// whether boxes were affected.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendKeyholderOptOutOwnerNotice } from "@/lib/email";

function decodeToken(token: string): string | null {
  try {
    return Buffer.from(token, "base64").toString("utf8");
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") ?? "";
  const id = decodeToken(token);
  if (!id) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const rel = await prisma.keyholderRelationship.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
      boxes: { include: { box: { select: { id: true, isClosed: true } } } },
    },
  });

  if (!rel) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  const alreadyRevoked = rel.status === "REVOKED";

  // boxCount: for SELECTED scope, count linked open boxes; for ALL scope,
  // count the owner's active non-closed KEYHOLDER boxes.
  let boxCount = 0;
  if (rel.scopeType === "SELECTED") {
    boxCount = rel.boxes.filter((b) => !b.box.isClosed).length;
  } else {
    boxCount = await prisma.box.count({
      where: {
        userId: rel.userId,
        isClosed: false,
        lockType: "KEYHOLDER",
      },
    });
  }

  return NextResponse.json({
    ownerName: rel.user.name ?? rel.user.email ?? null,
    boxCount,
    alreadyRevoked,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token : "";
    const id = decodeToken(token);
    if (!id) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const rel = await prisma.keyholderRelationship.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true } },
        profile: true,
        boxes: { include: { box: { select: { id: true, name: true, isClosed: true } } } },
      },
    });

    if (!rel) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
    }

    if (rel.status === "REVOKED") {
      // Idempotent: repeat clicks get a friendly OK, not an error.
      return NextResponse.json({ ok: true, alreadyRevoked: true });
    }

    await prisma.keyholderRelationship.update({
      where: { id: rel.id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revokedBy: "KEYHOLDER",
      },
    });

    await prisma.auditEvent.create({
      data: {
        actor: "KEYHOLDER",
        actorId: rel.profileId,
        action: "KEYHOLDER_OPT_OUT",
        targetId: rel.id,
        metadata: JSON.stringify({ ownerId: rel.userId }),
      },
    });

    // Compute affected box names for the notification.
    let affected: string[] = [];
    if (rel.scopeType === "SELECTED") {
      affected = rel.boxes
        .filter((b) => !b.box.isClosed)
        .map((b) => b.box.name);
    } else {
      const allBoxes = await prisma.box.findMany({
        where: {
          userId: rel.userId,
          isClosed: false,
          lockType: "KEYHOLDER",
        },
        select: { name: true },
      });
      affected = allBoxes.map((b) => b.name);
    }

    // Notify the owner (best-effort — do not fail the opt-out if the email fails).
    if (rel.user.email) {
      const keyholderDisplay = rel.profile.name
        ? `${rel.profile.name} (${rel.profile.email})`
        : rel.profile.email;
      try {
        await sendKeyholderOptOutOwnerNotice({
          to: rel.user.email,
          ownerName: rel.user.name ?? null,
          keyholderDisplay,
          affectedBoxNames: affected,
        });
      } catch (err) {
        console.error("[keyholder/optout] owner notice email failed:", err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/keyholder/optout]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
