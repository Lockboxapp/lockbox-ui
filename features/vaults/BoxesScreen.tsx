// ============================================================
// features/vaults/BoxesScreen.tsx
// Safe Deposit Boxes screen — fully wired to real API
// ============================================================
"use client";

import { useEffect, useState, useCallback } from "react";
import { currency } from "@/lib/helpers";
import { BOX_STATUS } from "@/lib/types";

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------
type Keyholder = {
  id: string;
  email: string;
  name: string | null;
  accepted: boolean;
};

type UnlockRequest = {
  id: string;
  status: string;
  reason: string;
  requestedAt: string;
};

type Box = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  balance: number;
  targetAmount: number | null;
  lockUntil: string | null;
  unitAccountId: string | null;
  keyholder: Keyholder | null;
  unlockRequests: UnlockRequest[];
  createdAt: string;
};

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function progressPct(balance: number, target: number | null): number {
  if (!target || target === 0) return 0;
  return Math.min(100, Math.round((balance / target) * 100));
}

function statusColor(status: string) {
  switch (status) {
    case BOX_STATUS.LOCKED:
      return "gold";
    case BOX_STATUS.UNLOCK_PENDING:
      return "coral";
    case BOX_STATUS.UNLOCKED:
      return "green";
    default:
      return "dim";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case BOX_STATUS.CREATED:
      return "⚬ New";
    case BOX_STATUS.FUNDING:
      return "⇡ Funding";
    case BOX_STATUS.LOCKED:
      return "🔒 Locked";
    case BOX_STATUS.UNLOCK_PENDING:
      return "⏳ Pending";
    case BOX_STATUS.UNLOCKED:
      return "🔓 Unlocked";
    case BOX_STATUS.CLOSED:
      return "✕ Closed";
    default:
      return status;
  }
}

// ------------------------------------------------------------
// Shared input styles
// ------------------------------------------------------------
const inp: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--card-border)",
  color: "var(--text)",
  fontSize: 14,
  boxSizing: "border-box",
};
const lbl: React.CSSProperties = {
  fontSize: 11,
  color: "var(--dim)",
  display: "block",
  marginBottom: 6,
};
const cancelBtn: React.CSSProperties = {
  padding: 12,
  borderRadius: 11,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--card-border)",
  color: "var(--dim)",
  fontSize: 13,
  cursor: "pointer",
};

// ------------------------------------------------------------
// Sheet wrapper
// ------------------------------------------------------------
function Sheet({
  onClose,
  border,
  children,
}: {
  onClose: () => void;
  border?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "flex-end",
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--slate2)",
          border: `1px solid ${border ?? "var(--card-border)"}`,
          borderRadius: "22px 22px 0 0",
          padding: "20px 18px 36px",
          width: "100%",
        }}
      >
        <div
          style={{
            width: 36,
            height: 3,
            background: "rgba(255,255,255,0.12)",
            borderRadius: 2,
            margin: "0 auto 18px",
          }}
        />
        {children}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// SummaryCard
