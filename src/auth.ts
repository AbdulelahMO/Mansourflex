import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginLock, recordAttempt, addressFrom, normalizeEmail } from "@/lib/login-guard";

/**
 * A real hash of a value nobody holds. Comparing against it costs exactly what comparing against
 * a genuine account costs, so a sign-in for an address that does not exist takes as long to
 * refuse as one for an address that does — otherwise the timing alone lists the real accounts.
 */
const NO_SUCH_ACCOUNT_HASH = "$2b$10$cLT37.z13p6kfQVLKKJSV.5MgL6hCOkt4PByq4F2u9RiJ7AWU6naC";

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Behind a reverse proxy Auth.js refuses every request whose Host it was not told to
  // trust, and says so only in the server log — the sign-in page still renders, so the
  // instance looks up while nobody can sign in. This deployment owns its own hosts.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials, request) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const address = normalizeEmail(email);
        const ip = addressFrom(request?.headers);
        const userAgent = request?.headers?.get("user-agent") ?? null;

        // Refused before the password is even looked at: while the wait runs, a correct guess
        // is worth no more than a wrong one, which is the whole point of making the attacker wait.
        const lock = await loginLock(address, ip);
        if (lock.locked) return null;

        const user = await prisma.user.findUnique({
          where: { email: address },
          include: { owner: true },
        });

        // A missing account and a wrong password fail alike, and take alike: answering «no such
        // account» faster would hand an attacker the list of real addresses to work through.
        const valid = user?.isActive
          ? await bcrypt.compare(password, user.passwordHash)
          : await bcrypt.compare(password, NO_SUCH_ACCOUNT_HASH);

        if (!user || !user.isActive || !valid) {
          await recordAttempt({ email: address, ip, userAgent, succeeded: false });
          return null;
        }

        await recordAttempt({ email: address, ip, userAgent, succeeded: true });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          ownerId: user.owner?.id ?? null,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = user.role;
        token.ownerId = user.ownerId;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as "ADMIN" | "OWNER" | "EMPLOYEE";
        session.user.ownerId = (token.ownerId as string | null) ?? null;
      }
      return session;
    },
  },
});
