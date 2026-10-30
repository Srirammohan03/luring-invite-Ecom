// app\(dashboard)\checkout\success\page.tsx
"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function CheckoutSuccessPage() {
  const search = useSearchParams();
  const order = search.get("order");
  const videoJobId = search.get("videoJobId");
  const downloadUrl = videoJobId
    ? `/api/downloads/${encodeURIComponent(videoJobId)}`
    : order
      ? `/api/orders/${encodeURIComponent(order)}/download`
      : null;

  useEffect(() => {
    if (search.get("download") !== "1" || !downloadUrl || !order) return;
    const key = `luring-video-download:${order}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "started");
    window.location.assign(downloadUrl);
  }, [downloadUrl, order, search]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fcf9fd] p-5">
      <section className="max-w-lg rounded-3xl border border-emerald-100 bg-white p-8 text-center shadow-sm">
        <p className="text-4xl">✓</p>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Payment confirmed</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          Your order {order ? `#${order}` : ""} has been confirmed. Your clean, high-quality video is being prepared for download. It may take a few minutes to start.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          {downloadUrl && (
            <a
              href={downloadUrl}
              className="inline-block rounded-xl bg-[#985cc0] px-5 py-3 font-semibold text-white"
            >
              Download my video
            </a>
          )}
          <Link href="/templates" className="inline-block rounded-xl border border-[#d9b9eb] px-5 py-3 font-semibold text-[#9259b7]">
            Browse invitations
          </Link>
        </div>
      </section>
    </main>
  );
}
