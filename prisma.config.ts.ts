// prisma.config.ts (project root)
import "dotenv/config";               // <-- this loads .env automatically
import { defineConfig } from "@prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",   // make sure this path is correct
});
