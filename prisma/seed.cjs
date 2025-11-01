const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const passwordHash = await bcrypt.hash("test1234", 10);
  const user = await prisma.user.create({
    data: {
      name: "Demo User",
      email: "demo2@lockbox.com",
      passwordHash,
      preferences: {
        create: {
          currency: "USD",
          language: "en",
          theme: "light",
          notifications: true,
        },
      },
    },
  });

  await prisma.vault.createMany({
    data: [
      {
        userId: user.id,
        name: "Rent safe-deposit box",
        target: 1500,
        saved: 500,
        locked: 300,
        isLocked: true,
        requireKeyholder: true,
      },
      {
        userId: user.id,
        name: "Emergency fund",
        target: 2000,
        saved: 1000,
        locked: 0,
        isLocked: false,
        requireKeyholder: false,
      },
    ],
  });

  await prisma.category.createMany({
    data: [
      { userId: user.id, name: "Income", type: "INCOME", system: true },
      { userId: user.id, name: "Bills", type: "EXPENSE", system: true },
      { userId: user.id, name: "Groceries", type: "EXPENSE", system: true },
      { userId: user.id, name: "Transportation", type: "EXPENSE", system: true },
    ],
  });

  // 4️⃣ Add demo transactions
  await prisma.transaction.createMany({
    data: [
      {
        userId: user.id,
        type: "INCOME",
        amount: 2500,
        description: "Paycheck deposit",
      },
      {
        userId: user.id,
        type: "EXPENSE",
        amount: 1200,
        description: "Rent payment",
      },
      {
        userId: user.id,
        type: "EXPENSE",
        amount: 150,
        description: "Groceries",
      },
      {
        userId: user.id,
        type: "EXPENSE",
        amount: 60,
        description: "Gas",
      },
    ],
  });

  console.log("✅ Seeding complete.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
