// app\api\admin\clients\route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionToken } from "@/lib/cms/auth";
import { readSession } from "@/lib/cms/sessions";


export async function GET(request: Request) {
  try {
    const admin = await readSession(prisma, await sessionToken());

    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";

    const requestedPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
    const requestedPageSize = Number.parseInt(
      searchParams.get("pageSize") ?? "10",
      10,
    );

    const page = Number.isFinite(requestedPage)
      ? Math.max(1, requestedPage)
      : 1;
    const pageSize = Number.isFinite(requestedPageSize)
      ? Math.min(100, Math.max(1, requestedPageSize))
      : 10;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search, mode: "insensitive" as const } },
            { id: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [clients, total, totalClients, totalOrders, paidOrders] =
      await Promise.all([
        prisma.cartUser.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
            _count: {
              select: {
                orders: true,
                carts: true,
              },
            },
            orders: {
              where: {
                paymentStatus: "PAID",
                status: { not: "CANCELLED" },
              },
              select: {
                total: true,
              },
            },
          },
        }),
        prisma.cartUser.count({ where }),
        prisma.cartUser.count(),
        prisma.order.count(),
        prisma.order.aggregate({
          where: {
            paymentStatus: "PAID",
            status: { not: "CANCELLED" },
          },
          _sum: { total: true },
        }),
      ]);

    const data = clients.map((client) => ({
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      createdAt: client.createdAt.toISOString(),
      ordersCount: client._count.orders,
      cartsCount: client._count.carts,
      amountSpent: client.orders.reduce(
        (sum, order) => sum + Number(order.total),
        0,
      ),
    }));

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
          totalClients,
          totalOrders,
          totalAmountSpent: Number(paidOrders._sum.total ?? 0),
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("Admin clients API error:", error);

    return NextResponse.json(
      { error: "Unable to load clients." },
      { status: 500 },
    );
  }
}
