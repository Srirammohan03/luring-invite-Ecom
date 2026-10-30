// app/api/admin/abandoned-carts/route.ts

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

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

    // 2. Query parameters
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
    const cutoff = new Date(Date.now() - INACTIVE_MINUTES * 60 * 1000);

    // 4. Only carts that have not entered checkout or created an order.
    const where: Prisma.CartWhereInput = {
      items: {
        some: {},
      },

      updatedAt: {
        lte: cutoff,
      },

      // A cart with an order is handled by the Orders/Checkout flow.
      orders: {
        none: {},
      },

      // Once checkout starts, the cart belongs to the checkout workflow.
      checkoutSessions: {
        none: {},
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
                guestId: {
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
            ],
          }
        : {}),
    };

    // 5. Database queries
    const [carts, total] = await Promise.all([
      prisma.cart.findMany({
        where,

        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],

        skip: (page - 1) * pageSize,
        take: pageSize,

        select: {
          id: true,
          guestId: true,
          createdAt: true,
          updatedAt: true,

          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },

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
      }),

      prisma.cart.count({
        where,
      }),
    ]);

    // 6. Transform database records
    const data = carts.map((cart) => {
      const items = cart.items.map((item) => {
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

      const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

      const totalValue = items.reduce((sum, item) => sum + item.lineTotal, 0);

      return {
        id: cart.id,
        guestId: cart.guestId,

        customer: {
          id: cart.user?.id ?? null,
          name: cart.user?.name ?? null,
          email: cart.user?.email ?? null,
          phone: cart.user?.phone ?? null,
        },

        currency: "INR",
        itemCount,
        totalValue,

        createdAt: cart.createdAt.toISOString(),
        lastActivityAt: cart.updatedAt.toISOString(),

        inactiveMinutes: Math.max(
          0,
          Math.floor((Date.now() - cart.updatedAt.getTime()) / 60_000),
        ),

        items,
      };
    });

    // 7. Response
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
          abandonedCarts: total,
          inactiveMinutes: INACTIVE_MINUTES,

          // This value represents the current page, not all matching carts.
          pageCartValue: data.reduce((sum, cart) => sum + cart.totalValue, 0),
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("[ADMIN_ABANDONED_CARTS_GET]", error);

    return jsonError("Unable to load abandoned carts. Please try again.", 500);
  }
}
