// lib/auth.ts
import type { NextAuthOptions, DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

// ---- Type augmentation so session.user.id is valid everywhere
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },

  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: creds.email },
        });
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(creds.password, user.passwordHash);
        if (!valid) return null;

        // What ends up in the JWT as the "user"
        return { id: user.id, name: user.name ?? null, email: user.email };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) token.uid = (user as any).id; // capture id at login
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        (session.user as any).id = token.uid as string;
      }
      return session;
    },
  },
  // Make sure you have NEXTAUTH_URL and NEXTAUTH_SECRET in .env.local
};
