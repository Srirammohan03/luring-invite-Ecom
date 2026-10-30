import { NextResponse } from "next/server";
import { CheckoutStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { sessionToken } from "@/lib/cms/auth";
import { readSession } from "@/lib/cms/sessions";

const INACTIVE_MINUTES = 30;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 150;

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
    // 1. Admin authentication
    const token = await sessionToken();
    const admin = await readSession(prisma, token);

    if (!admin) {
      return jsonError("Unauthorized", 401);
    }

    // 2. Query validation
    const params = new URL(request.url).searchParams;

    const search = (params.get("search") ?? "")
      .trim()
      .slice(0, MAX_SEARCH_LENGTH);

    const page = parsePositiveInteger(params.get("page"), 1, 1_000_000);

    const pageSize = parsePositiveInteger(
      params.get("pageSize"),
      DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE,
    );

    // 3. Inactivity threshold
    const now = new Date();

    const cutoff = new Date(now.getTime() - INACTIVE_MINUTES * 60_000);

    // 4. Only genuinely incomplete, inactive sessions
    const where: Prisma.CheckoutSessionWhereInput = {
      status: {
        in: [CheckoutStatus.STARTED, CheckoutStatus.PENDING],
      },

      lastActivityAt: {
        lte: cutoff,
      },

      // Never display a successfully paid order as abandoned.
      NOT: {
        order: {
          is: {
            paymentStatus: "PAID",
          },
        },
      },

      ...(search
        ? {
            OR: [
              {
                id: {
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
                guestId: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                videoJobId: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                user: {
                  is: {
                    OR: [
                      {
                        name: {
                          contains: search,
                          mode: "insensitive",
                        },
                      },
                      {
                        email: {
                          contains: search,
                          mode: "insensitive",
                        },
                      },
                      {
                        phone: {
                          contains: search,
                          mode: "insensitive",
                        },
                      },
                    ],
                  },
                },
              },
              {
                videoJob: {
                  is: {
                    template: {
                      is: {
                        title: {
                          contains: search,
                          mode: "insensitive",
                        },
                      },
                    },
                  },
                },
              },
              {
                order: {
                  is: {
                    orderNumber: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    // 5. Fetch records and total count
    const [sessions, total] = await Promise.all([
      prisma.checkoutSession.findMany({
        where,

        orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }],

        skip: (page - 1) * pageSize,
        take: pageSize,

        select: {
          id: true,
          cartId: true,
          userId: true,
          guestId: true,
          customerEmail: true,
          videoJobId: true,
          orderId: true,
          status: true,
          createdAt: true,
          lastActivityAt: true,

          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },

          cart: {
            select: {
              id: true,
              items: {
                select: {
                  id: true,
                  templateId: true,
                  quantity: true,
                  unitPrice: true,
                  template: {
                    select: {
                      id: true,
                      title: true,
                      thumbnail: true,
                    },
                  },
                },
              },
            },
          },

          videoJob: {
            select: {
              id: true,
              status: true,
              template: {
                select: {
                  id: true,
                  title: true,
                  thumbnail: true,
                  price: true,
                },
              },
            },
          },

          order: {
            select: {
              id: true,
              orderNumber: true,
              total: true,
              currency: true,
              paymentStatus: true,
            },
          },
        },
      }),

      prisma.checkoutSession.count({
        where,
      }),
    ]);

    // 6. Transform database records
    const data = sessions.map((session) => {
      const cartItems = session.cart?.items ?? [];

      // Normal cart checkout
      const mappedCartItems = cartItems.map((item) => {
        const unitPrice = Number(item.unitPrice);

        return {
          id: item.id,
          templateId: item.templateId,
          title: item.template.title,
          thumbnail: item.template.thumbnail,
          quantity: item.quantity,
          unitPrice,
          lineTotal: unitPrice * item.quantity,
        };
      });

      // Personalized video checkout
      const videoTemplate = session.videoJob?.template;

      const videoItems = videoTemplate
        ? [
            {
              id: `video-${session.videoJob!.id}`,
              templateId: videoTemplate.id,
              title: videoTemplate.title,
              thumbnail: videoTemplate.thumbnail,
              quantity: 1,
              unitPrice: Number(videoTemplate.price),
              lineTotal: Number(videoTemplate.price),
            },
          ]
        : [];

      // Prefer cart items when present; otherwise use video item.
      const items = mappedCartItems.length > 0 ? mappedCartItems : videoItems;

      const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

      const calculatedValue = items.reduce(
        (sum, item) => sum + item.lineTotal,
        0,
      );

      // If an order exists, use its actual stored amount.
      const totalValue = session.order
        ? Number(session.order.total)
        : calculatedValue;

      const inactiveMinutes = Math.max(
        0,
        Math.floor((now.getTime() - session.lastActivityAt.getTime()) / 60_000),
      );

      const customer = {
        id: session.user?.id ?? null,

        name: session.user?.name ?? null,

        email: session.customerEmail ?? session.user?.email ?? null,

        phone: session.user?.phone ?? null,
      };

      return {
        id: session.id,

        status: "ABANDONED" as const,

        originalStatus: session.status,

        customer,

        guestId: session.guestId,
        cartId: session.cartId,

        videoJobId: session.videoJobId,

        orderId: session.orderId,

        orderNumber: session.order?.orderNumber ?? null,

        currency: session.order?.currency ?? "INR",

        itemCount,
        totalValue,

        createdAt: session.createdAt.toISOString(),

        lastActivityAt: session.lastActivityAt.toISOString(),

        inactiveMinutes,

        items,
      };
    });

    // 7. Page summary
    const pageCheckoutValue = data.reduce(
      (sum, checkout) => sum + checkout.totalValue,
      0,
    );

    // 8. Response
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
          abandonedCheckouts: total,
          inactiveMinutes: INACTIVE_MINUTES,
          pageCheckoutValue,
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("[ADMIN_ABANDONED_CHECKOUTS_GET]", error);

    return jsonError(
      "Unable to load abandoned checkouts. Please try again.",
      500,
    );
  }
}
