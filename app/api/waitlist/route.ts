import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !email.includes("@") || !email.includes(".")) {
      // Return generic success — never reveal validation details
      return NextResponse.json({ ok: true });
    }

    await prisma.waitlistEntry.upsert({
      where: { email },
      update: {},
      create: { email },
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Return generic success — never expose errors to the client
    return NextResponse.json({ ok: true });
  }
}
