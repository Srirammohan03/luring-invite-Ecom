// app\api\payments\create-order\route.ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/cart/auth";
import {
  createRazorpayOrder,
  hashAccessToken,
  newGuestAccessToken,
} from "@/lib/payments/razorpay";

const detailsSchema = z.object({
  videoJobId: z.string().min(1).max(100),
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  primaryPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9 ()-]{6,19}$/),
  alternatePhone: z.string().trim().max(25).optional().or(z.literal("")),
  address: z.string().trim().min(5).max(500),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  country: z.string().trim().min(2).max(100),
  postalCode: z.string().trim().min(3).max(20),
  companyName: z.string().trim().max(150).optional().or(z.literal("")),
  termsAccepted: z.literal(true),
});

export async function POST(request: NextRequest) {
  try {
    const input = detailsSchema.parse(await request.json());
    const user = await getCurrentUser();
    const checkoutSessionId = request.cookies.get(
      "luring_checkout_session",
    )?.value;

    const checkoutGuestId = request.cookies.get("luring_checkout_guest")?.value;
    const email = input.email.toLowerCase();
    if (user && user.email !== email)
      return NextResponse.json(
        { message: "Use the email associated with your signed-in account." },
        { status: 400 },
      );
    const video = await prisma.videoJob.findFirst({
      where: { id: input.videoJobId, status: "COMPLETED" },
      include: { template: true },
    });
    if (!video || !video.outputPath || !video.template.active)
      return NextResponse.json(
        { message: "This personalized video is not ready for purchase." },
        { status: 404 },
      );
    const amount = Number(video.template.price);
    const amountPaise = Math.round(amount * 100);
    if (!Number.isSafeInteger(amountPaise) || amountPaise < 100)
      return NextResponse.json(
        { message: "The template price is invalid." },
        { status: 400 },
      );
    const accessToken = newGuestAccessToken();

    const pending = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { email },

        update: {
          fullName: input.fullName,
          primaryPhone: input.primaryPhone,
          alternatePhone: input.alternatePhone || null,
          address: input.address,
          city: input.city,
          state: input.state,
          country: input.country,
          postalCode: input.postalCode,
          companyName: input.companyName || null,
          ...(user ? { userId: user.id } : {}),
        },

        create: {
          userId: user?.id,
          email,
          fullName: input.fullName,
          primaryPhone: input.primaryPhone,
          alternatePhone: input.alternatePhone || null,
          address: input.address,
          city: input.city,
          state: input.state,
          country: input.country,
          postalCode: input.postalCode,
          companyName: input.companyName || null,
        },
      });

      const order = await tx.order.create({
        data: {
          customerId: customer.id,
          userId: user?.id,
          customerEmail: email,
          customerName: input.fullName,
          customerPhone: input.primaryPhone,
          guestAccessTokenHash: hashAccessToken(accessToken),
          total: new Prisma.Decimal(amount),
          subtotal: new Prisma.Decimal(amount),
          currency: "INR",

          items: {
            create: {
              templateId: video.templateId,
              templateTitle: video.template.title,
              unitPrice: new Prisma.Decimal(amount),
              quantity: 1,
              videoJobId: video.id,
              customization: video.input as Prisma.InputJsonValue,
            },
          },
        },
      });

      // Associate the checkout session with the newly created order.
      if (checkoutSessionId) {
        await tx.checkoutSession.updateMany({
          where: {
            id: checkoutSessionId,
            videoJobId: video.id,
            status: {
              in: ["STARTED", "PENDING"],
            },
            OR: [
              ...(user ? [{ userId: user.id }] : []),
              ...(checkoutGuestId ? [{ guestId: checkoutGuestId }] : []),
            ],
          },

          data: {
            orderId: order.id,
            status: "PENDING",
            customerEmail: email,
            lastActivityAt: new Date(),
          },
        });
      }

      return order;
    });

    const razorpayOrder = await createRazorpayOrder(
      pending.orderNumber,
      amountPaise,
    );
    await prisma.$transaction([
      prisma.order.update({
        where: { id: pending.id },
        data: { razorpayOrderId: razorpayOrder.id },
      }),
      prisma.payment.create({
        data: {
          orderId: pending.id,
          razorpayOrderId: razorpayOrder.id,
          amount: new Prisma.Decimal(amount),
          currency: "INR",
        },
      }),
    ]);
    const response = NextResponse.json({
      orderId: pending.id,
      orderNumber: pending.orderNumber,
      razorpayOrderId: razorpayOrder.id,
      amount: amountPaise,
      currency: "INR",
      keyId:
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
    });
    response.cookies.set("luring_purchase_access", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      const field = issue?.path[0]
        ? String(issue.path[0])
            .replace(/([A-Z])/g, " $1")
            .toLowerCase()
        : "checkout details";
      return NextResponse.json(
        {
          message: `Please correct ${field}: ${issue?.message || "invalid value"}.`,
        },
        { status: 400 },
      );
    }
    console.error("Payment order creation failed:", error);
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to start payment.",
      },
      { status: 500 },
    );
  }
}
