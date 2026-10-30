// app/api/admin/orders/route.ts

import { NextResponse } from "next/server";
import { OrderPaymentStatus, OrderStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { sessionToken } from "@/lib/cms/auth";
import { readSession } from "@/lib/cms/sessions";


const PAGE_SIZE_DEFAULT = 10;
const PAGE_SIZE_MAX = 100;
const SEARCH_MAX_LENGTH = 150;

function parsePositiveInteger(
  value: string | null,
  fallback: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (!value || !/^\d+$/.test(value)) return fallback;

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

function decimalToNumber(value: Prisma.Decimal | null | undefined): number {
  return value == null ? 0 : Number(value);
}

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}

export async function GET(request: Request) {
  try {
    // 1. Authenticate admin
    const token = await sessionToken();
    const admin = await readSession(prisma, token);

    if (!admin) {
      return jsonError("Unauthorized", 401);
    }

    // 2. Parse and validate query parameters
    const params = new URL(request.url).searchParams;

    const search = (params.get("search") ?? "")
      .trim()
      .slice(0, SEARCH_MAX_LENGTH);

    const page = parsePositiveInteger(params.get("page"), 1);

    const pageSize = parsePositiveInteger(
      params.get("pageSize"),
      PAGE_SIZE_DEFAULT,
      PAGE_SIZE_MAX,
    );

    // 3. Orders page is exclusively for paid, non-cancelled orders.
    // This restriction cannot be overridden by query parameters.
    const paidOrderWhere: Prisma.OrderWhereInput = {
      paymentStatus: OrderPaymentStatus.PAID,
      status: {
        not: OrderStatus.CANCELLED,
      },
    };

    const where: Prisma.OrderWhereInput = {
      ...paidOrderWhere,

      ...(search
        ? {
            OR: [
              {
                orderNumber: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                customerEmail: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                customerName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                customerPhone: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                razorpayOrderId: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                razorpayPaymentId: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };

    // 4. Fetch all required database information
    const [orders, total, totalOrders, paidRevenue, completedVideos] =
      await Promise.all([
        prisma.order.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,

          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },

            customer: {
              select: {
                id: true,
                fullName: true,
                email: true,
                primaryPhone: true,
              },
            },

            items: {
              select: {
                id: true,
                templateId: true,
                templateTitle: true,
                quantity: true,
                unitPrice: true,
                videoJobId: true,

                template: {
                  select: {
                    id: true,
                    title: true,
                    thumbnail: true,
                  },
                },
              },
            },

            payments: {
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
              select: {
                id: true,
                razorpayOrderId: true,
                razorpayPaymentId: true,
                amount: true,
                currency: true,
                status: true,
                method: true,
                signatureVerified: true,
                paidAt: true,
              },
            },

            videoPurchases: {
              select: {
                videoJob: {
                  select: {
                    id: true,
                    status: true,
                    finalPath: true,
                    outputPath: true,
                  },
                },
              },
            },
          },
        }),

        prisma.order.count({
          where,
        }),

        prisma.order.count({
          where: paidOrderWhere,
        }),

        prisma.order.aggregate({
          where: paidOrderWhere,
          _sum: {
            total: true,
          },
        }),

        prisma.videoJob.count({
          where: {
            status: "COMPLETED",
            purchases: {
              some: {
                order: {
                  is: paidOrderWhere,
                },
              },
            },
          },
        }),
      ]);

    // 5. Transform Prisma records into frontend response
    const data = orders.map((order) => {
      const items = order.items.map((item) => {
        const unitPrice = decimalToNumber(item.unitPrice);

        return {
          id: item.id,
          templateId: item.templateId,
          title: item.templateTitle,
          thumbnail: item.template?.thumbnail ?? null,
          quantity: item.quantity,
          unitPrice,
          lineTotal: unitPrice * item.quantity,
          videoJobId: item.videoJobId,
        };
      });

      const videos = order.videoPurchases.map((purchase) => ({
        id: purchase.videoJob.id,
        status: purchase.videoJob.status,
        hasDownload: Boolean(
          purchase.videoJob.finalPath || purchase.videoJob.outputPath,
        ),
      }));

      const latestPayment = order.payments[0]
        ? {
            id: order.payments[0].id,
            amount: decimalToNumber(order.payments[0].amount),
            currency: order.payments[0].currency,
            status: order.payments[0].status,
            method: order.payments[0].method,
            signatureVerified: order.payments[0].signatureVerified,
            razorpayPaymentId: order.payments[0].razorpayPaymentId,
            paidAt: order.payments[0].paidAt?.toISOString() ?? null,
          }
        : null;

      return {
        id: order.id,
        orderNumber: order.orderNumber,

        customer: {
          name:
            order.customerName ??
            order.customer?.fullName ??
            order.user?.name ??
            null,

          email: order.customerEmail,

          phone:
            order.customerPhone ??
            order.customer?.primaryPhone ??
            order.user?.phone ??
            null,
        },

        currency: order.currency,

        subtotal: decimalToNumber(order.subtotal),
        discount: decimalToNumber(order.discount),
        tax: decimalToNumber(order.tax),
        total: decimalToNumber(order.total),

        status: order.status,
        paymentStatus: order.paymentStatus,

        razorpayOrderId: order.razorpayOrderId,
        razorpayPaymentId: order.razorpayPaymentId,

        paidAt: order.paidAt?.toISOString() ?? null,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),

        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),

        items,
        latestPayment,
        videos,
      };
    });

    // 6. Return response matching OrdersPage.tsx
    return NextResponse.json(
      {
        data,

        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },

        summary: {
          totalOrders,
          paidAmount: decimalToNumber(paidRevenue._sum.total),
          completedVideos,
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("Admin orders API error:", error);

    return jsonError("Unable to load orders. Please try again.", 500);
  }
}
