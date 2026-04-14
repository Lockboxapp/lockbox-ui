import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse({
      email: typeof body?.email === "string" ? body.email.trim().toLowerCase() : "",
    });

    // Always return generic success — never reveal if email is invalid or already exists
    if (!parsed.success) {
      return NextResponse.json({ ok: true });
    }

    await prisma.waitlistEntry.upsert({
      where: { email: parsed.data.email },
      update: {},
      create: { email: parsed.data.email },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
