// ============================================================
// lib/sms.ts
// Phone verification via the Twilio Verify REST API, called
// directly with `fetch` — no `twilio` npm package (AGENT.md §3:
// no new dependencies without founder approval).
//
// Twilio Verify generates, sends, and checks the OTP itself — the
// app never sees, generates, or stores the code. `sendVerification`
// triggers a code; `checkVerification` validates a user-entered one.
//
// Env-gated: when the Twilio Verify env vars are not all set (local
// dev, or Verify not provisioned), `sendVerification` no-ops with a
// dev log and `checkVerification` returns false — signup fails
// closed rather than bypassing verification.
// ============================================================

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN;
// In Vercel this is currently named `Verify_Service_SID`; the
// canonical name is accepted too so either works.
const VERIFY_SERVICE_SID =
  process.env.TWILIO_VERIFY_SERVICE_SID ?? process.env.Verify_Service_SID;

const VERIFY_BASE = "https://verify.twilio.com/v2/Services";

/**
 * Normalize a phone number to E.164 (+[countrycode][number]).
 * Always strips formatting and returns a `+`-prefixed digit string,
 * so identical input yields an identical value at send and check
 * time — Twilio Verify matches verifications by an exact `To`.
 */
export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Bare US/Canada local number — assume +1.
  if (digits.length === 10) return `+1${digits}`;
  // Already carries the +1 country code.
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  // Any other length — an already-prefixed international number.
  // Strip formatting and re-prefix so spaces/dashes never survive.
  return `+${digits}`;
}

function isConfigured(): boolean {
  return Boolean(TWILIO_SID && TWILIO_AUTH && VERIFY_SERVICE_SID);
}

function authHeader(): string {
  return `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString(
    "base64",
  )}`;
}

/**
 * Trigger a Twilio Verify SMS OTP to `phone`. No-ops (with a dev
 * log) when Twilio Verify is not configured.
 */
export async function sendVerification(phone: string): Promise<void> {
  if (!isConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[sms] Twilio Verify not configured — would send OTP to ${phone}`,
      );
    }
    return;
  }

  const params = new URLSearchParams({ To: toE164(phone), Channel: "sms" });
  const res = await fetch(
    `${VERIFY_BASE}/${VERIFY_SERVICE_SID}/Verifications`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Twilio Verify send failed (${res.status}): ${detail}`);
  }
}

/**
 * Check a user-entered OTP against Twilio Verify. Returns true only
 * when Twilio reports the code as `approved`. Returns false when the
 * verification is expired/consumed (404) or Verify is not configured.
 */
export async function checkVerification(
  phone: string,
  code: string,
): Promise<boolean> {
  if (!isConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[sms] Twilio Verify not configured — cannot verify ${phone}`,
      );
    }
    return false;
  }

  const params = new URLSearchParams({ To: toE164(phone), Code: code });
  const res = await fetch(
    `${VERIFY_BASE}/${VERIFY_SERVICE_SID}/VerificationChecks`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );

  // 404 — the verification expired, was already approved, or hit its
  // attempt limit. Treat as a failed check.
  if (res.status === 404) return false;

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Twilio Verify check failed (${res.status}): ${detail}`);
  }

  const data = (await res.json().catch(() => null)) as {
    status?: string;
  } | null;
  return data?.status === "approved";
}
