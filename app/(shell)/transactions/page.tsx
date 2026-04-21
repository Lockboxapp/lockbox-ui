// ============================================================
// app/(shell)/transactions/page.tsx
// All transactions for the signed-in user with filters + pagination
// ============================================================

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import TransactionsList, { BoxOption } from "./TransactionsList";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  const boxes = await prisma.box.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isClosed: "asc" }, { name: "asc" }],
    select: { id: true, name: true, isClosed: true, isWallet: true },
  });

  const boxOptions: BoxOption[] = boxes.map((b) => ({
    id: b.id,
    name: b.name,
    isClosed: b.isClosed,
    isWallet: b.isWallet,
  }));

  return (
    <div className="px-4 pt-4 pb-24 space-y-4 max-w-md mx-auto">
      <div className="pt-1">
        <h2 className="text-xl font-semibold text-gray-900">Transactions</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Every money movement across your boxes and Wallet.
        </p>
      </div>
      <TransactionsList boxes={boxOptions} />
    </div>
  );
}