// ------------------------------------------------------------
function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "gold" | "green";
}) {
  return (
    <div
      style={{
        background: "var(--slate)",
        border: "1px solid var(--card-border)",
        borderRadius: 13,
        padding: "11px 10px",
        textAlign: "center",
        flex: 1,
      }}
    >
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 14,
          marginBottom: 2,
          color:
            accent === "gold"
              ? "var(--gold)"
              : accent === "green"
              ? "var(--green)"
              : "var(--text)",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 9,
          letterSpacing: ".07em",
          textTransform: "uppercase",
          color: "var(--dim)",
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// BoxCard
// ------------------------------------------------------------
function BoxCard({
  box,
  onLock,
  onRequestUnlock,
  onInviteKeyholder,
  onDeposit,
}: {
  box: Box;
  onLock: (box: Box) => void;
  onRequestUnlock: (box: Box) => void;
  onInviteKeyholder: (box: Box) => void;
  onDeposit: (box: Box) => void;
}) {
  const pct = progressPct(box.balance, box.targetAmount);
  const color = statusColor(box.status);
  const isLocked = box.status === BOX_STATUS.LOCKED;
  const isPending = box.status === BOX_STATUS.UNLOCK_PENDING;
  const canFund =
    box.status === BOX_STATUS.CREATED || box.status === BOX_STATUS.FUNDING;
  const days = box.lockUntil ? daysUntil(box.lockUntil) : null;

  const pillBg =
    color === "gold"
      ? "var(--gold-bg)"
      : color === "green"
      ? "var(--green-bg)"
      : color === "coral"
      ? "var(--coral-bg)"
      : "rgba(255,255,255,0.04)";
  const pillBorder =
    color === "gold"
      ? "var(--gold-border)"
      : color === "green"
      ? "var(--green-border)"
      : color === "coral"
      ? "var(--coral-border)"
      : "var(--card-border)";
  const pillColor =
    color === "gold"
      ? "var(--gold)"
      : color === "green"
      ? "var(--green)"
      : color === "coral"
      ? "var(--coral)"
      : "var(--dim)";

  return (
    <div
      style={{
        background: "var(--slate)",
        border: `1px solid ${
          isLocked
            ? "var(--gold-border)"
            : isPending
            ? "var(--coral-border)"
            : "var(--card-border)"
        }`,
        borderRadius: 18,
        padding: 15,
        marginBottom: 12,
        transition: "border-color .2s",
      }}
    >
      {/* Top row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
            {box.name}
          </div>
          <div style={{ fontSize: 10, color: "var(--dim)", marginTop: 2 }}>
            {box.targetAmount
              ? `${currency(box.targetAmount / 100)} goal`
              : "No goal set"}
            {days !== null
              ? ` · ${days > 0 ? `${days}d left` : "due today"}`
              : ""}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            borderRadius: 99,
            padding: "3px 9px",
            fontSize: 10,
            background: pillBg,
            border: `1px solid ${pillBorder}`,
            color: pillColor,
          }}
        >
          {statusLabel(box.status)}
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 4,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 2,
          marginBottom: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 2,
            transition: "width .4s ease",
            background: isLocked
              ? "linear-gradient(90deg,#a07832,#c9a84c)"
              : "linear-gradient(90deg,#16a34a,#4ade80)",
          }}
        />
      </div>

      {/* Amounts */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 6,
          marginBottom: 12,
        }}
      >
        {[
          {
            label: "Saved",
            value: currency(box.balance / 100),
            accent: undefined,
          },
          {
            label: "Target",
            value: box.targetAmount ? currency(box.targetAmount / 100) : "—",
            accent: "gold" as const,
          },
          {
            label: "Progress",
            value: `${pct}%`,
            accent: isLocked ? ("gold" as const) : ("green" as const),
          },
        ].map(({ label, value, accent }) => (
          <div
            key={label}
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 8,
              padding: "7px 8px",
            }}
          >
            <div
              style={{
                fontSize: 9,
                letterSpacing: ".07em",
                textTransform: "uppercase",
                color: "var(--dim)",
                marginBottom: 3,
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 12,
                color:
                  accent === "gold"
                    ? "var(--gold)"
                    : accent === "green"
                    ? "var(--green)"
                    : "var(--text)",
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Keyholder */}
      {box.keyholder && (
        <div
          style={{
            background: "var(--gold-bg)",
            border: "1px solid var(--gold-border)",
            borderRadius: 10,
            padding: "7px 10px",
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontSize: 11, color: "var(--text)" }}>
            🔑 {box.keyholder.name ?? box.keyholder.email}
          </div>
          <div
            style={{
              fontSize: 10,
              color: box.keyholder.accepted ? "var(--green)" : "var(--dim)",
            }}
          >
            {box.keyholder.accepted ? "Active" : "Invite pending"}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 7 }}>
        {!box.keyholder && (
          <button
            onClick={() => onInviteKeyholder(box)}
            style={{
              flex: 1,
              padding: "8px 0",
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
              textAlign: "center",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--card-border)",
              color: "var(--dim)",
            }}
          >
            + Keyholder
          </button>
        )}
        {canFund && (
          <button
            onClick={() => onDeposit(box)}
            style={{
              flex: 1,
              padding: "8px 0",
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
              textAlign: "center",
              background: "var(--green-bg)",
              border: "1px solid var(--green-border)",
              color: "var(--green)",
            }}
          >
            + Deposit
          </button>
        )}
        {canFund && (
          <button
            onClick={() => onLock(box)}
            style={{
              flex: 1,
              padding: "8px 0",
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
              textAlign: "center",
              background: "var(--gold-bg)",
              border: "1px solid var(--gold-border)",
              color: "var(--gold)",
            }}
          >
            🔒 Lock
          </button>
        )}
        {isLocked && (
          <button
            onClick={() => onRequestUnlock(box)}
            style={{
              flex: 1,
              padding: "8px 0",
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
              textAlign: "center",
              background: "var(--coral-bg)",
              border: "1px solid var(--coral-border)",
              color: "var(--coral)",
            }}
          >
            Request Unlock
          </button>
        )}
        {isPending && (
          <div
            style={{
              flex: 1,
              padding: "8px 0",
              borderRadius: 10,
              fontSize: 11,
              textAlign: "center",
              color: "var(--dim)",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--card-border)",
            }}
          >
            Awaiting keyholder
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Create Box Modal
// ------------------------------------------------------------
function CreateBoxModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (data: {
    name: string;
    targetAmount: number;
    lockUntil: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [lockUntil, setLockUntil] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!targetAmount || isNaN(Number(targetAmount))) {
      setError("Valid target amount required");
      return;
    }
    if (!lockUntil) {
      setError("Lock date is required");
      return;
    }
    if (new Date(lockUntil) <= new Date()) {
      setError("Lock date must be in the future");
      return;
    }
    setLoading(true);
    try {
      await onConfirm({
        name: name.trim(),
        targetAmount: Number(targetAmount),
        lockUntil: new Date(lockUntil).toISOString(),
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet onClose={onClose} border="var(--gold-border)">
      <div
        style={{
          fontFamily: "var(--serif)",
          fontSize: 20,
          color: "var(--text)",
          marginBottom: 4,
        }}
      >
        New safe deposit box
      </div>
      <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 16 }}>
        Lock funds until your due date
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Rent — May"
          style={inp}
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Target amount ($)</label>
        <input
          type="number"
          value={targetAmount}
          onChange={(e) => setTargetAmount(e.target.value)}
          placeholder="1200"
          style={inp}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>Lock until</label>
        <input
          type="date"
          value={lockUntil}
          onChange={(e) => setLockUntil(e.target.value)}
          style={inp}
        />
      </div>
      {error && (
        <div style={{ fontSize: 11, color: "var(--coral)", marginBottom: 12 }}>
          {error}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
        <button onClick={onClose} style={cancelBtn}>
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            padding: 12,
            borderRadius: 11,
            background: "linear-gradient(135deg,#c9a84c,#a07832)",
            border: "none",
            color: "#0d0d0d",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {loading ? "Creating…" : "Create Safe Deposit Box"}
        </button>
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------
// Deposit Modal
// ------------------------------------------------------------
function DepositModal({
  box,
  onClose,
  onConfirm,
}: {
  box: Box;
  onClose: () => void;
  onConfirm: (amount: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!amount || isNaN(Number(amount)) || Number(amount) < 1) {
      setError("Minimum deposit is $1");
      return;
    }
    setLoading(true);
    try {
      await onConfirm(Number(amount));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet onClose={onClose} border="var(--green-border)">
      <div
        style={{
          fontFamily: "var(--serif)",
          fontSize: 20,
          color: "var(--text)",
          marginBottom: 4,
        }}
      >
        Deposit funds
      </div>
      <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 16 }}>
        {box.name}
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>Amount ($)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="100"
          style={inp}
        />
      </div>
      {error && (
        <div style={{ fontSize: 11, color: "var(--coral)", marginBottom: 12 }}>
          {error}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
        <button onClick={onClose} style={cancelBtn}>
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            padding: 12,
            borderRadius: 11,
            background: "var(--green-bg)",
            border: "1px solid var(--green-border)",
            color: "var(--green)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {loading ? "Depositing…" : `Deposit $${amount || "0"}`}
        </button>
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------
// Lock Modal
// ------------------------------------------------------------
function LockModal({
  box,
  onClose,
  onConfirm,
}: {
  box: Box;
  onClose: () => void;
  onConfirm: (lockUntil: string) => Promise<void>;
}) {
  const [lockUntil, setLockUntil] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!lockUntil) {
      setError("Pick a date");
      return;
    }
    if (new Date(lockUntil) <= new Date()) {
      setError("Must be a future date");
      return;
    }
    setLoading(true);
    try {
      await onConfirm(new Date(lockUntil).toISOString());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet onClose={onClose} border="var(--gold-border)">
      <div
        style={{
          fontFamily: "var(--serif)",
          fontSize: 20,
          color: "var(--text)",
          marginBottom: 4,
        }}
      >
        Lock safe deposit box
      </div>
      <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 16 }}>
        {box.name}
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>Lock until</label>
        <input
          type="date"
          value={lockUntil}
          onChange={(e) => setLockUntil(e.target.value)}
          style={inp}
        />
      </div>
      {error && (
        <div style={{ fontSize: 11, color: "var(--coral)", marginBottom: 12 }}>
          {error}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
        <button onClick={onClose} style={cancelBtn}>
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            padding: 12,
            borderRadius: 11,
            background: "linear-gradient(135deg,#c9a84c,#a07832)",
            border: "none",
            color: "#0d0d0d",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {loading ? "Locking…" : "🔒 Confirm Lock"}
        </button>
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------
// Unlock Request Modal
// ------------------------------------------------------------
function UnlockModal({
  box,
  onClose,
  onConfirm,
}: {
  box: Box;
  onClose: () => void;
  onConfirm: (reason: string, reflection: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [reflection, setReflection] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!reason.trim()) {
      setError("Explain your reason");
      return;
    }
    if (!reflection.trim()) {
      setError("Complete the reflection");
      return;
    }
    setLoading(true);
    try {
      await onConfirm(reason, reflection);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet onClose={onClose} border="var(--coral-border)">
      <div
        style={{
          fontFamily: "var(--serif)",
          fontSize: 20,
          color: "var(--text)",
          marginBottom: 4,
        }}
      >
        Request unlock
      </div>
      <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 16 }}>
        {box.name} · keyholder will be notified
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Why do you need to unlock early?</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Be honest."
          style={{ ...inp, resize: "none" } as React.CSSProperties}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>What will you do differently next time?</label>
        <textarea
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          rows={2}
          placeholder="Reflect before you unlock."
          style={{ ...inp, resize: "none" } as React.CSSProperties}
        />
      </div>
      {error && (
        <div style={{ fontSize: 11, color: "var(--coral)", marginBottom: 12 }}>
          {error}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
        <button onClick={onClose} style={cancelBtn}>
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            padding: 12,
            borderRadius: 11,
            background: "var(--coral-bg)",
            border: "1px solid var(--coral-border)",
            color: "var(--coral)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {loading ? "Submitting…" : "Submit Request"}
        </button>
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------
// Keyholder Invite Modal
// ------------------------------------------------------------
function KeyholderModal({
  box,
  onClose,
  onConfirm,
}: {
  box: Box;
  onClose: () => void;
  onConfirm: (email: string, name: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    setLoading(true);
    try {
      await onConfirm(email, name);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet onClose={onClose} border="var(--gold-border)">
      <div
        style={{
          fontFamily: "var(--serif)",
          fontSize: 20,
          color: "var(--text)",
          marginBottom: 4,
        }}
      >
        Invite keyholder
      </div>
      <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 16 }}>
        {box.name} · they'll approve any early unlock
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Their email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="partner@email.com"
          style={inp}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>Their name (optional)</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Marcus"
          style={inp}
        />
      </div>
      {error && (
        <div style={{ fontSize: 11, color: "var(--coral)", marginBottom: 12 }}>
          {error}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
        <button onClick={onClose} style={cancelBtn}>
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            padding: 12,
            borderRadius: 11,
            background: "linear-gradient(135deg,#c9a84c,#a07832)",
            border: "none",
            color: "#0d0d0d",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {loading ? "Sending…" : "Send Invite"}
        </button>
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------
// Main BoxesScreen
// ------------------------------------------------------------
export default function BoxesScreen() {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [lockTarget, setLockTarget] = useState<Box | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<Box | null>(null);
  const [keyholderTarget, setKeyholderTarget] = useState<Box | null>(null);
  const [depositTarget, setDepositTarget] = useState<Box | null>(null);

  const fetchBoxes = useCallback(async () => {
    try {
      const res = await fetch("/api/boxes");
      if (!res.ok) throw new Error("Failed to load boxes");
      setBoxes(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoxes();
  }, [fetchBoxes]);

  const totalSaved = boxes.reduce((sum, b) => sum + b.balance, 0);
  const totalLocked = boxes
    .filter(
      (b) =>
        b.status === BOX_STATUS.LOCKED || b.status === BOX_STATUS.UNLOCK_PENDING
    )
    .reduce((sum, b) => sum + b.balance, 0);
  const activeBoxes = boxes.filter(
    (b) => b.status !== BOX_STATUS.CLOSED
  ).length;

  async function handleCreateBox(data: {
    name: string;
    targetAmount: number;
    lockUntil: string;
  }) {
    const res = await fetch("/api/boxes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error ?? "Failed to create");
    }
    setShowCreate(false);
    await fetchBoxes();
  }

  async function handleDeposit(box: Box, amount: number) {
    const res = await fetch(`/api/boxes/${box.id}/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountInDollars: amount }),
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error ?? "Failed to deposit");
    }
    setDepositTarget(null);
    await fetchBoxes();
  }

  async function handleLock(box: Box, lockUntil: string) {
    const res = await fetch(`/api/boxes/${box.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lock", lockUntil }),
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error ?? "Failed to lock");
    }
    setLockTarget(null);
    await fetchBoxes();
  }

  async function handleUnlockRequest(
    box: Box,
    reason: string,
    reflection: string
  ) {
    const res = await fetch("/api/unlock-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boxId: box.id, reason, reflection }),
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error ?? "Failed to submit");
    }
    setUnlockTarget(null);
    await fetchBoxes();
  }

  async function handleInviteKeyholder(box: Box, email: string, name: string) {
    const res = await fetch("/api/keyholders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boxId: box.id, email, name: name || null }),
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error ?? "Failed to invite");
    }
    setKeyholderTarget(null);
    await fetchBoxes();
  }

  if (loading)
    return (
      <div
        style={{
          padding: 32,
          textAlign: "center",
          color: "var(--dim)",
          fontSize: 13,
        }}
      >
        Loading…
      </div>
    );
  if (error)
    return (
      <div style={{ padding: 16, color: "var(--coral)", fontSize: 13 }}>
        {error}
      </div>
    );

  return (
    <div style={{ padding: "14px 14px 100px" }}>
      {/* Summary */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <SummaryCard label="Total saved" value={currency(totalSaved / 100)} />
        <SummaryCard
          label="Locked"
          value={currency(totalLocked / 100)}
          accent="gold"
        />
        <SummaryCard
          label="Safe Deposit Boxes"
          value={String(activeBoxes)}
          accent="green"
        />
      </div>

      {/* New box button */}
      <button
        onClick={() => setShowCreate(true)}
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 14,
          marginBottom: 14,
          background: "var(--gold-bg)",
          border: "1px dashed var(--gold-border)",
          color: "var(--gold)",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        + New Safe Deposit Box
      </button>

      {/* Box list */}
      {boxes
        .filter((b) => b.status !== BOX_STATUS.CLOSED)
        .map((box) => (
          <BoxCard
            key={box.id}
            box={box}
            onLock={setLockTarget}
            onRequestUnlock={setUnlockTarget}
            onInviteKeyholder={setKeyholderTarget}
            onDeposit={setDepositTarget}
          />
        ))}

      {boxes.filter((b) => b.status !== BOX_STATUS.CLOSED).length === 0 && (
        <div
          style={{
            border: "1px dashed rgba(255,255,255,0.1)",
            borderRadius: 18,
            padding: 32,
            textAlign: "center",
            color: "var(--dim)",
            fontSize: 13,
          }}
        >
          No safe deposit boxes yet. Create your first one above.
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateBoxModal
          onClose={() => setShowCreate(false)}
          onConfirm={handleCreateBox}
        />
      )}
      {depositTarget && (
        <DepositModal
          box={depositTarget}
          onClose={() => setDepositTarget(null)}
          onConfirm={(amount) => handleDeposit(depositTarget, amount)}
        />
      )}
      {lockTarget && (
        <LockModal
          box={lockTarget}
          onClose={() => setLockTarget(null)}
          onConfirm={(lockUntil) => handleLock(lockTarget, lockUntil)}
        />
      )}
      {unlockTarget && (
        <UnlockModal
          box={unlockTarget}
          onClose={() => setUnlockTarget(null)}
          onConfirm={(reason, reflection) =>
            handleUnlockRequest(unlockTarget, reason, reflection)
          }
        />
      )}
      {keyholderTarget && (
        <KeyholderModal
          box={keyholderTarget}
          onClose={() => setKeyholderTarget(null)}
          onConfirm={(email, name) =>
            handleInviteKeyholder(keyholderTarget, email, name)
          }
        />
      )}
    </div>
  );
}
