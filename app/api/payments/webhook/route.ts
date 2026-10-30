// app\api\payments\webhook\route.ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/payments/razorpay";

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") || "";
  if (!verifyWebhookSignature(raw, signature))
    return NextResponse.json(
      { message: "Invalid webhook signature." },
      { status: 400 },
    );
  try {
    const body = JSON.parse(raw) as {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            amount?: number;
            currency?: string;
            status?: string;
            method?: string;
          };
        };
      };
    };
    const eventId =
      request.headers.get("x-razorpay-event-id") ||
      `${body.event}:${body.payload?.payment?.entity?.id || "unknown"}`;
    const entity = body.payload?.payment?.entity;
    const order = entity?.order_id
      ? await prisma.order.findUnique({
          where: { razorpayOrderId: entity.order_id },
          include: { items: true },
        })
      : null;
    await prisma.$transaction(async (tx) => {
      const existing = await tx.paymentWebhook.findUnique({
        where: { eventId },
      });
      if (existing) return;
      await tx.paymentWebhook.create({
        data: {
          eventId,
          eventType: body.event || "unknown",
          orderId: order?.id,
          payload: body as Prisma.InputJsonValue,
        },
      });
      if (
        !order ||
        body.event !== "payment.captured" ||
        entity?.status !== "captured" ||
        entity.amount !== Math.round(Number(order.total) * 100) ||
        entity.currency !== order.currency ||
        !entity.id
      )
        return;
      const now = new Date();
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "CONFIRMED",
          paymentStatus: "PAID",
          razorpayPaymentId: entity.id,
          paidAt: now,
        },
      });
      await tx.payment.update({
        where: { razorpayOrderId: order.razorpayOrderId! },
        data: {
          status: "PAID",
          razorpayPaymentId: entity.id,
          signatureVerified: true,
          method: entity.method || null,
          providerPayload: body as Prisma.InputJsonValue,
          paidAt: now,
        },
      });
      await tx.checkoutSession.updateMany({
        where: {
          orderId: order.id,
          status: {
            in: ["STARTED", "PENDING"],
          },
        },
        data: {
          status: "COMPLETED",
          lastActivityAt: now,
        },
      });
      for (const item of order.items)
        if (item.videoJobId)
          await tx.videoPurchase.upsert({
            where: {
              orderId_videoJobId: {
                orderId: order.id,
                videoJobId: item.videoJobId,
              },
            },
            update: {},
            create: { orderId: order.id, videoJobId: item.videoJobId },
          });
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Razorpay webhook failed:", error);
    return NextResponse.json(
      { message: "Webhook processing failed." },
      { status: 500 },
    );
  }
}
