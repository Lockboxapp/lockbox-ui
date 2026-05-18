// ============================================================
// lib/sms.ts
// SMS delivery via the Twilio REST API, called directly with
// `fetch` — no `twilio` npm package (AGENT.md §3: no new
// dependencies without founder approval).
//
// Env-gated: when TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN /
// TWILIO_FROM_NUMBER are not all set (local dev, or Twilio not
// yet provisioned), the call logs the message in dev and no-ops
// so the signup funnel still works end-to-end. Set the three env
// vars to go live — no code change required.
// ============================================================

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER;

/** Normalize a US phone number to E.164 (+1XXXXXXXXXX). */
export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

/**
 * Send a transactional SMS. No-ops (with a dev log) when Twilio is
 * not configured; throws when a configured send fails.
 */
export async function sendSms(to: string, body: string): Promise<void> {
  if (!TWILIO_SID || !TWILIO_AUTH || !TWILIO_FROM) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[sms] Twilio not configured — would send to ${to}: ${body}`);
    }
    return;
  }

  const params = new URLSearchParams({
    To: toE164(to),
    From: TWILIO_FROM,
    Body: body,
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${TWILIO_SID}:${TWILIO_AUTH}`,
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Twilio send failed (${res.status}): ${detail}`);
  }
}

/** Send a 6-digit signup verification code. */
export async function sendOtpSms(phone: string, code: string): Promise<void> {
  await sendSms(
    phone,
    `Your LockBox verification code is ${code}. It expires in 10 minutes.`,
  );
}
