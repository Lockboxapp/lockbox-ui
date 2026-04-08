// prisma/seed.cjs

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const email = "demo@lockbox.com";
  const passwordHash = await bcrypt.hash("test1234", 10);

  // Idempotent user
  const user = await prisma.user.upsert({
    where: { email },
    update: {}, // nothing to update for now
    create: { name: "Demo User", email, passwordHash },
  });

  // Idempotent preferences (1:1)
  await prisma.preferences.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      currency: "USD",
      language: "en",
      theme: "light",
      notifications: true,
      dailySummary: true,
      pushApprovals: true,
    },
  });

  // ---- Categories (no skipDuplicates on SQLite) ----
  const ensureCategory = async (name, type) => {
    const existing = await prisma.category.findFirst({
      where: { userId: user.id, name },
      select: { id: true },
    });
    if (!existing) {
      await prisma.category.create({
        data: { name, type, userId: user.id },
      });
    }
    return prisma.category.findFirst({
      where: { userId: user.id, name },
    });
  };

  const incomeCat = await ensureCategory("Salary", "INCOME");
  const expenseCat = await ensureCategory("Groceries", "EXPENSE");

  // ---- Vault (idempotent) ----
  let rentVault = await prisma.vault.findFirst({
    where: { userId: user.id, name: "Rent Vault" },
  });
  if (!rentVault) {
    rentVault = await prisma.vault.create({
      data: { name: "Rent Vault", balance: 100000, userId: user.id }, // $1,000
    });
  }

  // ---- Transactions (only create once) ----
  const txCount = await prisma.transaction.count({
    where: { userId: user.id },
  });
  if (txCount === 0) {
    await prisma.transaction.createMany({
      data: [
        {
          userId: user.id,
          vaultId: rentVault.id,
          categoryId: incomeCat?.id ?? null,
          type: "INCOME",
          amount: 250000, // $2,500
          description: "First paycheck",
          postedAt: new Date(),
        },
        {
          userId: user.id,
          vaultId: rentVault.id,
          categoryId: expenseCat?.id ?? null,
          type: "DEPOSIT",
          amount: 100000, // $1,000
          description: "Initial deposit to rent vault",
          postedAt: new Date(),
        },
      ],
    });
  }

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
