// app\admin\(protected)\orders\page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownToLine,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Package,
  RefreshCw,
  Search,
  ShoppingBag,
  Video,
  X,
} from "lucide-react";

type OrderItem = {
  id: string;
  templateId: number | null;
  title: string;
  thumbnail: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  videoJobId: string | null;
};

type Order = {
  id: string;
  orderNumber: string;
  customer: {
    name: string | null;
    email: string;
    phone: string | null;
  };
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: string;
  paymentStatus: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  items: OrderItem[];
  latestPayment: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    method: string | null;
    signatureVerified: boolean;
    razorpayPaymentId: string | null;
    paidAt: string | null;
  } | null;
  videos: {
    id: string;
    status: string;
    hasDownload: boolean;
  }[];
};

type OrdersResponse = {
  data: Order[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: {
    totalOrders: number;
    paidAmount: number;
    completedVideos: number;
  };
};

const money = (value: number, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);

const dateLabel = (value: string | null) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState({
    totalOrders: 0,
    paidAmount: 0,
    completedVideos: 0,
  });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const pageSize = 10;

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        search: search.trim(),
        page: String(page),
        pageSize: String(pageSize),
      });

      const response = await fetch(`/api/admin/orders?${params}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load orders.");
      }

      const payload = result as OrdersResponse;

      setOrders(payload.data);
      setSummary(payload.summary);
      setTotal(payload.pagination.total);
      setPageCount(Math.max(1, payload.pagination.totalPages));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  function exportCsv() {
    if (!orders.length) return;

    const headers = [
      "Order Number",
      "Customer",
      "Email",
      "Phone",
      "Items",
      "Subtotal",
      "Discount",
      "Tax",
      "Total",
      "Payment Status",
      "Razorpay Order ID",
      "Razorpay Payment ID",
      "Paid At",
      "Created At",
    ];

    const rows = orders.map((order) => [
      order.orderNumber,
      order.customer.name ?? "",
      order.customer.email,
      order.customer.phone ?? "",
      order.itemCount,
      order.subtotal.toFixed(2),
      order.discount.toFixed(2),
      order.tax.toFixed(2),
      order.total.toFixed(2),
      order.paymentStatus,
      order.razorpayOrderId ?? "",
      order.razorpayPaymentId ?? "",
      order.paidAt ?? "",
      order.createdAt,
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `luring-invite-orders-page-${page}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const firstRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRecord = Math.min(page * pageSize, total);

  return (
    <div className="min-h-full bg-[#FAFAFC]">
      <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
              <span>Admin</span>
              <span>/</span>
              <span className="font-medium text-[#A86DCD]">Orders</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Orders
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Manage verified payments, purchased templates and invitation
              videos.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadOrders()}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={exportCsv}
              disabled={loading || orders.length === 0}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm hover:border-purple-200 hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowDownToLine className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard
            label="Paid orders"
            value={summary.totalOrders.toLocaleString("en-IN")}
            icon={<ShoppingBag className="h-5 w-5" />}
          />
          <MetricCard
            label="Paid revenue"
            value={money(summary.paidAmount)}
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <MetricCard
            label="Completed videos"
            value={summary.completedVideos.toLocaleString("en-IN")}
            icon={<Video className="h-5 w-5" />}
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-4 sm:p-5">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-gray-900">
                All paid orders
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {total.toLocaleString("en-IN")} verified paid order records
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search order number, customer, email or payment ID"
                aria-label="Search orders"
                className="h-11 w-full rounded-xl border border-gray-200 pl-9 pr-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#A86DCD] focus:ring-2 focus:ring-purple-100"
              />
            </div>
          </div>

          {error && (
            <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">
                Could not load orders
              </p>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button
                type="button"
                onClick={() => void loadOrders()}
                className="mt-3 rounded-lg bg-white px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200"
              >
                Try again
              </button>
            </div>
          )}

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1000px] text-left">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    "Order / Customer",
                    "Items",
                    "Order date",
                    "Paid total",
                    "Payment",
                    "Details",
                  ].map((heading, index) => (
                    <th
                      key={heading}
                      className={`px-5 py-3 text-xs font-semibold text-gray-500 ${
                        index === 3 || index === 5 ? "text-right" : ""
                      }`}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!loading &&
                  !error &&
                  orders.map((order) => (
                    <tr
                      key={order.id}
                      className="transition hover:bg-purple-50/30"
                    >
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-gray-900">
                          {order.orderNumber}
                        </p>
                        <p className="mt-1 text-xs text-gray-600">
                          {order.customer.name || "Customer"}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          {order.customer.email}
                        </p>
                      </td>
                      <td className="max-w-[260px] px-5 py-4">
                        <p className="truncate text-sm font-medium text-gray-800">
                          {order.items.map((item) => item.title).join(", ") ||
                            "No items"}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          {order.itemCount}{" "}
                          {order.itemCount === 1 ? "item" : "items"}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                        {dateLabel(order.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold text-gray-900">
                        {money(order.total, order.currency)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          Paid
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          aria-label={`View order ${order.orderNumber}`}
                          className="rounded-lg p-2 text-gray-500 transition hover:bg-purple-50 hover:text-[#A86DCD]"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 p-3 md:hidden">
            {!loading &&
              !error &&
              orders.map((order) => (
                <article
                  key={order.id}
                  className="rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-all text-sm font-semibold text-gray-900">
                        {order.orderNumber}
                      </p>
                      <p className="mt-1 break-all text-xs text-gray-500">
                        {order.customer.email}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                      Paid
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
                    <div>
                      <p className="text-xs text-gray-500">Items</p>
                      <p className="mt-1 text-sm font-medium text-gray-900">
                        {order.itemCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Paid total</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {money(order.total, order.currency)}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Order date</p>
                      <p className="mt-1 text-sm text-gray-700">
                        {dateLabel(order.createdAt)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(order)}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-purple-50"
                  >
                    <Eye className="h-4 w-4" />
                    View order
                  </button>
                </article>
              ))}
          </div>

          {loading && <LoadingState />}

          {!loading && !error && orders.length === 0 && (
            <EmptyState
              title={search ? "No matching orders" : "No paid orders yet"}
              description={
                search
                  ? "Try another search term."
                  : "Successfully paid orders will appear here after payment verification."
              }
            />
          )}

          <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-xs text-gray-500">
              {total === 0
                ? "No results"
                : `Showing ${firstRecord}–${lastRecord} of ${total} orders`}
            </p>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                disabled={loading || page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                aria-label="Previous page"
                className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-20 text-center text-xs text-gray-500">
                Page {page} of {pageCount}
              </span>
              <button
                type="button"
                disabled={loading || page >= pageCount}
                onClick={() =>
                  setPage((value) => Math.min(pageCount, value + 1))
                }
                aria-label="Next page"
                className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <p className="text-center text-xs text-gray-400">
          Orders are displayed only after successful payment verification.
        </p>
      </div>

      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedOrder(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-dialog-title"
            className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-[#A86DCD]">
                  Paid order details
                </p>
                <h2
                  id="order-dialog-title"
                  className="mt-1 break-all text-xl font-bold text-gray-900"
                >
                  {selectedOrder.orderNumber}
                </h2>
                <p className="mt-1 break-all text-sm text-gray-500">
                  {selectedOrder.customer.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                aria-label="Close order details"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <DetailBox
                label="Customer"
                value={selectedOrder.customer.name || "Not provided"}
              />
              <DetailBox
                label="Phone"
                value={selectedOrder.customer.phone || "Not provided"}
              />
              <DetailBox
                label="Payment status"
                value={selectedOrder.paymentStatus}
              />
              <DetailBox label="Order status" value={selectedOrder.status} />
              <DetailBox
                label="Paid at"
                value={dateLabel(selectedOrder.paidAt)}
              />
              <DetailBox
                label="Created at"
                value={dateLabel(selectedOrder.createdAt)}
              />
              <DetailBox
                label="Razorpay order ID"
                value={selectedOrder.razorpayOrderId || "Not available"}
              />
              <DetailBox
                label="Razorpay payment ID"
                value={selectedOrder.razorpayPaymentId || "Not available"}
              />
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-900">
                Purchased items
              </h3>
              <div className="mt-3 space-y-3">
                {selectedOrder.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-gray-100 p-3"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-purple-50 text-[#A86DCD]">
                      {item.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Package className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {item.quantity} ×{" "}
                        {money(item.unitPrice, selectedOrder.currency)}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-gray-900">
                      {money(item.lineTotal, selectedOrder.currency)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 space-y-3 rounded-xl bg-gray-50 p-4">
              <DetailRow
                label="Subtotal"
                value={money(selectedOrder.subtotal, selectedOrder.currency)}
              />
              <DetailRow
                label="Discount"
                value={money(selectedOrder.discount, selectedOrder.currency)}
              />
              <DetailRow
                label="Tax"
                value={money(selectedOrder.tax, selectedOrder.currency)}
              />
              <div className="border-t border-gray-200 pt-3">
                <DetailRow
                  label="Total paid"
                  value={money(selectedOrder.total, selectedOrder.currency)}
                  strong
                />
              </div>
            </div>

            {selectedOrder.latestPayment && (
              <div className="mt-5 rounded-xl border border-gray-100 p-4">
                <h3 className="text-sm font-semibold text-gray-900">
                  Payment information
                </h3>
                <div className="mt-3 space-y-3">
                  <DetailRow
                    label="Method"
                    value={
                      selectedOrder.latestPayment.method || "Not available"
                    }
                  />
                  <DetailRow
                    label="Signature verified"
                    value={
                      selectedOrder.latestPayment.signatureVerified
                        ? "Yes"
                        : "Not recorded"
                    }
                  />
                  <DetailRow
                    label="Payment ID"
                    value={selectedOrder.latestPayment.razorpayPaymentId || "—"}
                  />
                </div>
              </div>
            )}

            <div className="mt-5">
              <h3 className="text-sm font-semibold text-gray-900">
                Video generation
              </h3>
              <div className="mt-3 space-y-2">
                {selectedOrder.videos.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No linked video purchases.
                  </p>
                ) : (
                  selectedOrder.videos.map((video) => (
                    <div
                      key={video.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 p-3"
                    >
                      <div className="min-w-0">
                        <p className="break-all text-xs font-medium text-gray-800">
                          {video.id}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {video.status}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-gray-500">
                        {video.hasDownload ? "Download available" : "Not ready"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedOrder(null)}
              className="mt-6 w-full rounded-xl bg-[#A86DCD] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#9458BB]"
            >
              Close details
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">{label}</p>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-[#A86DCD]">
          {icon}
        </span>
      </div>
      <p className="mt-3 break-words text-2xl font-bold text-gray-900">
        {value}
      </p>
    </div>
  );
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-100 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-gray-900">
        {value}
      </p>
    </div>
  );
}

function DetailRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-gray-500">{label}</span>
      <span
        className={`max-w-[65%] break-all text-right text-sm ${strong ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}
      >
        {value}
      </span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="px-5 py-14 text-center">
      <RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#A86DCD]" />
      <p className="mt-3 text-sm text-gray-500">Loading paid orders…</p>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="px-5 py-14 text-center">
      <ShoppingBag className="mx-auto h-8 w-8 text-gray-300" />
      <p className="mt-3 font-medium text-gray-900">{title}</p>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>
  );
}
