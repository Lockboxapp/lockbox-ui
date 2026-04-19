// ============================================================
// lib/email.ts
// Resend email client + all transactional email functions
// ============================================================

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "LockBox <noreply@lockboxfinance.com>"; // update with your domain
const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

// Sprint 10 — personal founder emails for the waitlist nurture sequence.
// These are plain-text only, sent from Darian's address, and include an
// unsubscribe footer. Not transactional system mail.
const FROM_DARIAN = "Darian at LockBox <darian@lockboxfinance.com>";
const PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXTAUTH_URL ??
  "https://lockboxfinance.com";

function unsubscribeFooter(entryId: string) {
  const token = Buffer.from(entryId).toString("base64");
  const url = `${PUBLIC_BASE_URL}/api/waitlist/unsubscribe?token=${encodeURIComponent(token)}`;
  return `\n\n—\nUnsubscribe: ${url}`;
}

// ------------------------------------------------------------
// Email 1 — Day 1 — Immediate on waitlist signup
// ------------------------------------------------------------
export async function sendWaitlistEmail1({
  to,
  entryId,
}: {
  to: string;
  entryId: string;
}) {
  const body = `Hey,

You're on the LockBox waitlist. I'll reach out personally when your spot opens up.

While you wait — a quick word on why this exists.

I kept spending money that was supposed to go to bills. Not because I didn't know better. I knew exactly what I was doing. The problem wasn't information. The problem was access. The money was there, the bill wasn't due yet, and in that gap — I made bad decisions.

Every budgeting app I tried gave me the same thing: categories, charts, gentle reminders. None of them made the money actually harder to reach. And that's the only thing that would have helped me.

So I built LockBox.

You lock your money into a box. You set a date. And until that date, the money is genuinely hard to get to — not just a screen tap away. If you want out early, you have to explain yourself. And if you added a keyholder, someone you trust has to approve it.

That's the whole product. Real friction. Real money. Real accountability.

I'll be in touch.

Darian
Founder, LockBox
lockboxfinance.com${unsubscribeFooter(entryId)}`;

  await resend.emails.send({
    from: FROM_DARIAN,
    to,
    subject: "You're on the list.",
    text: body,
  });
}

// ------------------------------------------------------------
// Email 2 — Day 3 — The willpower problem
// ------------------------------------------------------------
export async function sendWaitlistEmail2({
  to,
  entryId,
}: {
  to: string;
  entryId: string;
}) {
  const body = `Hey,

Most financial advice assumes the problem is knowledge.

If you just knew your numbers. If you just tracked your spending. If you just made a budget.

But most people who overspend know exactly what they're doing. They're not confused. They're not unaware. They're just in a moment where the money is available and the consequence feels far away.

Willpower is a terrible financial strategy. It works sometimes. It fails when it matters most.

The research on this is pretty clear: when you reduce access, behavior changes. Not because people become more disciplined — but because the environment does the work instead of the person.

That's what LockBox is built on. Not motivation. Not reminders. Just a real barrier between you and money you've already decided to protect.

You put your rent money in a box. You set the date. The box closes. Now your environment is doing the work — not you.

We're almost ready. I'll let you know when your spot opens.

Darian
Founder, LockBox
lockboxfinance.com${unsubscribeFooter(entryId)}`;

  await resend.emails.send({
    from: FROM_DARIAN,
    to,
    subject: "The willpower problem",
    text: body,
  });
}

// ------------------------------------------------------------
// Email 3 — Day 7 — How the keyholder system works
// ------------------------------------------------------------
export async function sendWaitlistEmail3({
  to,
  entryId,
}: {
  to: string;
  entryId: string;
}) {
  const body = `Hey,

One of the features people ask about most is the keyholder.

Here's how it works.

When you lock a box, you can optionally assign someone you trust — a partner, a parent, a close friend — as your keyholder. If you try to access the money early, they get notified. They can approve it or deny it.

That's it. No shared accounts. No access to your money. They just hold the key.

The reason this works isn't because your keyholder is a gatekeeper. It's because you chose them. You told someone "I'm trying to protect this money" — and now that's real. The moment you try to unlock early, you have to face that.

Most of the time, people don't even complete the request. The act of writing out why you need the money early is enough to make you reconsider.

That's the behavioral mechanic. Friction creates pause. Pause creates better decisions.

You don't have to use a keyholder. But if you've ever blown money you promised yourself you wouldn't touch — it's worth thinking about.

We're getting close. Your spot is coming.

Darian
Founder, LockBox
lockboxfinance.com${unsubscribeFooter(entryId)}`;

  await resend.emails.send({
    from: FROM_DARIAN,
    to,
    subject: "How the keyholder system works",
    text: body,
  });
}

