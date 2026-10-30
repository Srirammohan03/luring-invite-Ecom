// component\admin\activity-page.tsx
"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  RefreshCw,
  Search,
  ShoppingBag,
  ShoppingCart,
  UserRound,
  Video,
  X,
} from "lucide-react";
import {
  commerceDemoRecords,
  formatDateTime,
  formatMoney,
  type ActivityStatus,
  type CommerceRecord,
} from "@/lib/admin-demo-data";

type PageKind = "orders" | "abandoned-carts" | "abandoned-checkouts";

const statusText: Record<ActivityStatus, string> = {
  PURCHASED: "Paid",
  ABANDONED_CART: "Abandoned cart",
  CHECKOUT_STARTED: "Checkout started",
  CHECKOUT_PENDING: "Payment pending",
};

const statusClasses: Record<ActivityStatus, string> = {
  PURCHASED: "bg-emerald-50 text-emerald-700",
  ABANDONED_CART: "bg-amber-50 text-amber-700",
  CHECKOUT_STARTED: "bg-blue-50 text-blue-700",
  CHECKOUT_PENDING: "bg-orange-50 text-orange-700",
};

const pageConfig: Record<
  PageKind,
  { title: string; description: string; eyebrow: string }
> = {
  orders: {
    title: "Orders",
    description:
      "Manage successfully paid orders, purchased templates, and generated invitation videos.",
    eyebrow: "Paid orders only",
  },
  "abandoned-carts": {
    title: "Abandoned Carts",
    description:
      "Review carts that were left without progressing to a completed checkout.",
    eyebrow: "Cart recovery workspace",
  },
  "abandoned-checkouts": {
    title: "Abandoned Checkouts",
    description:
      "Track checkout sessions where payment has not been completed.",
    eyebrow: "Checkout recovery workspace",
  },
};

function getRecords(kind: PageKind): CommerceRecord[] {
  if (kind === "orders") {
    // A record is an order only after payment is confirmed.
    return commerceDemoRecords.filter(
      (record) =>
        record.status === "PURCHASED" && record.paymentStatus === "PAID",
    );
  }
  if (kind === "abandoned-carts") {
    return commerceDemoRecords.filter(
      (record) => record.status === "ABANDONED_CART",
    );
  }
  return commerceDemoRecords.filter(
    (record) =>
      (record.status === "CHECKOUT_STARTED" ||
        record.status === "CHECKOUT_PENDING") &&
      record.paymentStatus !== "PAID",
  );
}

