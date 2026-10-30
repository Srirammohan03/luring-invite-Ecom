// lib\cart\auth.ts
import { createHash } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "../prisma";

export const SESSION_COOKIE = "luring_session";

export const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60;

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getCurrentUser() {
  const cookieStore = await cookies();

  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) return null;

  const session = await prisma.userSession.findFirst({
    where: {
      tokenHash: hashSessionToken(token),
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: true,
    },
  });

  return session?.user || null;
}
