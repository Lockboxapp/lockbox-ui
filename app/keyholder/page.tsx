// ============================================================
// app/keyholder/page.tsx
// Keyholder approval page — uses ?token= query param
// No auth required — token IS the auth
// ============================================================

"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type RequestData = {
  id: string;
  status: string;
  reason: string;
  reflection: string | null;
  requestedAt: string;
  // Sprint 13 — transfer requests carry extra metadata
  requestType?: "UNLOCK" | "TRANSFER";
  transferAmount?: number | null;
  destinationBoxName?: string | null;
  box: {
    name: string;
    balance: number;
    lockUntil: string | null;
    status: string;
  };
  owner: {
    name: string | null;
    email: string;
  };
};

type PageState =
  | "loading"
  | "invalid"
  | "already_handled"
  | "email_step"
  | "otp_step"
  | "valid"
  | "success_approved"
  | "success_denied"
  | "otp_locked";

const currency = (n: number) =>
  n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

function KeyholderPageInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [pageState, setPageState] = useState<PageState>("loading");
  const [data, setData] = useState<RequestData | null>(null);
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (!token) {
      setPageState("invalid");
      return;
    }
    fetch(`/api/unlock-requests/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          setPageState("invalid");
          return;
        }
        const json = await res.json();
        if (json.error) {
          setPageState("invalid");
          return;
        }
        setData(json);
        setPageState(
          json.status !== "PENDING" ? "already_handled" : "email_step",
        );
      })
      .catch(() => setPageState("invalid"));
  }, [token]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/keyholder-auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          sourceToken: token,
          purpose: "APPROVAL",
        }),
      });
      const json = await res.json();
      if (res.status === 429) {
        setResendCooldown(json.retryAfter ?? 60);
        setError(json.message ?? "Please wait before requesting another code.");
        setLoading(false);
        return;
      }
      setPageState("otp_step");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOTP() {
    if (resendCooldown > 0 || loading) return;
    setLoading(true);
    setError("");
    setOtpCode("");
    try {
      const res = await fetch("/api/keyholder-auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          sourceToken: token,
          purpose: "APPROVAL",
        }),
      });
      const json = await res.json();
      if (res.status === 429) {
        setResendCooldown(json.retryAfter ?? 60);
        setError(json.message ?? "Please wait.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    if (!otpCode.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/keyholder-auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          sourceToken: token,
          purpose: "APPROVAL",
          code: otpCode.trim(),
        }),
      });
      const json = await res.json();
      if (res.status === 429) {
        setPageState("otp_locked");
        return;
      }
      if (!res.ok) {
        setError(json.error ?? "Invalid code. Please try again.");
        setLoading(false);
        return;
      }
      setSessionToken(json.sessionToken);
      setPageState("valid");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: "approve" | "deny") {
    if (!sessionToken || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/unlock-requests/${token}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-keyholder-session": sessionToken,
        },
      });
      if (res.status === 401) {
        setError(
          "Your session has expired. Please verify your identity again.",
        );
        setSessionToken(null);
        setPageState("email_step");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }
      setPageState(
        action === "approve" ? "success_approved" : "success_denied",
      );
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (pageState === "loading")
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    );

  if (pageState === "invalid")
    return (
      <Shell>
        <StatusCard
          icon="🔒"
          title="Link not found"
          message="This link is invalid or has expired. Links are valid for 24 hours."
        />
      </Shell>
    );

  if (pageState === "already_handled" && data) {
    const wasApproved = data.status === "APPROVED";
    return (
      <Shell>
        <StatusCard
          icon={wasApproved ? "✅" : "❌"}
          title={`Already ${wasApproved ? "approved" : "denied"}`}
          message={`This unlock request was already ${wasApproved ? "approved" : "denied"}. No further action is needed.`}
        />
      </Shell>
    );
  }

  if (pageState === "otp_locked")
    return (
      <Shell>
        <StatusCard
          icon="🔒"
          title="Too many attempts"
          message="You've entered too many incorrect codes. Please request a new code to try again."
        />
        <button
          onClick={() => {
            setOtpCode("");
            setError("");
            setPageState("email_step");
          }}
          className="w-full mt-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-600"
        >
          Start over
        </button>
      </Shell>
    );

  if (pageState === "success_approved" && data) {
    const isTransfer = data.requestType === "TRANSFER";
    const ownerLabel = data.owner.name || data.owner.email;
    const title = isTransfer ? "Transfer approved" : "Unlock approved";
    const message = isTransfer
      ? `You approved ${ownerLabel}'s transfer of $${data.transferAmount ?? 0} from ${data.box.name}${data.destinationBoxName ? ` to ${data.destinationBoxName}` : ""}. The money moved automatically and the box stays locked.`
      : `You approved ${ownerLabel}'s request to unlock ${data.box.name}. They've been notified.`;
    return (
      <Shell>
        <StatusCard icon="✅" title={title} message={message} />
      </Shell>
    );
  }

  if (pageState === "success_denied" && data) {
    const isTransfer = data.requestType === "TRANSFER";
    const ownerLabel = data.owner.name || data.owner.email;
    const title = isTransfer ? "Transfer denied" : "Unlock denied";
    const message = isTransfer
      ? `You denied ${ownerLabel}'s transfer from ${data.box.name}. No money moved. They can submit a new request.`
      : `You denied ${ownerLabel}'s request to unlock ${data.box.name}. The funds remain locked. They can request again in 24 hours.`;
    return (
      <Shell>
        <StatusCard icon="🔒" title={title} message={message} />
      </Shell>
    );
  }

  if (pageState === "email_step")
    return (
      <Shell>
        <div className="text-center mb-6">
          <div className="text-3xl mb-3">🔐</div>
          <h1 className="text-xl font-semibold text-gray-900">
            Verify your identity
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Enter the email address you were invited with to continue.
          </p>
        </div>
        <form onSubmit={handleSendOTP} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            autoFocus
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send verification code"}
          </button>
        </form>
        <p className="text-xs text-gray-400 text-center mt-6">
          We'll send a 6-digit code to your email to verify your identity.
        </p>
      </Shell>
    );

  if (pageState === "otp_step")
    return (
      <Shell>
        <div className="text-center mb-6">
          <div className="text-3xl mb-3">📬</div>
          <h1 className="text-xl font-semibold text-gray-900">
            Check your email
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            We sent a 6-digit code to <strong>{email}</strong>. Enter it below
            to continue.
          </p>
        </div>
        <form onSubmit={handleVerifyOTP} className="space-y-4">
          <input
            type="text"
            value={otpCode}
            onChange={(e) =>
              setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="123456"
            maxLength={6}
            required
            autoFocus
            inputMode="numeric"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-center tracking-widest text-lg font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {error && (
            <p className="text-sm text-rose-600 text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || otpCode.length !== 6}
            className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Verify code"}
          </button>
        </form>
        <div className="text-center mt-4">
          <button
            onClick={handleResendOTP}
            disabled={resendCooldown > 0 || loading}
            className="text-sm text-gray-500 disabled:opacity-40"
          >
            {resendCooldown > 0
              ? `Resend code in ${resendCooldown}s`
              : "Resend code"}
          </button>
        </div>
        <button
          onClick={() => {
            setPageState("email_step");
            setError("");
            setOtpCode("");
          }}
          className="w-full mt-2 text-xs text-gray-400 text-center"
        >
          ← Use a different email
        </button>
      </Shell>
    );

  if (pageState === "valid" && data) {
    const ownerName = data.owner.name || data.owner.email;
    const isTransfer = data.requestType === "TRANSFER";
    const targetDate = data.box.lockUntil
      ? new Date(data.box.lockUntil).toLocaleDateString(undefined, {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : null;
    return (
      <Shell>
        <div className="text-center mb-6">
          <div className="text-3xl mb-3">🔐</div>
          <h1 className="text-xl font-semibold text-gray-900">
            {isTransfer ? "Transfer request" : "Unlock request"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isTransfer ? (
              <>
                <strong>{ownerName}</strong> wants to transfer{" "}
                <strong>${data.transferAmount ?? 0}</strong> from{" "}
                <strong>{data.box.name}</strong>
                {data.destinationBoxName ? (
                  <> to <strong>{data.destinationBoxName}</strong></>
                ) : null}
                . The box will remain locked after this transfer.
              </>
            ) : (
              <>
                <strong>{ownerName}</strong> is asking you to approve an early
                unlock
              </>
            )}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 mb-6">
          <Row label="Safe Deposit Box" value={data.box.name} />
          <Row label="Balance" value={currency(data.box.balance)} />
          {isTransfer && data.transferAmount != null && (
            <Row
              label="Transfer amount"
              value={currency(data.transferAmount)}
            />
          )}
          {isTransfer && data.destinationBoxName && (
            <Row label="Destination" value={data.destinationBoxName} />
          )}
          {targetDate && <Row label="Target date" value={targetDate} />}
          <Row label="Reason" value={data.reason} />
          {data.reflection && (
            <Row label="Reflection" value={data.reflection} />
          )}
          <Row
            label="Requested"
            value={new Date(data.requestedAt).toLocaleString()}
          />
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          {isTransfer ? (
            <>
              <p className="text-xs text-amber-800 leading-relaxed">
                <strong>If you approve:</strong> the requested amount moves from{" "}
                {data.box.name}
                {data.destinationBoxName ? ` to ${data.destinationBoxName}` : ""}
                . The source box stays locked. Only the amount requested moves.
              </p>
              <p className="text-xs text-amber-800 leading-relaxed mt-2">
                <strong>If you deny:</strong> no money moves. {ownerName} can
                submit a new transfer request.
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-amber-800 leading-relaxed">
                <strong>If you approve:</strong> The funds in {data.box.name}{" "}
                will be unlocked and {ownerName} can withdraw them before the
                target date.
              </p>
              <p className="text-xs text-amber-800 leading-relaxed mt-2">
                <strong>If you deny:</strong> The funds stay locked. {ownerName}{" "}
                can request again in 24 hours.
              </p>
            </>
          )}
        </div>
        {error && (
          <p className="text-sm text-rose-600 text-center mb-4">{error}</p>
        )}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => handleAction("approve")}
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm disabled:opacity-50"
          >
            {loading
              ? "Processing…"
              : isTransfer
              ? "✅ Approve transfer"
              : "✅ Approve unlock"}
          </button>
          <button
            onClick={() => handleAction("deny")}
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-white border border-gray-200 text-gray-700 font-semibold text-sm disabled:opacity-50"
          >
            {loading
              ? "Processing…"
              : isTransfer
              ? "🔒 Deny transfer"
              : "🔒 Deny unlock"}
          </button>
        </div>
        <p className="text-xs text-gray-400 text-center mt-6">
          You are acting as a keyholder for {ownerName}'s LockBox account. You
          cannot move or access their funds — only approve or deny this request.
        </p>
      </Shell>
    );
  }

  return null;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-lg font-bold text-gray-900">LockBox</span>
          <span className="text-xs text-gray-400 ml-1.5">Keyholder Portal</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatusCard({
  icon,
  title,
  message,
}: {
  icon: string;
  title: string;
  message: string;
}) {
  return (
    <div className="text-center py-8">
      <div className="text-4xl mb-4">{icon}</div>
      <h1 className="text-xl font-semibold text-gray-900 mb-2">{title}</h1>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 flex items-start justify-between gap-4">
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value}</span>
    </div>
  );
}

export default function KeyholderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-sm text-gray-400">Loading…</div>
        </div>
      }
    >
      <KeyholderPageInner />
    </Suspense>
  );
}