function StatusBadge({ status }: { status: ActivityStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium ${statusClasses[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusText[status]}
    </span>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof ShoppingBag;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-3 text-2xl font-bold tracking-tight text-gray-900">
            {value}
          </p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-[#A86DCD]">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-gray-500">{note}</p>
    </div>
  );
}

export function ActivityPage({ kind }: { kind: PageKind }) {
  const [search, setSearch] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<CommerceRecord | null>(
    null,
  );
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const config = pageConfig[kind];
  const allRecords = useMemo(() => getRecords(kind), [kind]);

  const records = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return allRecords;
    return allRecords.filter((record) =>
      [
        record.id,
        record.email,
        record.template,
        statusText[record.status],
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [allRecords, search]);

  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRecords = records.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const totalValue = allRecords.reduce((sum, record) => sum + record.amount, 0);
  const paidRevenue = allRecords
    .filter((record) => record.paymentStatus === "PAID")
    .reduce((sum, record) => sum + record.amount, 0);

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  }

  function exportCsv() {
    const headers = [
      "ID",
      "Customer email",
      "Template",
      "Created at",
      "Last activity",
      "Amount INR",
      "Items",
      "Activity status",
      "Payment status",
      "Video status",
    ];
    const rows = records.map((record) => [
      record.id,
      record.email,
      record.template,
      record.createdAt,
      record.lastActivityAt,
      record.amount.toFixed(2),
      String(record.itemCount),
      statusText[record.status],
      record.paymentStatus,
      record.videoStatus,
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `luring-invite-${kind}-demo.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function videoAction(record: CommerceRecord, action: "download" | "retry") {
    if (action === "download") {
      showNotice(
        `Static preview: no real video URL is connected for ${record.id}.`,
      );
      return;
    }
    showNotice(
      `Static preview: ${record.id} was not submitted to a generation worker.`,
    );
  }

  return (
    <div className="min-h-full bg-[#FAFAFC]">
      <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
              <span>Admin</span>
              <span>/</span>
              <span className="font-medium text-[#A86DCD]">{config.title}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              {config.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
              {config.description}
            </p>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition hover:border-purple-200 hover:bg-purple-50"
          >
            <ArrowDownToLine className="h-4 w-4" /> Export CSV
          </button>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label={
              kind === "orders"
                ? "Paid orders"
                : kind === "abandoned-carts"
                  ? "Abandoned carts"
                  : "Incomplete checkouts"
            }
            value={String(allRecords.length)}
            note="Illustrative static records"
            icon={
              kind === "orders"
                ? CheckCircle2
                : kind === "abandoned-carts"
                  ? ShoppingCart
                  : Clock3
            }
          />
          <MetricCard
            label={kind === "orders" ? "Confirmed revenue" : "Potential value"}
            value={formatMoney(kind === "orders" ? paidRevenue : totalValue)}
            note={
              kind === "orders" ? "Paid records only" : "Not collected revenue"
            }
            icon={ShoppingBag}
          />
          <MetricCard
            label="Video generation"
            value={String(
              allRecords.filter((record) => record.videoStatus === "COMPLETED")
                .length,
            )}
            note="Completed videos in this sample"
            icon={Video}
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-4 sm:p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {config.title} management
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Search and review records in this section only.
                </p>
              </div>
              <span className="w-fit rounded-full border border-purple-100 bg-purple-50 px-3 py-1.5 text-xs font-medium text-[#8D50B5]">
                Static preview
              </span>
            </div>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search customer email, template or ID"
                aria-label={`Search ${config.title.toLowerCase()}`}
                className="h-11 w-full rounded-xl border border-gray-200 pl-9 pr-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#A86DCD] focus:ring-2 focus:ring-purple-100"
              />
            </div>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3.5 text-xs font-semibold text-gray-500">
                    Customer
                  </th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-gray-500">
                    {kind === "orders" ? "Order / Template" : "Cart / Template"}
                  </th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-gray-500">
                    Date
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500">
                    {kind === "orders" ? "Paid total" : "Cart value"}
                  </th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="transition-colors hover:bg-purple-50/30"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-[#A86DCD]">
                          <UserRound className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="max-w-[230px] truncate text-sm font-medium text-gray-900">
                            {record.email}
                          </p>
                          <p className="mt-1 text-xs text-gray-400">
                            {record.id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-gray-800">
                        {record.template}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {record.itemCount}{" "}
                        {record.itemCount === 1 ? "item" : "items"}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-gray-500">
                      {formatDateTime(record.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-medium text-gray-900">
                      {formatMoney(record.amount)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={record.status} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedRecord(record)}
                          title="View details"
                          aria-label={`View ${record.id}`}
                          className="rounded-lg p-2 text-gray-500 transition hover:bg-purple-50 hover:text-[#A86DCD]"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {kind === "orders" &&
                          record.videoStatus === "COMPLETED" && (
                            <button
                              type="button"
                              onClick={() => videoAction(record, "download")}
                              title="Download video"
                              aria-label={`Download video for ${record.id}`}
                              className="rounded-lg p-2 text-gray-500 transition hover:bg-purple-50 hover:text-[#A86DCD]"
                            >
                              <ArrowDownToLine className="h-4 w-4" />
                            </button>
                          )}
                        {kind === "orders" &&
                          record.videoStatus === "FAILED" && (
                            <button
                              type="button"
                              onClick={() => videoAction(record, "retry")}
                              title="Retry video"
                              aria-label={`Retry video for ${record.id}`}
                              className="rounded-lg p-2 text-[#8D50B5] transition hover:bg-purple-100"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 p-3 md:hidden">
            {visibleRecords.map((record) => (
              <article
                key={record.id}
                className="rounded-xl border border-gray-200 p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-[#A86DCD]">
                    <ShoppingBag className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-all text-sm font-semibold text-gray-900">
                      {record.email}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">{record.id}</p>
                  </div>
                  <StatusBadge status={record.status} />
                </div>
                <div className="my-4 h-px bg-gray-100" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Template</p>
                    <p className="mt-1 break-words text-sm font-medium text-gray-800">
                      {record.template}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">
                      {kind === "orders" ? "Paid total" : "Cart value"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {formatMoney(record.amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Created</p>
                    <p className="mt-1 text-sm text-gray-700">
                      {formatDateTime(record.createdAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Last activity</p>
                    <p className="mt-1 text-sm text-gray-700">
                      {formatDateTime(record.lastActivityAt)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRecord(record)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-purple-50"
                >
                  <Eye className="h-4 w-4" /> View details
                </button>
              </article>
            ))}
          </div>

          {records.length === 0 && (
            <div className="px-5 py-14 text-center">
              <ShoppingBag className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-3 font-medium text-gray-900">
                Nothing to display
              </p>
              <p className="mt-1 text-sm text-gray-500">
                There are no sample records for this section.
              </p>
            </div>
          )}
          {records.length > 0 && visibleRecords.length === 0 && (
            <div className="px-5 py-14 text-center">
              <Search className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-3 font-medium text-gray-900">
                No matching records
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Try a different search term.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-xs text-gray-500">
              {records.length === 0
                ? "No records"
                : `Showing ${records.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, records.length)} of ${records.length} records`}
            </p>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                aria-label="Previous page"
                className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-16 text-center text-xs text-gray-500">
                Page {currentPage} of {pageCount}
              </span>
              <button
                type="button"
                disabled={currentPage >= pageCount}
                onClick={() =>
                  setPage((value) => Math.min(pageCount, value + 1))
                }
                aria-label="Next page"
                className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <p className="text-center text-xs text-gray-400">
          Static demo data only. No database, checkout, payment, or video API is
          connected.
        </p>
      </div>

      {selectedRecord && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedRecord(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-dialog-title"
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[#A86DCD]">
                  Record details
                </p>
                <h2
                  id="record-dialog-title"
                  className="mt-1 text-xl font-bold text-gray-900"
                >
                  {selectedRecord.id}
                </h2>
                <p className="mt-1 break-all text-sm text-gray-500">
                  {selectedRecord.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                aria-label="Close details"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 rounded-xl border border-gray-100 p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-[#A86DCD]">
                  <ShoppingBag className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedRecord.template}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {selectedRecord.itemCount}{" "}
                    {selectedRecord.itemCount === 1 ? "item" : "items"}
                  </p>
                  <div className="mt-3">
                    <StatusBadge status={selectedRecord.status} />
                  </div>
                </div>
                <p className="shrink-0 text-sm font-bold text-gray-900">
                  {formatMoney(selectedRecord.amount)}
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              <DetailRow
                label="Payment status"
                value={selectedRecord.paymentStatus.replaceAll("_", " ")}
              />
              <DetailRow
                label="Video status"
                value={selectedRecord.videoStatus.toLowerCase()}
              />
              <DetailRow
                label="Created at"
                value={formatDateTime(selectedRecord.createdAt)}
              />
              <DetailRow
                label="Last activity"
                value={formatDateTime(selectedRecord.lastActivityAt)}
              />
            </div>
            {kind !== "orders" && (
              <div className="mt-5 rounded-xl bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                  Payment not completed
                </p>
                <p className="mt-1 text-sm leading-6 text-amber-800">
                  This activity is not an order. It will appear under Orders
                  only after the payment provider confirms successful payment.
                </p>
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="fixed bottom-4 left-4 right-4 z-[60] rounded-xl border border-purple-100 bg-white p-4 text-sm text-gray-700 shadow-xl sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-sm"
        >
          {notice}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="max-w-[65%] break-words text-right text-sm font-medium capitalize text-gray-900">
        {value}
      </span>
    </div>
  );
}
