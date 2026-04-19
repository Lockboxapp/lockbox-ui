// ============================================================
// app/api/unlock-requests/route.ts
// POST /api/unlock-requests  — submit an unlock request
// ============================================================
// SECURITY RULES:
//   - approvalToken is NEVER returned to the requesting user
//   - approvalToken is generated server-side via Prisma default
//   - Cooldown is enforced server-side — client cannot bypass it
//   - Box must be LOCKED status to submit a request
//   - Only one PENDING request allowed per box at a time
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BOX_STATUS, UNLOCK_STATUS } from "@/lib/types";
import { sendUnlockRequestToKeyholder, sendTransferRequestToKeyholder } from "@/lib/email";
import { captureServer } from "@/lib/posthog-server";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      boxId,
      reason,
      reflection,
      requestType = "UNLOCK",
      transferAmountInDollars,
      destinationBoxId,
      keyholderRelationshipId,
    } = body;

    if (!boxId || !reason) {
      return NextResponse.json(
        { error: "boxId and reason are required" },
        { status: 400 },
      );
    }

    const isTransfer = requestType === "TRANSFER";
    let transferAmountCents: number | null = null;
    let destinationBox: { id: string; name: string; userId: string; isClosed: boolean } | null = null;
    if (isTransfer) {
      const amt = Number(transferAmountInDollars);
      if (!Number.isFinite(amt) || amt < 1) {
        return NextResponse.json(
          { error: "transferAmountInDollars must be at least $1" },
          { status: 400 },
        );
      }
      if (!destinationBoxId) {
        return NextResponse.json(
          { error: "destinationBoxId is required for transfer requests" },
          { status: 400 },
        );
      }
      destinationBox = await prisma.box.findUnique({
        where: { id: destinationBoxId },
        select: { id: true, name: true, userId: true, isClosed: true },
      });
      if (!destinationBox || destinationBox.userId !== session.user.id || destinationBox.isClosed) {
        return NextResponse.json(
          { error: "Invalid destination box" },
          { status: 400 },
        );
      }
      if (destinationBoxId === boxId) {
        return NextResponse.json(
          { error: "Destination must be a different box" },
          { status: 400 },
        );
      }
      transferAmountCents = Math.round(amt * 100);
    }

    // Verify box exists and belongs to this user
    const box = await prisma.box.findUnique({
      where: { id: boxId },
      include: {
        keyholderScopes: {
          include: { relationship: { include: { profile: true } } },
        },
        unlockRequests: {
          where: { status: UNLOCK_STATUS.PENDING },
          orderBy: { requestedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!box) {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }

    if (box.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Box must be locked to submit an unlock request
    if (box.status !== BOX_STATUS.LOCKED) {
      return NextResponse.json({ error: "Box is not locked" }, { status: 400 });
    }

    // Sprint 6 — TRANSFER requests are only valid for KEYHOLDER boxes
    if (isTransfer && box.lockType !== "KEYHOLDER") {
      return NextResponse.json(
        { error: "Transfer requests only apply to KEYHOLDER boxes" },
        { status: 400 },
      );
    }

    if (isTransfer && transferAmountCents! > box.lockedAmount) {
      return NextResponse.json(
        { error: "Transfer amount exceeds the locked amount in this box" },
        { status: 400 },
      );
    }

    // Sprint 7 — KEYHOLDER requests require an active keyholder destination BEFORE we create anything.
    if (box.lockType === "KEYHOLDER") {
      const preCheck = await prisma.keyholderRelationship.findFirst({
        where: {
          userId: session.user.id,
          status: "ACTIVE",
          OR: [
            { scopeType: "ALL" },
            { scopeType: "SELECTED", boxes: { some: { boxId } } },
          ],
        },
        select: { id: true },
      });
      if (!preCheck) {
        return NextResponse.json(
          {
            error: "No active keyholder attached to this box.",
            code: "no_active_keyholder",
          },
          { status: 400 },
        );
      }
    }

    // Only one pending request allowed at a time
    if (box.unlockRequests.length > 0) {
      return NextResponse.json(
        { error: "A pending unlock request already exists for this box" },
        { status: 409 },
      );
    }

    // Enforce cooldown server-side — cannot be bypassed by the client
    const lastRequest = await prisma.unlockRequest.findFirst({
      where: { boxId },
      orderBy: { requestedAt: "desc" },
    });

    if (lastRequest?.cooldownUntil && lastRequest.cooldownUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (lastRequest.cooldownUntil.getTime() - Date.now()) / 1000 / 60,
      );
      return NextResponse.json(
        {
          error: `Cooldown active. Try again in ${minutesLeft} minute(s).`,
          cooldownUntil: lastRequest.cooldownUntil,
        },
        { status: 429 },
      );
    }

    // Create the unlock request
    // approvalToken is auto-generated by Prisma — never touches the client
    const unlockRequest = await prisma.unlockRequest.create({
      data: {
        boxId,
        reason: reason.trim(),
        reflection: reflection ? reflection.trim() : null,
        status: UNLOCK_STATUS.PENDING,
        requestType: isTransfer ? "TRANSFER" : "UNLOCK",
        transferAmount: transferAmountCents,
        destinationBoxId: isTransfer ? destinationBoxId : null,
        cooldownUntil: null,
      },
    });

    // Only full UNLOCK requests flip the box to UNLOCK_PENDING.
    // TRANSFER requests keep the box LOCKED — only funds move on approval.
    if (!isTransfer) {
      await prisma.box.update({
        where: { id: boxId },
        data: { status: BOX_STATUS.UNLOCK_PENDING },
      });
    }

    // Notify keyholder via email. If the client specified a particular relationship,
    // honor that choice (validated below); otherwise pick the first eligible ACTIVE one.
    type KHWithProfile = {
      id: string;
      profile: { email: string; name: string | null };
    };
    let activeRelationship: KHWithProfile | null = null;
    if (keyholderRelationshipId) {
      activeRelationship = await prisma.keyholderRelationship.findFirst({
        where: {
          id: keyholderRelationshipId,
          userId: session.user.id,
          status: "ACTIVE",
          OR: [
            { scopeType: "ALL" },
            { scopeType: "SELECTED", boxes: { some: { boxId } } },
          ],
        },
        include: { profile: true },
      });
    }
    if (!activeRelationship) {
      activeRelationship = await prisma.keyholderRelationship.findFirst({
        where: {
          userId: session.user.id,
          status: "ACTIVE",
          OR: [
            { scopeType: "ALL" },
            { scopeType: "SELECTED", boxes: { some: { boxId } } },
          ],
        },
        include: { profile: true },
      });
    }

    // Sprint 7 — KEYHOLDER boxes cannot create an unlock or transfer request without
    // an active keyholder to receive it. Block at the server so stale clients can't bypass.
    if (box.lockType === "KEYHOLDER" && !activeRelationship) {
      return NextResponse.json(
        {
          error: "No active keyholder attached to this box.",
          code: "no_active_keyholder",
        },
        { status: 400 },
      );
    }

    if (activeRelationship) {
      if (isTransfer && destinationBox) {
        await sendTransferRequestToKeyholder({
          keyholderEmail: activeRelationship.profile.email,
          keyholderName: activeRelationship.profile.name,
          ownerName: session.user.name,
          boxName: box.name,
          destinationName: destinationBox.name,
          amountDollars: (transferAmountCents ?? 0) / 100,
          reason,
          approvalToken: unlockRequest.approvalToken,
        });
      } else {
        await sendUnlockRequestToKeyholder({
          keyholderEmail: activeRelationship.profile.email,
          keyholderName: activeRelationship.profile.name,
          ownerName: session.user.name,
          boxName: box.name,
          reason,
          reflection,
          approvalToken: unlockRequest.approvalToken,
        });
      }

      await prisma.auditEvent.create({
        data: {
          actor: "SYSTEM",
          action: "OTP_SENT",
          targetId: unlockRequest.id,
          metadata: JSON.stringify({
            keyholderEmail: activeRelationship.profile.email,
          }),
        },
      });
    }
    // The keyholder email should contain:
    //   - The user's reason and reflection
    //   - An APPROVE link: /api/unlock-requests/[token]/approve
    //   - A DENY link:    /api/unlock-requests/[token]/deny
    // The approvalToken is: unlockRequest.approvalToken
    // NEVER send the approvalToken to the box owner under any circumstance

    // Return the request WITHOUT the approvalToken, plus the keyholder display name
    const { approvalToken: _, ...safeRequest } = unlockRequest;
    const keyholderName =
      activeRelationship?.profile.name ?? activeRelationship?.profile.email ?? null;

    await captureServer("unlock_requested", session.user.id, {
      lockType: box.lockType,
      requestType: isTransfer ? "TRANSFER" : "UNLOCK",
    });

    return NextResponse.json({ ...safeRequest, keyholderName }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/unlock-requests]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
