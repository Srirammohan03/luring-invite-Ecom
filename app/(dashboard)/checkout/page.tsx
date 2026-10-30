// app\(dashboard)\checkout\page.tsx
"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}
type Form = Record<
  | "fullName"
  | "email"
  | "primaryPhone"
  | "alternatePhone"
  | "address"
  | "city"
  | "state"
  | "country"
  | "postalCode"
  | "companyName",
  string
>;
const initial: Form = {
  fullName: "",
  email: "",
  primaryPhone: "",
  alternatePhone: "",
  address: "",
  city: "",
  state: "",
  country: "India",
  postalCode: "",
  companyName: "",
};
function loadRazorpay() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}
export default function CheckoutPage() {
  const search = useSearchParams();
  const router = useRouter();
  const videoJobId = search.get("videoJobId") || "";
  const [form, setForm] = useState<Form>(initial);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [trackingReady, setTrackingReady] = useState(false);
  useEffect(() => {
    fetch("/api/cart/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user?.email)
          setForm((previous) => ({ ...previous, email: data.user.email }));
      })
      .catch(() => undefined);
  }, []);
  const set = (key: keyof Form, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!videoJobId)
      return setError(
        "Your customized video reference is missing. Return to the editor and try again.",
      );
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, videoJobId, termsAccepted: terms }),
      });
      const payment = await response.json();
      if (!response.ok)
        throw new Error(payment.message || "Unable to start payment.");
      if (!payment.keyId || !(await loadRazorpay()) || !window.Razorpay)
        throw new Error(
          "Secure payment checkout could not be loaded. Please retry.",
        );
      const razorpay = new window.Razorpay({
        key: payment.keyId,
        amount: payment.amount,
        currency: payment.currency,
        name: "Luring Invite",
        description: "Personalized invitation video",
        order_id: payment.razorpayOrderId,
        prefill: {
          name: form.fullName,
          email: form.email,
          contact: form.primaryPhone,
        },
        theme: { color: "#985cc0" },
        handler: async (answer: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verified = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: payment.orderId,
              razorpayOrderId: answer.razorpay_order_id,
              razorpayPaymentId: answer.razorpay_payment_id,
              razorpaySignature: answer.razorpay_signature,
            }),
          });
          const result = await verified.json();
          if (!verified.ok) {
            setError(
              result.message ||
                "Payment is pending verification. Please contact support with your payment ID.",
            );
            return;
          }
          const query = new URLSearchParams({
            order: result.orderNumber,
            download: "1",
          });
          if (result.videoJobId) query.set("videoJobId", result.videoJobId);
          router.push(`/checkout/success?${query.toString()}`);
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      razorpay.open();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to start payment.",
      );
      setBusy(false);
    }
  }
  // Create or resume checkout tracking when the page opens.
  useEffect(() => {
    let active = true;

    async function startTracking() {
      try {
        const response = await fetch("/api/checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify({ videoJobId }),
        });

        if (!response.ok) {
          throw new Error("Unable to start checkout tracking.");
        }

        if (active) {
          setTrackingReady(true);
        }
      } catch (error) {
        console.error("Checkout tracking initialization failed:", error);
      }
    }

    if (videoJobId) {
      void startTracking();
    }

    return () => {
      active = false;
      setTrackingReady(false);
    };
  }, [videoJobId]);

  // Update customer information and activity after typing pauses.
  useEffect(() => {
    if (!trackingReady || !videoJobId) return;

    const timeout = window.setTimeout(() => {
      void fetch("/api/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({
          videoJobId,
          email: form.email,
        }),
      }).catch((error) => {
        console.error("Checkout activity update failed:", error);
      });
    }, 1500);

    return () => window.clearTimeout(timeout);
  }, [form, videoJobId, trackingReady]);
  return (
    <main className="min-h-screen bg-[#fcf9fd] px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-5xl">
        <Link href="/templates" className="text-sm font-medium text-[#9259b7]">
          ← Continue browsing
        </Link>
        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
          <form
            onSubmit={submit}
            className="rounded-3xl border border-purple-100 bg-white p-5 shadow-sm sm:p-8"
          >
            <h1 className="text-2xl font-bold text-gray-900">
              Secure checkout
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Your payment is processed securely by Razorpay.
            </p>
            {error && (
              <p
                role="alert"
                className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["fullName", "Full name *"],
                  ["email", "Email address *"],
                  ["primaryPhone", "Primary contact number *"],
                  ["alternatePhone", "Alternate phone"],
                  ["companyName", "Company name"],
                  ["city", "City *"],
                  ["state", "State *"],
                  ["country", "Country *"],
                  ["postalCode", "PIN / postal code *"],
                ] as [keyof Form, string][]
              ).map(([key, label]) => (
                <label key={key} className="text-sm font-medium text-gray-700">
                  {label}
                  <input
                    required={!["alternatePhone", "companyName"].includes(key)}
                    minLength={
                      key === "fullName" ||
                      key === "city" ||
                      key === "state" ||
                      key === "country"
                        ? 2
                        : key === "postalCode"
                          ? 3
                          : undefined
                    }
                    type={
                      key === "email"
                        ? "email"
                        : key.includes("Phone")
                          ? "tel"
                          : "text"
                    }
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 px-3 outline-none focus:border-[#a86dcd] focus:ring-2 focus:ring-purple-100"
                  />
                </label>
              ))}
              <label className="text-sm font-medium text-gray-700 sm:col-span-2">
                Full address *
                <textarea
                  required
                  minLength={5}
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  className="mt-1.5 min-h-24 w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-[#a86dcd] focus:ring-2 focus:ring-purple-100"
                />
              </label>
            </div>
            <label className="mt-5 flex gap-3 text-sm text-gray-600">
              <input
                required
                type="checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
              />
              I accept the Terms of Service and Privacy Policy.
            </label>
            <button
              disabled={busy || !videoJobId}
              className="mt-6 w-full rounded-xl bg-[#985cc0] px-5 py-3.5 font-semibold text-white shadow-lg shadow-purple-100 disabled:opacity-60"
            >
              {busy ? "Opening secure payment…" : "Pay securely with Razorpay"}
            </button>
          </form>
          <aside className="h-fit rounded-3xl border border-purple-100 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900">Order summary</h2>
            <div className="mt-4 border-y border-dashed py-4 text-sm text-gray-600">
              <p>Personalized invitation video</p>
              <p className="mt-1">
                Your price is verified securely before payment.
              </p>
            </div>
            <p className="mt-4 text-xs leading-5 text-gray-500">
              We never collect card details or UPI PINs in this form. Razorpay
              handles payment credentials.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
