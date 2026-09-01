import { NextResponse } from "next/server";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Ends a session whose account no longer stands behind it.
 *
 * The sign-in token is stateless: it is issued once and believed until it expires, so it keeps
 * working after the account it names is stopped — or after the database it came from is replaced,
 * which is how a fresh deployment leaves an administrator holding a token for a user id that no
 * longer exists. Every page then renders from the token and looks normal, and only the one page
 * that asks the database about the account comes out blank.
 *
 * The check is repeated here rather than trusted from the caller, so a stray request to this
 * path cannot sign a perfectly good session out.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", request.url));

  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  });
  if (account?.isActive) return NextResponse.redirect(new URL("/", request.url));

  await signOut({ redirectTo: "/login?ended=1" });
}
