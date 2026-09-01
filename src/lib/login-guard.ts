import "server-only";
import { prisma } from "@/lib/prisma";
import { accountLock, addressLock, IP_WINDOW_MINUTES, type LockState } from "@/lib/lockout";

/** Attempts older than this are of no use to the guard, and are cleared as it goes. */
const KEEP_DAYS = 60;

export type Attempt = { email: string; ip: string | null; userAgent?: string | null; succeeded: boolean };

export function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

/**
 * The address the attempt came from. Behind Railway's proxy the socket address is the proxy's,
 * so the first hop in `x-forwarded-for` is the caller — and it is only ever used to slow an
 * attacker down, never to identify a person or to grant anything.
 */
export function addressFrom(headers: Headers | null | undefined): string | null {
  if (!headers) return null;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return headers.get("x-real-ip");
}

/**
 * Whether this sign-in may even be attempted.
 *
 * Two counts, because they catch different attacks: failures on one account catch someone
 * working through a password list, and failures from one address catch someone trying a single
 * common password against every account in turn — which no account-level count would ever see.
 */
export async function loginLock(email: string, ip: string | null, now = new Date()): Promise<LockState> {
  const address = normalizeEmail(email);

  const lastSuccess = await prisma.loginAttempt.findFirst({
    where: { email: address, succeeded: true },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  // Only failures since the last successful sign-in count: getting in clears the slate.
  const failWhere = {
    email: address,
    succeeded: false,
    ...(lastSuccess ? { createdAt: { gt: lastSuccess.createdAt } } : {}),
  };

  const [failures, lastFailure] = await Promise.all([
    prisma.loginAttempt.count({ where: failWhere }),
    prisma.loginAttempt.findFirst({
      where: failWhere,
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const byAccount = accountLock(failures, lastFailure?.createdAt ?? null, now);
  if (byAccount.locked) return byAccount;

  if (!ip) return byAccount;

  const windowStart = new Date(now.getTime() - IP_WINDOW_MINUTES * 60_000);
  const [ipFailures, lastIpFailure] = await Promise.all([
    prisma.loginAttempt.count({ where: { ip, succeeded: false, createdAt: { gte: windowStart } } }),
    prisma.loginAttempt.findFirst({
      where: { ip, succeeded: false },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  return addressLock(ipFailures, lastIpFailure?.createdAt ?? null, now);
}

/** Writes the attempt down. Never throws: a failure to record must not deny a valid sign-in. */
export async function recordAttempt(attempt: Attempt) {
  try {
    await prisma.loginAttempt.create({
      data: {
        email: normalizeEmail(attempt.email),
        ip: attempt.ip,
        userAgent: attempt.userAgent?.slice(0, 300) ?? null,
        succeeded: attempt.succeeded,
      },
    });

    if (attempt.succeeded) {
      const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000);
      await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } });
    }
  } catch {
    // Recording is for the guard's benefit, not the user's — an unwritable log denies nobody.
  }
}