// ------------------------------------------------------------
// Keyholder invite email
// Sent when a box owner invites someone to be their keyholder
// ------------------------------------------------------------
export async function sendKeyholderInvite({
  keyholderEmail,
  keyholderName,
  ownerName,
  inviteToken,
}: {
  keyholderEmail: string;
  keyholderName?: string | null;
  ownerName?: string | null;
  inviteToken: string;
}) {
  const acceptUrl = `${BASE_URL}/keyholder/accept?token=${inviteToken}`;
  const greeting = keyholderName ? `Hi ${keyholderName},` : "Hi,";
  const owner = ownerName ?? "Someone";

  await resend.emails.send({
    from: FROM,
    to: keyholderEmail,
    subject: `${owner} wants you to be their LockBox keyholder`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">You've been invited</h2>
        <p>${greeting}</p>
        <p><strong>${owner}</strong> has invited you to be their LockBox keyholder.</p>
        <p>As a keyholder, you'll receive requests if they try to unlock their
        savings early. You decide whether to approve or deny each request.</p>
        <p>You cannot move or access their funds — you only approve or deny
        unlock requests.</p>
        <a href="${acceptUrl}" style="
          display: inline-block;
          background: #b8952a;
          color: white;
          padding: 12px 24px;
          border-radius: 6px;
          text-decoration: none;
          font-weight: bold;
          margin: 16px 0;
        ">Accept Keyholder Role</a>
        <p style="color: #666; font-size: 13px;">
          This invite expires in 7 days. If you weren't expecting this,
          you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

// ------------------------------------------------------------
// Unlock request email — sent to the keyholder only
// SECURITY: approvalToken is included in keyholder links only.
// This function must never be called with the box owner's email.
// ------------------------------------------------------------
// ------------------------------------------------------------
// Transfer-request email — sent to the keyholder only
// Sprint 6: approving moves funds from one box to another while
// keeping the source box LOCKED. Not the same as a full unlock.
// ------------------------------------------------------------
export async function sendTransferRequestToKeyholder({
  keyholderEmail,
  keyholderName,
  ownerName,
  boxName,
  destinationName,
  amountDollars,
  reason,
  approvalToken,
}: {
  keyholderEmail: string;
  keyholderName?: string | null;
  ownerName?: string | null;
  boxName: string;
  destinationName: string;
  amountDollars: number;
  reason?: string | null;
  approvalToken: string;
}) {
  const approveUrl = `${BASE_URL}/keyholder?token=${approvalToken}`;
  const greeting = keyholderName ? `Hi ${keyholderName},` : "Hi,";
  const owner = ownerName ?? "Your friend";
  const amtStr = `$${amountDollars.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  await resend.emails.send({
    from: FROM,
    to: keyholderEmail,
    subject: `${owner} is requesting a transfer from a locked box`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Transfer Request</h2>
        <p>${greeting}</p>
        <p><strong>${owner}</strong> is requesting a transfer from their locked box
        <strong>"${boxName}"</strong>:</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 6px; margin: 16px 0;">
          <p style="margin: 0 0 8px; font-size: 15px;">
            <strong>${amtStr}</strong> from <strong>${boxName}</strong> to <strong>${destinationName}</strong>
          </p>
          <p style="margin: 8px 0 0; color: #555; font-size: 13px;">
            The box will stay locked. Only the requested amount will move.
          </p>
          ${reason ? `<p style="margin: 12px 0 0; color: #333;"><strong>Reason:</strong> ${reason}</p>` : ""}
        </div>
        <a href="${approveUrl}" style="
          display: inline-block;
          background: #16a34a;
          color: white;
          padding: 12px 24px;
          border-radius: 6px;
          text-decoration: none;
          font-weight: bold;
        ">Review request</a>
        <p style="color: #666; font-size: 13px; margin-top: 20px;">
          You're receiving this because you are the keyholder for this LockBox.
        </p>
      </div>
    `,
  });
}

export async function sendUnlockRequestToKeyholder({
  keyholderEmail,
  keyholderName,
  ownerName,
  boxName,
  reason,
  reflection,
  approvalToken,
}: {
  keyholderEmail: string;
  keyholderName?: string | null;
  ownerName?: string | null;
  boxName: string;
  reason: string;
  reflection?: string | null;
  approvalToken: string;
}) {
  const approveUrl = `${BASE_URL}/keyholder?token=${approvalToken}`;
  const denyUrl = `${BASE_URL}/keyholder?token=${approvalToken}`;
  const greeting = keyholderName ? `Hi ${keyholderName},` : "Hi,";
  const owner = ownerName ?? "Your friend";

  await resend.emails.send({
    from: FROM,
    to: keyholderEmail,
    subject: `${owner} is requesting an early unlock`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Unlock Request</h2>
        <p>${greeting}</p>
        <p><strong>${owner}</strong> is requesting early access to their locked box
        <strong>"${boxName}"</strong>.</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 6px; margin: 16px 0;">
          <p style="margin: 0 0 8px;"><strong>Their reason:</strong></p>
          <p style="margin: 0; color: #333;">${reason}</p>
          ${
            reflection
              ? `
          <p style="margin: 12px 0 8px;"><strong>Their reflection:</strong></p>
          <p style="margin: 0; color: #333;">${reflection}</p>
          `
              : ""
          }
        </div>
        <div style="display: flex; gap: 12px; margin: 16px 0;">
          <a href="${approveUrl}" style="
            display: inline-block;
            background: #16a34a;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: bold;
          ">Approve</a>
          <a href="${denyUrl}" style="
            display: inline-block;
            background: #dc2626;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: bold;
            margin-left: 12px;
          ">Deny</a>
        </div>
        <p style="color: #666; font-size: 13px;">
          You're receiving this because you are the keyholder for this LockBox.
        </p>
      </div>
    `,
  });
}

// ------------------------------------------------------------
// Unlock result email — sent to the box owner after decision
// Does NOT contain any tokens — purely informational
// ------------------------------------------------------------
export async function sendUnlockResult({
  ownerEmail,
  ownerName,
  boxName,
  approved,
}: {
  ownerEmail: string;
  ownerName?: string | null;
  boxName: string;
  approved: boolean;
}) {
  const greeting = ownerName ? `Hi ${ownerName},` : "Hi,";
  const status = approved ? "approved" : "denied";
  const statusColor = approved ? "#16a34a" : "#dc2626";

  await resend.emails.send({
    from: FROM,
    to: ownerEmail,
    subject: `Your unlock request was ${status}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: ${statusColor};">
          Unlock request ${status}
        </h2>
        <p>${greeting}</p>
        <p>Your request to unlock <strong>"${boxName}"</strong> has been
        <strong style="color: ${statusColor};">${status}</strong> by your keyholder.</p>
        ${
          approved
            ? `<p>Your box is now unlocked. Remember why you set this up.</p>`
            : `<p>Your keyholder wants you to stay the course. A 24-hour cooldown is now active before you can request again.</p>`
        }
        <p style="color: #666; font-size: 13px;">— The LockBox Banker</p>
      </div>
    `,
  });
}
// ------------------------------------------------------------
// OTP verification email — sent to keyholder before approve/deny
// Code only — no links, no tokens
// ------------------------------------------------------------
export async function sendKeyholderOTP({
  keyholderEmail,
  keyholderName,
  code,
}: {
  keyholderEmail: string;
  keyholderName?: string | null;
  code: string;
}) {
  const greeting = keyholderName ? `Hi ${keyholderName},` : "Hi,";

  await resend.emails.send({
    from: FROM,
    to: keyholderEmail,
    subject: `Your LockBox verification code`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Your verification code</h2>
        <p>${greeting}</p>
        <p>Use the code below to verify your identity and review the unlock request.</p>
        <div style="
          background: #f5f5f5;
          border-radius: 8px;
          padding: 24px;
          text-align: center;
          margin: 24px 0;
        ">
          <span style="
            font-size: 36px;
            font-weight: bold;
            letter-spacing: 8px;
            color: #1a1a1a;
            font-family: monospace;
          ">${code}</span>
        </div>
        <p style="color: #666; font-size: 13px;">
          This code expires in 10 minutes. Do not share it with anyone,
          including the person who sent the unlock request.
        </p>
        <p style="color: #666; font-size: 13px;">
          If you did not request this code, ignore this email.
          The unlock request will remain pending.
        </p>
      </div>
    `,
  });
}
export async function sendWelcomeEmail({
  userEmail,
  userName,
}: {
  userEmail: string;
  userName: string;
}) {
  const FROM = "LockBox <noreply@lockboxfinance.com>";

  await resend.emails.send({
    from: FROM,
    to: userEmail,
    subject: "Welcome to LockBox",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <div style="margin-bottom: 24px;">
          <span style="font-weight: bold; font-size: 18px;">🔒 LockBox</span>
        </div>

        <h2 style="margin-bottom: 8px;">Welcome${userName ? `, ${userName}` : ""}.</h2>
        <p style="color: #555; line-height: 1.6;">Your account is set up. You're now part of a small group of people who take their financial commitments seriously.</p>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="margin: 0; font-size: 14px; color: #166534; line-height: 1.6;">
            Your money is protected the moment you lock it. No impulse spending. No excuses. Just discipline.
          </p>
        </div>

        <p style="color: #555; line-height: 1.6;">Here's what to do next:</p>
        <ul style="color: #555; line-height: 2;">
          <li>Deposit funds into your box</li>
          <li>Lock it until your due date</li>
          <li>Add a keyholder for extra accountability</li>
        </ul>

        <a href="https://lockboxfinance.com" style="display:inline-block;background:#059669;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">
          Open LockBox
        </a>

        <p style="color: #999; font-size: 12px; margin-top: 32px; font-style: italic;">
          "Stay consistent." — The Banker
        </p>
        <p style="color: #ccc; font-size: 11px;">
          LockBox · <a href="https://lockboxfinance.com" style="color:#ccc;">lockboxfinance.com</a> · 
          <a href="mailto:support@lockboxfinance.com" style="color:#ccc;">support@lockboxfinance.com</a>
        </p>
      </div>
    `,
  });
}
