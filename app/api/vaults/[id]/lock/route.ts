export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amount, requireKeyholder } = await req.json();
  if (!amount || amount <= 0) return NextResponse.json({ error: "Bad amount" }, { status: 400 });

  const vault = await prisma.vault.findFirst({ where: { id: params.id, userId: session.user.id }});
  if (!vault) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const unlocked = Math.max(0, vault.saved - vault.locked);
  const amt = Math.min(unlocked, amount);

  const updated = await prisma.$transaction(async (tx) => {
    const v = await tx.vault.update({
      where: { id: params.id },
      data: {
        locked: { increment: amt },
        isLocked: true,
        ...(typeof requireKeyholder === "boolean" ? { requireKeyholder } : {}),
      },
    });
    await tx.transaction.create({
      data: {
        userId: session.user.id,
        vaultId: v.id,
        type: "LOCK",
        amount: amt,
        description: "Locked funds",
      },
    });
    return v;
  });

  return NextResponse.json(updated);
}
