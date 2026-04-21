"use client";

// ============================================================
// HelpForms — Send feedback, Report a bug, How LockBox works
// accordion, and a mailto contact link.
// Submits to POST /api/feedback which emails Darian.
// ============================================================

import { useState } from "react";

type Kind = "feedback" | "bug";

const HOW_IT_WORKS: { title: string; body: string }[] = [
  {
    title: "What is a Wallet?",
    body: "Your Wallet is always liquid. The virtual card spends from here, and any funds you plan to use soon should sit here. You can transfer money from the Wallet into a box whenever you want to protect it.",
  },
  {
    title: "What are boxes?",
    body: "Boxes are intentional savings containers. You choose a protection level — Flexible, Fully locked, or Keyholder — and the rules for accessing the money inside. Protected boxes show a single 'Protected' figure so there's no ambiguity about what's reachable.",
  },
  {
    title: "What is a keyholder?",
    body: "A keyholder is a person you trust. When you set a box to Keyholder protection, they get notified any time you try to access the money early, and they can approve or deny. They don't have access to your funds — they just hold the key.",
  },
  {
    title: "What is a target date?",
    body: "A target date is a savings goal, not an automatic trigger. Nothing unlocks automatically when the date passes. It's there so the Banker can tell you whether you're on pace, and so you can see when you planned to release the money.",
  },
];

export default function HelpForms() {
  return (
    <>
      <FeedbackForm kind="feedback" title="Send feedback" defaultSubject="Feedback" />
      <FeedbackForm kind="bug" title="Report a bug" defaultSubject="Bug report" />

      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-2">
        <div className="text-sm font-medium text-gray-900">
          How LockBox works
        </div>
        <div className="divide-y divide-gray-100">
          {HOW_IT_WORKS.map((item) => (
            <Accordion key={item.title} title={item.title} body={item.body} />
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <div className="text-sm font-medium text-gray-900 mb-1">
          Contact support
        </div>
        <p className="text-xs text-gray-500 mb-2">
          For anything urgent, email us directly.
        </p>
        <a
          href="mailto:support@lockboxfinance.com"
          className="text-sm text-emerald-600 font-medium"
        >
          support@lockboxfinance.com →
        </a>
      </div>
    </>
  );
}

function FeedbackForm({
  kind,
  title,
  defaultSubject,
}: {
  kind: Kind;
  title: string;
  defaultSubject: string;
}) {
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setErr("");
    if (!message.trim()) {
      setErr("Please write a message.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, subject: subject.trim(), message: message.trim() }),
      });
      if (!res.ok) throw new Error();
      setOk(true);
      setMessage("");
      setSubject(defaultSubject);
    } catch {
      setErr("Couldn't send. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-2">
      <div className="text-sm font-medium text-gray-900">{title}</div>
      {ok ? (
        <p className="text-sm text-emerald-700">
          Thanks for your {kind === "bug" ? "bug report" : "feedback"}. We read every message.
          <button
            onClick={() => setOk(false)}
            className="block text-xs text-emerald-600 mt-1 underline"
          >
            Send another
          </button>
        </p>
      ) : (
        <>
          <label className="block text-xs font-medium text-gray-700">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900"
          />
          <label className="block text-xs font-medium text-gray-700 mt-1">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={5000}
            rows={4}
            placeholder={
              kind === "bug"
                ? "What happened? What did you expect? Steps to reproduce if you remember them."
                : "Anything on your mind — what's working, what isn't, what would make LockBox better."
            }
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900"
          />
          {err && <p className="text-xs text-rose-600">{err}</p>}
          <button
            onClick={submit}
            disabled={loading || !message.trim()}
            className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send"}
          </button>
        </>
      )}
    </div>
  );
}

function Accordion({ title, body }: { title: string; body: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((x) => !x)}
        className="w-full flex items-center justify-between py-3 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-gray-900">{title}</span>
        <span className="text-gray-400 text-sm">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <p className="pb-3 text-xs text-gray-600 leading-relaxed">{body}</p>
      )}
    </div>
  );
}
