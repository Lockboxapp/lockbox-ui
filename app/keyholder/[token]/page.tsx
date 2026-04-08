// ============================================================
// app/keyholder/[token]/page.tsx
// Standalone keyholder approval page
// No auth required — token IS the auth
// No shell, no nav — designed for email link opens on mobile
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type RequestData = {
  id: string;
  status: string;
  reason: string;
  reflection: string | null;
  requestedAt: string;
  resolvedAt: string | null;
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
  | "valid"
  | "already_handled"
  | "invalid"
  | "success_approved"
  | "success_denied";

const currency = (n: number) =>
  n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export default function KeyholderPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>("loading");
  const [data, setData] = useState<RequestData | null>(null);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/unlock-requests/${token}`)
      .then(async (res) => {
        if (res.status === 404) {
          setState("invalid");
          return;
        }
        const json = await res.json();
        if (json.error) {
          setState("invalid");
          return;
        }
        setData(json);
        setState(json.status !== "PENDING" ? "already_handled" : "valid");
      })
      .catch(() => setState("invalid"));
  }, [token]);

  async function handleAction(action: "approve" | "deny") {
    if (!token || acting) return;
    setActing(true);
    setError("");
    try {
      const res = await fetch(`/api/unlock-requests/${token}/${action}`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? "Something went wrong");
        setActing(false);
        return;
      }
      setState(action === "approve" ? "success_approved" : "success_denied");
    } catch {
      setError("Something went wrong. Please try again.");
      setActing(false);
    }
  }

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading request…</div>
      </div>
    );
  }

  if (state === "invalid") {
    return (
      <Shell>
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Link not found
          </h1>
          <p className="text-sm text-gray-500">
            This link is invalid or has expired. Links are valid for 24 hours.
          </p>
        </div>
      </Shell>
    );
  }

  if (state === "already_handled" && data) {
    const wasApproved = data.status === "APPROVED";
    return (
      <Shell>
        <div className="text-center py-8">
          <div className="text-4xl mb-4">{wasApproved ? "✅" : "❌"}</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Already {wasApproved ? "approved" : "denied"}
          </h1>
          <p className="text-sm text-gray-500">
            This unlock request was already{" "}
            {wasApproved ? "approved" : "denied"}. No further action is needed.
          </p>
        </div>
      </Shell>
    );
  }

  if (state === "success_approved" && data) {
    return (
      <Shell>
        <div className="text-center py-8">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Unlock approved
          </h1>
          <p className="text-sm text-gray-500">
            You approved {data.owner.name ?? data.owner.email}'s request to
            unlock <strong>{data.box.name}</strong>. They've been notified.
          </p>
        </div>
      </Shell>
    );
  }

  if (state === "success_denied" && data) {
    return (
      <Shell>
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Unlock denied
          </h1>
          <p className="text-sm text-gray-500">
            You denied {data.owner.name ?? data.owner.email}'s request to unlock{" "}
            <strong>{data.box.name}</strong>. The funds remain locked. They can
            request again in 24 hours.
          </p>
        </div>
      </Shell>
    );
  }

  if (!data) return null;

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
      {/* Header */}
      <div className="text-center mb-6">
        <div className="text-3xl mb-3">🔐</div>
        <h1 className="text-xl font-semibold text-gray-900">Unlock request</h1>
        <p className="text-sm text-gray-500 mt-1">
          <strong>{ownerName}</strong> is asking you to approve an early unlock
        </p>
      </div>

      {/* Request details */}
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 mb-6">
        <Row label="Safe Deposit Box" value={data.box.name} />
        <Row label="Balance" value={currency(data.box.balance)} />
        {dueDate && <Row label="Due date" value={dueDate} />}
        <Row label="Reason" value={data.reason} />
        {data.reflection && <Row label="Reflection" value={data.reflection} />}
        <Row
          label="Requested"
          value={new Date(data.requestedAt).toLocaleString()}
        />
      </div>

      {/* What this means */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>If you approve:</strong> The funds in {data.box.name} will be
          unlocked and {ownerName} can withdraw them before the due date.
        </p>
        <p className="text-xs text-amber-800 leading-relaxed mt-2">
          <strong>If you deny:</strong> The funds stay locked. {ownerName} can
          request again in 24 hours.
        </p>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-rose-600 text-center mb-4">{error}</p>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <button
          onClick={() => handleAction("approve")}
          disabled={acting}
          className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm disabled:opacity-50"
        >
          {acting ? "Processing…" : "✅ Approve unlock"}
        </button>
        <button
          onClick={() => handleAction("deny")}
          disabled={acting}
          className="w-full py-3.5 rounded-xl bg-white border border-gray-200 text-gray-700 font-semibold text-sm disabled:opacity-50"
        >
          {acting ? "Processing…" : "🔒 Deny unlock"}
        </button>
      </div>

      <p className="text-xs text-gray-400 text-center mt-6">
        You are acting as a keyholder for {ownerName}'s LockBox account. You
        cannot move or access their funds — only approve or deny this request.
      </p>
    </Shell>
  );
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 flex items-start justify-between gap-4">
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value}</span>
    </div>
  );
}
