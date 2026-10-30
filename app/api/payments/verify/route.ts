// app\api\payments\verify\route.ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyRazorpaySignature } from "@/lib/payments/razorpay";

const schema = z.object({ orderId: z.string().min(1), razorpayOrderId: z.string().min(1), razorpayPaymentId: z.string().min(1), razorpaySignature: z.string().regex(/^[a-f0-9]{64}$/i) });

export async function POST(request: NextRequest) {
  try {
    const input = schema.parse(await request.json());
    if (!verifyRazorpaySignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature)) return NextResponse.json({ message: "Payment signature verification failed." }, { status: 400 });
    const order = await prisma.order.findUnique({ where: { id: input.orderId }, include: { payments: true, items: true } });
    if (!order || order.razorpayOrderId !== input.razorpayOrderId) return NextResponse.json({ message: "Payment does not belong to this order." }, { status: 400 });
    const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(input.razorpayPaymentId)}`, { headers: { Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}` }, cache: "no-store" });
    const provider: unknown = await response.json().catch(() => null);
    const payment = provider as { status?: unknown; order_id?: unknown; amount?: unknown; currency?: unknown; method?: unknown } | null;
    if (!response.ok || payment?.status !== "captured" || payment.order_id !== order.razorpayOrderId || payment.amount !== Math.round(Number(order.total) * 100) || payment.currency !== order.currency) return NextResponse.json({ message: "Razorpay has not confirmed this payment yet." }, { status: 409 });
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { status: "CONFIRMED", paymentStatus: "PAID", razorpayPaymentId: input.razorpayPaymentId, paidAt: now } });
      await tx.payment.update({ where: { razorpayOrderId: order.razorpayOrderId! }, data: { status: "PAID", razorpayPaymentId: input.razorpayPaymentId, signatureVerified: true, method: typeof payment.method === "string" ? payment.method : null, providerPayload: provider as Prisma.InputJsonValue, paidAt: now } });
      for (const item of order.items) if (item.videoJobId) await tx.videoPurchase.upsert({ where: { orderId_videoJobId: { orderId: order.id, videoJobId: item.videoJobId } }, update: {}, create: { orderId: order.id, videoJobId: item.videoJobId } });
    });
    const videoJobId = order.items.find((item) => item.videoJobId)?.videoJobId;
    return NextResponse.json({ status: "success", orderNumber: order.orderNumber, videoJobId });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Invalid payment response." }, { status: 400 });
    console.error("Payment verification failed:", error);
    return NextResponse.json({ message: "Unable to verify payment." }, { status: 500 });
  }
}
