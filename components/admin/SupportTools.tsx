"use client";

import { useEffect, useMemo, useState } from "react";

type UserLite = {
  id: string;
  email: string;
  name: string | null;
  isRestricted: boolean;
  restrictedReason: string | null;
};

type BoxLite = {
  id: string;
  name: string;
  balance: number; // cents
  isWallet: boolean;
  isClosed: boolean;
  userId: string;
};

const currency = (cents: number) =>
  (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export default function SupportTools({
  users,
  allBoxes,
}: {
  users: UserLite[];
  allBoxes: BoxLite[];
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 mt-6">
      <div className="font-semibold text-gray-900 mb-1">Support Tools</div>
      <div className="text-xs text-gray-500 mb-5">
        Admin-only actions. All are audited.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MoveFundsTool users={users} allBoxes={allBoxes} />
        <PasswordResetTool />
        <RestrictAccountTool users={users} />
      </div>
    </div>
  );
}

// ── Move Funds ──────────────────────────────────────────────

function MoveFundsTool({ users, allBoxes }: { users: UserLite[]; allBoxes: BoxLite[] }) {
  const [userId, setUserId] = useState("");
  const [fromBoxId, setFromBoxId] = useState("");
  const [toBoxId, setToBoxId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const userBoxes = useMemo(
    () => allBoxes.filter((b) => b.userId === userId && !b.isClosed && !b.isWallet),
    [allBoxes, userId],
  );
  const destBoxes = useMemo(
    () => userBoxes.filter((b) => b.id !== fromBoxId),
    [userBoxes, fromBoxId],
  );

  useEffect(() => {
    setFromBoxId("");
    setToBoxId("");
  }, [userId]);

  async function handleSubmit() {
    setMsg(null);
    if (!fromBoxId || !toBoxId) { setMsg({ kind: "err", text: "Select both boxes." }); return; }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 1) { setMsg({ kind: "err", text: "Amount must be at least $1." }); return; }
    if (!reason.trim()) { setMsg({ kind: "err", text: "Reason is required." }); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/move-funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromBoxId,
          toBoxId,
          amountInDollars: amt,
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: "err", text: data.error ?? "Failed." });
      } else {
        setMsg({ kind: "ok", text: `Moved $${amt}. New balances logged.` });
        setAmount("");
        setReason("");
      }
    } catch {
      setMsg({ kind: "err", text: "Request failed." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 flex flex-col gap-2">
      <div className="text-sm font-semibold text-gray-900">Manual move funds</div>
      <select
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
      >
        <option value="">Select user…</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.email}
          </option>
        ))}
      </select>
      <select
        value={fromBoxId}
        onChange={(e) => setFromBoxId(e.target.value)}
        disabled={!userId || userBoxes.length === 0}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 disabled:opacity-50"
      >
        <option value="">From box…</option>
        {userBoxes.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name} · {currency(b.balance)}
          </option>
        ))}
      </select>
      <select
        value={toBoxId}
        onChange={(e) => setToBoxId(e.target.value)}
        disabled={!fromBoxId || destBoxes.length === 0}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 disabled:opacity-50"
      >
        <option value="">To box…</option>
        {destBoxes.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name} · {currency(b.balance)}
          </option>
        ))}
      </select>
      <input
        type="number"
        min="1"
        placeholder="Amount ($)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
      />
      <input
        type="text"
        placeholder="Reason (audited)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
      />
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="mt-1 w-full py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Moving…" : "Move funds"}
      </button>
      {msg && (
        <p className={`text-xs ${msg.kind === "ok" ? "text-emerald-600" : "text-rose-600"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

// ── Password Reset ───────────────────────────────────────────

function PasswordResetTool() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function handleSubmit() {
    setMsg(null);
    if (!email.trim()) { setMsg({ kind: "err", text: "Email required." }); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        setMsg({ kind: "err", text: "Failed." });
      } else {
        setMsg({ kind: "ok", text: "Reset email sent (if user exists)." });
        setEmail("");
      }
    } catch {
      setMsg({ kind: "err", text: "Request failed." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 flex flex-col gap-2">
      <div className="text-sm font-semibold text-gray-900">Trigger password reset</div>
      <p className="text-xs text-gray-500">
        Sends a reset email. Returns generic success regardless of account existence.
      </p>
      <input
        type="email"
        placeholder="user@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
      />
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="mt-1 w-full py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Sending…" : "Send reset email"}
      </button>
      {msg && (
        <p className={`text-xs ${msg.kind === "ok" ? "text-emerald-600" : "text-rose-600"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

// ── Restrict Account ─────────────────────────────────────────

function RestrictAccountTool({ users }: { users: UserLite[] }) {
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const selected = users.find((u) => u.id === userId);
  const isRestricted = selected?.isRestricted ?? false;

  async function handleSubmit(restrict: boolean) {
    setMsg(null);
    if (!userId) { setMsg({ kind: "err", text: "Select a user." }); return; }
    if (restrict && !reason.trim()) { setMsg({ kind: "err", text: "Reason required." }); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/restrict-user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, restrict, reason: restrict ? reason.trim() : undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: "err", text: data.error ?? "Failed." });
      } else {
        setMsg({
          kind: "ok",
          text: restrict ? "Account restricted." : "Restriction lifted.",
        });
        setReason("");
      }
    } catch {
      setMsg({ kind: "err", text: "Request failed." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 flex flex-col gap-2">
      <div className="text-sm font-semibold text-gray-900">Restrict account</div>
      <select
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
      >
        <option value="">Select user…</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.email}
            {u.isRestricted ? " · restricted" : ""}
          </option>
        ))}
      </select>
      {selected && (
        <p className={`text-xs ${isRestricted ? "text-rose-600" : "text-gray-500"}`}>
          Status: {isRestricted ? `Restricted — ${selected.restrictedReason ?? "no reason"}` : "Active"}
        </p>
      )}
      {!isRestricted && (
        <input
          type="text"
          placeholder="Reason (required)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
        />
      )}
      {isRestricted ? (
        <button
          onClick={() => handleSubmit(false)}
          disabled={loading}
          className="mt-1 w-full py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Working…" : "Lift restriction"}
        </button>
      ) : (
        <button
          onClick={() => handleSubmit(true)}
          disabled={loading}
          className="mt-1 w-full py-2 rounded-lg bg-rose-600 text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Working…" : "Restrict account"}
        </button>
      )}
      {msg && (
        <p className={`text-xs ${msg.kind === "ok" ? "text-emerald-600" : "text-rose-600"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
