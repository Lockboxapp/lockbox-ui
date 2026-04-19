import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sendWelcomeEmail } from "@/lib/email";
import { z } from "zod";
import { captureServer } from "@/lib/posthog-server";

const signupSchema = z.object({
  name: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(8),
});

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = signupSchema.safeParse({
      ...body,
      email: typeof body?.email === "string" ? body.email.trim().toLowerCase() : "",
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "A valid email and password (min 8 characters) are required" },
        { status: 400 },
      );
    }

    const { name, email, password } = parsed.data;

    const passwordHash = await bcrypt.hash(password, 10);

    // 1) Create the user
    const user = await prisma.user.create({
      data: { name: name ?? null, email, passwordHash },
      select: { id: true, email: true, name: true },
    });

    // 2) Seed two default vaults (match schema fields exactly)
    await prisma.$transaction([
      prisma.vault.create({
        // First starter vault
        data: {
          userId: user.id,
          name: "Rent safe-deposit box",
          balance: 1200,
        },
      }),
      prisma.vault.create({
        // Second starter vault
        data: {
          userId: user.id,
          name: "Emergency fund",
          balance: 850,
        },
      }),
      // Sprint 4 — auto-create Wallet box for every new user
      prisma.box.create({
        data: {
          userId: user.id,
          name: "Wallet",
          status: "CREATED",
          lockType: "SOFT",
          isWallet: true,
          isClosed: false,
          balance: 0,
          lockedAmount: 0,
        },
      }),
    ]);

    // Send welcome email — non-blocking
    try {
      await sendWelcomeEmail({
        userEmail: email,
        userName: name ?? "",
      });
    } catch (err) {
      console.error("[signup] welcome email failed:", err);
    }

    await captureServer("user_signed_up", user.id);

    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (err: any) {
    // Handle unique email constraint
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 409 },
      );
    }
    console.error("Signup error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
