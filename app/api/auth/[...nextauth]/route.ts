// app/api/auth/[...nextauth]/route.ts
import NextAuth, { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" }, // important for modern App Router
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null;

        const user = await prisma.user.findUnique({ where: { email: creds.email } });
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(creds.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],

  // 👇👇 This is the session callback you need 👇👇
  callbacks: {
    async session({ session, token }) {
      // token.sub = user.id when using 'jwt' sessions
      if (session.user) {
        session.user.id = token.sub ?? null;
      }
      return session;
    },
  },
};

// Required by Next.js App Router
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
