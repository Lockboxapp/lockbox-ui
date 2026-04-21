"use client";

// ============================================================
// ProfileForm — editable name + timezone.
// Name and timezone save via PATCH /api/user/profile. Email is
// read-only. Delete account is "Coming soon" (not built yet).
// ============================================================

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Athens",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
];

function timezoneOptions(current: string | null) {
  const set = new Set(COMMON_TIMEZONES);
  if (current) set.add(current);
  try {
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browser) set.add(browser);
  } catch {
    // ignore
  }
  return Array.from(set).sort();
}

export default function ProfileForm({
  initialName,
  email,
  initialTimezone,
  memberSince,
}: {
  initialName: string;
  email: string;
  initialTimezone: string;
  memberSince: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [savingName, setSavingName] = useState(false);
  const [savingTz, setSavingTz] = useState(false);
  const [msg, setMsg] = useState<
    { kind: "ok" | "err"; text: string; field: "name" | "tz" } | null
  >(null);
  const [tzOptions, setTzOptions] = useState<string[]>(() =>
    timezoneOptions(initialTimezone),
  );

  useEffect(() => {
    setTzOptions(timezoneOptions(initialTimezone));
  }, [initialTimezone]);

  const memberSinceLabel = new Date(memberSince).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  async function saveName() {
    setMsg(null);
    if (!name.trim()) {
      setMsg({ kind: "err", field: "name", text: "Name can't be empty." });
      return;
    }
    if (name.trim() === initialName) return;
    setSavingName(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error();
      setMsg({ kind: "ok", field: "name", text: "Saved." });
      router.refresh();
    } catch {
      setMsg({ kind: "err", field: "name", text: "Couldn't save." });
    } finally {
      setSavingName(false);
    }
  }

  async function saveTimezone(next: string) {
    setMsg(null);
    if (next === initialTimezone) return;
    setSavingTz(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: next }),
      });
      if (!res.ok) throw new Error();
      setMsg({ kind: "ok", field: "tz", text: "Saved." });
      router.refresh();
    } catch {
      setMsg({ kind: "err", field: "tz", text: "Couldn't save." });
    } finally {
      setSavingTz(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Display name */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-2">
        <label className="block text-sm font-medium text-gray-900">
          Display name
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900"
          />
          <button
            onClick={saveName}
            disabled={savingName || !name.trim() || name.trim() === initialName}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {savingName ? "Saving…" : "Save"}
          </button>
        </div>
        {msg?.field === "name" && (
          <p
            className={`text-xs ${msg.kind === "ok" ? "text-emerald-600" : "text-rose-600"}`}
          >
            {msg.text}
          </p>
        )}
      </div>

      {/* Email (read-only) */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-1">
        <label className="block text-sm font-medium text-gray-900">Email</label>
        <div className="text-sm text-gray-700">{email || "—"}</div>
        <p className="text-xs text-gray-500">
          Email changes aren't supported yet. Contact support if you need to
          switch accounts.
        </p>
      </div>

      {/* Timezone */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-2">
        <label className="block text-sm font-medium text-gray-900">
          Timezone
        </label>
        <select
          value={timezone}
          onChange={(e) => {
            setTimezone(e.target.value);
            void saveTimezone(e.target.value);
          }}
          disabled={savingTz}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900"
        >
          <option value="">(not set — uses UTC)</option>
          {tzOptions.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        {msg?.field === "tz" && (
          <p
            className={`text-xs ${msg.kind === "ok" ? "text-emerald-600" : "text-rose-600"}`}
          >
            {msg.text}
          </p>
        )}
      </div>

      {/* Member since */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-1">
        <label className="block text-sm font-medium text-gray-900">
          Member since
        </label>
        <div className="text-sm text-gray-700">{memberSinceLabel}</div>
      </div>

      {/* Change password */}
      <Link
        href="/forgot-password"
        className="w-full bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center justify-between hover:bg-gray-50"
      >
        <div>
          <div className="text-sm font-medium text-gray-900">Change password</div>
          <div className="text-xs text-gray-500">
            We'll email you a secure reset link.
          </div>
        </div>
        <span className="text-gray-400 text-sm">›</span>
      </Link>

      {/* Delete account — coming soon */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center justify-between opacity-70">
        <div>
          <div className="text-sm font-medium text-gray-400">
            Delete account
            <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400 font-medium">
              Coming soon
            </span>
          </div>
          <div className="text-xs text-gray-500">
            Contact support if you need to delete your data sooner.
          </div>
        </div>
      </div>
    </div>
  );
}
