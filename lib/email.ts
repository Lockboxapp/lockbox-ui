// ============================================================
// lib/email.ts
// Resend email client + all transactional email functions
// ============================================================

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "LockBox <notifications@yourdomain.com>"; // update with your domain
const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

// ------------------------------------------------------------
// Keyholder invite email
// Sent when a box owner invites someone to be their keyholder
// ------------------------------------------------------------
export async function sendKeyholderInvite({
  keyholderEmail,
  keyholderName,
  ownerName,
  boxName,
  inviteToken,
}: {
  keyholderEmail: string;
  keyholderName?: string | null;
  ownerName?: string | null;
  boxName: string;
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
        <p><strong>${owner}</strong> has invited you to be the keyholder for their
        LockBox called <strong>"${boxName}"</strong>.</p>
        <p>As a keyholder, you'll receive requests if they try to unlock their box early.
        You decide whether to approve or deny each request.</p>
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
          If you weren't expecting this, you can safely ignore this email.
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
  const approveUrl = `${BASE_URL}/api/unlock-requests/${approvalToken}/approve`;
  const denyUrl = `${BASE_URL}/api/unlock-requests/${approvalToken}/deny`;
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
