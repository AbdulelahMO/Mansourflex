import { NextResponse } from "next/server";
import { auth } from "@/auth";

/** Reserved for the system administrator; not delegable to any role. */
const ADMIN_ONLY_PREFIXES = ["/settings/employees"];

/** The owner portal is read-only and never sees staff-side sections. */
const OWNER_BLOCKED_PREFIXES = ["/owners", "/agreements", "/settings", "/approvals"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isPublic = pathname === "/login";
  const role = req.auth?.user?.role;

  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isPublic) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  // Everything else is decided per page by the permission gate, so an employee's access
  // follows their role instead of being cut off at the URL.
  const blocked =
    role === "OWNER"
      ? OWNER_BLOCKED_PREFIXES
      : role === "ADMIN"
        ? []
        : ADMIN_ONLY_PREFIXES;

  if (isLoggedIn && blocked.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
