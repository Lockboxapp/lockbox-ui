import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string | null; // <-- allow null to match token.sub ?? null
    } & DefaultSession["user"];
  }
}
