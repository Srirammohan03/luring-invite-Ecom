// app\api\checkout-session\route.ts
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { CheckoutStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/cart/auth";



const GUEST_COOKIE = "luring_checkout_guest";
const SESSION_COOKIE = "luring_checkout_session";

const schema = z.object({
  videoJobId: z.string().min(1).max(100),
  email: z.string().trim().email().max(254).optional().or(z.literal("")),
});

const incompleteStatuses = [CheckoutStatus.STARTED, CheckoutStatus.PENDING];

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid checkout tracking information." },
        { status: 400 },
      );
    }

    const input = parsed.data;
    const user = await getCurrentUser();

    const email = input.email?.trim().toLowerCase() || null;

    if (user && email && user.email.toLowerCase() !== email) {
      return NextResponse.json(
        { message: "Checkout email does not match your account." },
        { status: 400 },
      );
    }

    const video = await prisma.videoJob.findFirst({
      where: {
        id: input.videoJobId,
        status: "COMPLETED",
        outputPath: { not: null },
        template: { active: true },
      },
      select: { id: true },
    });

    if (!video) {
      return NextResponse.json(
        { message: "This personalized video is unavailable." },
        { status: 404 },
      );
    }

    const existingGuestId = request.cookies.get(GUEST_COOKIE)?.value;

    const guestId =
      existingGuestId && /^[a-f0-9]{64}$/i.test(existingGuestId)
        ? existingGuestId
        : randomBytes(32).toString("hex");

    const existingSessionId = request.cookies.get(SESSION_COOKIE)?.value;

    const now = new Date();

    let sessionId: string;

    const existingSession = existingSessionId
      ? await prisma.checkoutSession.findFirst({
          where: {
            id: existingSessionId,
            status: { in: incompleteStatuses },
            videoJobId: video.id,
            OR: [...(user ? [{ userId: user.id }] : []), { guestId }],
          },
          select: { id: true },
        })
      : null;

    if (existingSession) {
      const updated = await prisma.checkoutSession.update({
        where: { id: existingSession.id },
        data: {
          userId: user?.id ?? null,
          guestId,
          customerEmail: email,
          lastActivityAt: now,
        },
        select: { id: true },
      });

      sessionId = updated.id;
    } else {
      const created = await prisma.checkoutSession.create({
        data: {
          userId: user?.id ?? null,
          guestId,
          customerEmail: email,
          videoJobId: video.id,
          status: CheckoutStatus.STARTED,
          lastActivityAt: now,
        },
        select: { id: true },
      });

      sessionId = created.id;
    }

    const response = NextResponse.json({
      success: true,
      sessionId,
    });

    response.cookies.set(
      GUEST_COOKIE,
      guestId,
      cookieOptions(60 * 60 * 24 * 30),
    );

    response.cookies.set(
      SESSION_COOKIE,
      sessionId,
      cookieOptions(60 * 60 * 24),
    );

    response.headers.set("Cache-Control", "private, no-store, max-age=0");

    return response;
  } catch (error) {
    console.error("[CHECKOUT_SESSION]", error);

    return NextResponse.json(
      { message: "Unable to track checkout activity." },
      { status: 500 },
    );
  }
}
