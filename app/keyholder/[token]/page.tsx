// ============================================================
// app/keyholder/[token]/page.tsx
// Standalone keyholder approval page — no auth, no shell
// 3-step flow: email → OTP → approve/deny
// sessionToken held in React state only — never localStorage
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

// ── Types ──────────────────────────────────────────────────

type RequestData = {
  id: string;
  status: string;
  reason: string;
  reflection: string | null;
  requestedAt: string;
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

// ── Helpers ────────────────────────────────────────────────

const currency = (n: number) =>
  n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

// ── Main Component ─────────────────────────────────────────

export default function KeyholderPage() {
  const { token } = useParams<{ token: string }>();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [data, setData] = useState<RequestData | null>(null);

  // Auth state
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // ── Fetch request details on mount ──
  useEffect(() => {
    if (!token) return;
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

  // ── Resend cooldown timer ──
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

  // ── Step 1: Send OTP ──
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

      // Always advance to OTP step regardless of match
      // Generic UX — don't reveal whether email matched
      setPageState("otp_step");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 1b: Resend OTP ──
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
        setError(json.message ?? "Please wait before requesting another code.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: Verify OTP ──
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

      // Store session token in React state only — never localStorage
      setSessionToken(json.sessionToken);
      setPageState("valid");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3: Approve or Deny ──
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

  // ── Render ─────────────────────────────────────────────────

  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    );
  }

  if (pageState === "invalid") {
    return (
      <Shell>
        <StatusCard
          icon="🔒"
          title="Link not found"
          message="This link is invalid or has expired. Links are valid for 24 hours."
        />
      </Shell>
    );
  }

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

  if (pageState === "otp_locked") {
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
  }

  if (pageState === "success_approved" && data) {
    return (
      <Shell>
        <StatusCard
          icon="✅"
          title="Unlock approved"
          message={`You approved ${data.owner.name ?? data.owner.email}'s request to unlock ${data.box.name}. They've been notified.`}
        />
      </Shell>
    );
  }

  if (pageState === "success_denied" && data) {
    return (
      <Shell>
        <StatusCard
          icon="🔒"
          title="Unlock denied"
          message={`You denied ${data.owner.name ?? data.owner.email}'s request to unlock ${data.box.name}. The funds remain locked. They can request again in 24 hours.`}
        />
      </Shell>
    );
  }

  // ── Email step ──
  if (pageState === "email_step") {
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
  }

  // ── OTP step ──
  if (pageState === "otp_step") {
    return (
      <Shell>
        <div className="text-center mb-6">
          <div className="text-3xl mb-3">📬</div>
          <h1 className="text-xl font-semibold text-gray-900">
            Check your email
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            We sent a 6-digit code to <strong>{email}</strong>.<br />
            Enter it below to continue.
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
  }

  // ── Valid — show approve/deny UI ──
  if (pageState === "valid" && data) {
    const ownerName = data.owner.name ?? data.owner.email;
    const dueDate = data.box.lockUntil
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
            Unlock request
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            <strong>{ownerName}</strong> is asking you to approve an early
            unlock
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 mb-6">
          <Row label="Safe Deposit Box" value={data.box.name} />
          <Row label="Balance" value={currency(data.box.balance)} />
          {dueDate && <Row label="Due date" value={dueDate} />}
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
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>If you approve:</strong> The funds in {data.box.name} will
            be unlocked and {ownerName} can withdraw them before the due date.
          </p>
          <p className="text-xs text-amber-800 leading-relaxed mt-2">
            <strong>If you deny:</strong> The funds stay locked. {ownerName} can
            request again in 24 hours.
          </p>
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
            {loading ? "Processing…" : "✅ Approve unlock"}
          </button>
          <button
            onClick={() => handleAction("deny")}
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-white border border-gray-200 text-gray-700 font-semibold text-sm disabled:opacity-50"
          >
            {loading ? "Processing…" : "🔒 Deny unlock"}
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

// ── Shell ──────────────────────────────────────────────────
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

// ── StatusCard ─────────────────────────────────────────────
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

// ── Row ────────────────────────────────────────────────────
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 flex items-start justify-between gap-4">
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value}</span>
    </div>
  );
}
