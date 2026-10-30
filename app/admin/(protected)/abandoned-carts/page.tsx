// app/admin/(protected)/abandoned-carts/page.tsx

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Eye,
  Package,
  RefreshCw,
  Search,
  X,
  Clock3,
  UserRound,
} from "lucide-react";

type CartItem = {
  id: string;
  templateId: number;
  title: string;
  thumbnail: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type AbandonedCart = {
  id: string;
  guestId: string | null;
  customer: {
    id: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  currency: string;
  itemCount: number;
  totalValue: number;
  createdAt: string;
  lastActivityAt: string;
  inactiveMinutes: number;
  items: CartItem[];
};

type CartsResponse = {
  data: AbandonedCart[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: {
    abandonedCarts: number;
    inactiveMinutes: number;
    pageCartValue: number;
  };
};

const PAGE_SIZE = 10;

function money(amount: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function dateLabel(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours < 24) {
    return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`;
}

export default function AbandonedCartsPage() {
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);

  const [summary, setSummary] = useState({
    abandonedCarts: 0,
    inactiveMinutes: 30,
    pageCartValue: 0,
  });

  const [selectedCart, setSelectedCart] = useState<AbandonedCart | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const requestController = useRef<AbortController | null>(null);

  const loadCarts = useCallback(async () => {
    requestController.current?.abort();

    const controller = new AbortController();
    requestController.current = controller;

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        search: search.trim(),
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });

      const response = await fetch(
        `/api/admin/abandoned-carts?${params.toString()}`,
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load abandoned carts.");
      }

      const payload = result as CartsResponse;

      setCarts(payload.data);
      setTotal(payload.pagination.total);
      setPageCount(Math.max(1, payload.pagination.totalPages));
      setSummary(payload.summary);
    } catch (err) {
      if (controller.signal.aborted) return;

      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [search, page]);

  useEffect(() => {
    void loadCarts();

    return () => {
      requestController.current?.abort();
    };
  }, [loadCarts]);

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function exportCsv() {
    if (!carts.length) return;

    const headers = [
      "Cart ID",
      "Customer Name",
      "Email",
      "Phone",
      "Guest ID",
      "Items",
      "Cart Value",
      "Created At",
      "Last Activity",
      "Inactive Minutes",
    ];

    const rows = carts.map((cart) => [
      cart.id,
      cart.customer.name ?? "",
      cart.customer.email ?? "",
      cart.customer.phone ?? "",
      cart.guestId ?? "",
      cart.itemCount,
      cart.totalValue.toFixed(2),
      cart.createdAt,
      cart.lastActivityAt,
      cart.inactiveMinutes,
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
    anchor.download = `luring-invite-abandoned-carts-page-${page}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  }

  const firstRecord = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;

  const lastRecord = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="min-h-full bg-[#FAFAFC]">
      <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
              <span>Admin</span>
              <span>/</span>
              <span className="font-medium text-[#A86DCD]">
                Abandoned Carts
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Abandoned Carts
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Track customers who added templates to their cart but did not
              proceed to checkout.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadCarts()}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={exportCsv}
              disabled={loading || carts.length === 0}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition hover:border-purple-200 hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowDownToLine className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MetricCard
            label="Abandoned carts"
            value={summary.abandonedCarts.toLocaleString("en-IN")}
            icon={<ShoppingCart className="h-5 w-5" />}
          />

          <MetricCard
            label="Cart value on this page"
            value={money(summary.pageCartValue)}
            icon={<Package className="h-5 w-5" />}
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-4 sm:p-5">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-gray-900">
                All abandoned carts
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {total.toLocaleString("en-IN")} abandoned cart records
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Cart inactivity threshold: {summary.inactiveMinutes} minutes
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

              <input
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Search cart ID, guest ID, name, email or phone"
                aria-label="Search abandoned carts"
                className="h-11 w-full rounded-xl border border-gray-200 pl-9 pr-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#A86DCD] focus:ring-2 focus:ring-purple-100"
              />
            </div>
          </div>

          {error && (
            <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">
                Could not load abandoned carts
              </p>

              <p className="mt-1 text-sm text-red-700">{error}</p>

              <button
                type="button"
                onClick={() => void loadCarts()}
                className="mt-3 rounded-lg bg-white px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-50"
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
                    "Customer",
                    "Cart items",
                    "Last activity",
                    "Inactive",
                    "Cart value",
                    "Details",
                  ].map((heading, index) => (
                    <th
                      key={heading}
                      className={`px-5 py-3 text-xs font-semibold text-gray-500 ${
                        index >= 4 ? "text-right" : ""
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
                  carts.map((cart) => (
                    <tr
                      key={cart.id}
                      className="transition hover:bg-purple-50/30"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={
                              cart.customer.name ||
                              cart.customer.email ||
                              cart.guestId ||
                              cart.id
                            }
                          />

                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              {cart.customer.name || "Guest customer"}
                            </p>

                            <p className="mt-1 break-all text-xs text-gray-500">
                              {cart.customer.email ||
                                `Guest ID: ${cart.guestId || "Unavailable"}`}
                            </p>

                            {cart.customer.phone && (
                              <p className="mt-1 text-xs text-gray-400">
                                {cart.customer.phone}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-gray-900">
                          {cart.itemCount}{" "}
                          {cart.itemCount === 1 ? "item" : "items"}
                        </p>

                        <p className="mt-1 max-w-[220px] truncate text-xs text-gray-500">
                          {cart.items.map((item) => item.title).join(", ")}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                        {dateLabel(cart.lastActivityAt)}
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                          <Clock3 className="h-3.5 w-3.5" />
                          {durationLabel(cart.inactiveMinutes)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold text-gray-900">
                        {money(cart.totalValue, cart.currency)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedCart(cart)}
                          aria-label={`View cart ${cart.id}`}
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
              carts.map((cart) => (
                <article
                  key={cart.id}
                  className="rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex items-start gap-3">
                    <Avatar
                      name={
                        cart.customer.name ||
                        cart.customer.email ||
                        cart.guestId ||
                        cart.id
                      }
                    />

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {cart.customer.name || "Guest customer"}
                      </p>

                      <p className="mt-1 break-all text-xs text-gray-500">
                        {cart.customer.email ||
                          `Guest ID: ${cart.guestId || "Unavailable"}`}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {cart.customer.phone || "Phone not provided"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedCart(cart)}
                      aria-label={`View cart ${cart.id}`}
                      className="rounded-lg p-2 text-gray-500 hover:bg-purple-50 hover:text-[#A86DCD]"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
                    <div>
                      <p className="text-xs text-gray-500">Items</p>
                      <p className="mt-1 text-sm font-medium text-gray-900">
                        {cart.itemCount}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Cart value</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {money(cart.totalValue, cart.currency)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Inactive</p>
                      <p className="mt-1 text-sm font-medium text-amber-700">
                        {durationLabel(cart.inactiveMinutes)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Last activity</p>
                      <p className="mt-1 text-sm text-gray-700">
                        {dateLabel(cart.lastActivityAt)}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
          </div>

          {loading && <LoadingState />}

          {!loading && !error && carts.length === 0 && (
            <EmptyState
              title={search ? "No matching carts" : "No abandoned carts"}
              description={
                search
                  ? "Try searching with another customer or cart ID."
                  : "Carts that remain inactive for at least 30 minutes without entering checkout will appear here."
              }
            />
          )}

          <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-xs text-gray-500">
              {total === 0
                ? "No results"
                : `Showing ${firstRecord}–${lastRecord} of ${total} carts`}
            </p>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                disabled={loading || page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                aria-label="Previous page"
                className="rounded-lg border border-gray-200 p-2 text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
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
                className="rounded-lg border border-gray-200 p-2 text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <p className="text-center text-xs text-gray-400">
          Abandoned carts are identified using database activity. Carts that
          entered checkout or generated an order are excluded from this page.
        </p>
      </div>

      {selectedCart && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedCart(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-dialog-title"
            className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  name={
                    selectedCart.customer.name ||
                    selectedCart.customer.email ||
                    selectedCart.id
                  }
                  large
                />

                <div className="min-w-0">
                  <h2
                    id="cart-dialog-title"
                    className="font-semibold text-gray-900"
                  >
                    {selectedCart.customer.name || "Guest customer"}
                  </h2>

                  <p className="mt-1 break-all text-sm text-gray-500">
                    {selectedCart.customer.email || "Email not provided"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCart(null)}
                aria-label="Close cart details"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <DetailBox label="Cart ID" value={selectedCart.id} />

              <DetailBox
                label="Guest ID"
                value={selectedCart.guestId || "Registered customer"}
              />

              <DetailBox
                label="Phone"
                value={selectedCart.customer.phone || "Not provided"}
              />

              <DetailBox
                label="Total items"
                value={String(selectedCart.itemCount)}
              />

              <DetailBox
                label="Created"
                value={dateLabel(selectedCart.createdAt)}
              />

              <DetailBox
                label="Last activity"
                value={dateLabel(selectedCart.lastActivityAt)}
              />

              <DetailBox
                label="Inactive duration"
                value={durationLabel(selectedCart.inactiveMinutes)}
              />

              <DetailBox
                label="Cart value"
                value={money(selectedCart.totalValue, selectedCart.currency)}
              />
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-900">
                Cart items
              </h3>

              <div className="mt-3 space-y-3">
                {selectedCart.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-gray-100 p-3"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-purple-50 text-[#A86DCD]">
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
                        {money(item.unitPrice, selectedCart.currency)}
                      </p>
                    </div>

                    <p className="shrink-0 text-sm font-semibold text-gray-900">
                      {money(item.lineTotal, selectedCart.currency)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between rounded-xl bg-purple-50 p-4">
              <span className="text-sm font-medium text-gray-700">
                Total cart value
              </span>

              <span className="text-lg font-bold text-[#8D50B5]">
                {money(selectedCart.totalValue, selectedCart.currency)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedCart(null)}
              className="mt-5 w-full rounded-xl bg-[#A86DCD] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#9458BB]"
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

      <p className="mt-3 break-words text-2xl font-bold tracking-tight text-gray-900">
        {value}
      </p>
    </div>
  );
}

function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  const initials = name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl bg-purple-100 font-semibold text-[#8D50B5] ${
        large ? "h-12 w-12 text-base" : "h-10 w-10 text-sm"
      }`}
    >
      {initials || "G"}
    </div>
  );
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-100 p-3">
      <p className="text-xs text-gray-500">{label}</p>

      <p className="mt-1 break-all text-sm font-medium text-gray-900">
        {value}
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="px-5 py-14 text-center">
      <RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#A86DCD]" />

      <p className="mt-3 text-sm text-gray-500">Loading abandoned carts…</p>
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
      <ShoppingCart className="mx-auto h-8 w-8 text-gray-300" />

      <p className="mt-3 font-medium text-gray-900">{title}</p>

      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>
  );
}
