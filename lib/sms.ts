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
// Env-gated: when the Twilio Verify env vars are not all set,
// production HARD-FAILS (so signup surfaces a real error instead of
// silently mislabeling later as "Invalid code"); local dev no-ops
// so the rest of the flow stays exercisable.
// ============================================================

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN;
// In Vercel this is currently named `Verify_Service_SID`; the
// canonical name is accepted too so either works.
const VERIFY_SERVICE_SID =
  process.env.TWILIO_VERIFY_SERVICE_SID ?? process.env.Verify_Service_SID;

const VERIFY_BASE = "https://verify.twilio.com/v2/Services";

/**
 * Discriminated result of a verification check. Lets the caller
 * distinguish "wrong code" from "verification no longer exists" so
 * the user-facing message can be accurate.
 */
export type CheckResult =
  | { ok: true }
  | {
      ok: false;
      reason: "invalid" | "expired" | "not_configured" | "error";
      detail?: string;
    };

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

export function isVerifyConfigured(): boolean {
  return Boolean(TWILIO_SID && TWILIO_AUTH && VERIFY_SERVICE_SID);
}

function authHeader(): string {
  return `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString(
    "base64",
  )}`;
}

/**
 * Trigger a Twilio Verify SMS OTP to `phone`. Returns the Twilio
 * verification SID so the caller can persist it and later check by
 * SID (more reliable than checking by phone).
 *
 * In production, throws when Twilio Verify is not configured — a
 * silent no-op here is what previously made misconfiguration look
 * like "Invalid code" several screens later. In non-prod the call
 * no-ops so the flow remains exercisable without Twilio.
 */
export async function sendVerification(
  phone: string,
): Promise<{ sid: string | null }> {
  if (!isVerifyConfigured()) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[sms.sendVerification] Twilio Verify is not configured in production",
      );
      throw new Error("SMS verification is not configured");
    }
    return { sid: null };
  }

  const to = toE164(phone);
  const params = new URLSearchParams({ To: to, Channel: "sms" });
  const url = `${VERIFY_BASE}/${VERIFY_SERVICE_SID}/Verifications`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const bodyText = await res.text().catch(() => "");
  type TwilioBody = { status?: string; sid?: string };
  let parsed: TwilioBody | null = null;
  try {
    parsed = bodyText ? (JSON.parse(bodyText) as TwilioBody) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    console.error(
      `[sms.sendVerification] Twilio send failed http=${res.status}`,
    );
    throw new Error(
      `Twilio Verify send failed (http=${res.status}): ${bodyText}`,
    );
  }

  return { sid: parsed?.sid ?? null };
}

/**
 * Check a user-entered OTP against Twilio Verify. Distinguishes:
 *  - `ok: true`                    — Twilio reports `approved`.
 *  - `reason: "invalid"`           — Twilio 200 + status !== approved
 *                                    (pending = wrong code).
 *  - `reason: "expired"`           — Twilio 404 (verification expired,
 *                                    already approved, or max attempts).
 *  - `reason: "not_configured"`    — env vars missing.
 *  - `reason: "error"`             — unexpected Twilio failure.
 *
 * When `verificationSid` is provided, the check is keyed off Twilio's
 * own opaque SID (immune to any phone-normalization drift between
 * send and check). Otherwise it falls back to keying off the To phone.
 */
export async function checkVerification(
  phone: string,
  code: string,
  verificationSid?: string | null,
): Promise<CheckResult> {
  if (!isVerifyConfigured()) {
    console.error(
      "[sms.checkVerification] Twilio Verify is not configured",
    );
    return { ok: false, reason: "not_configured" };
  }

  const to = toE164(phone);
  const useSid = Boolean(verificationSid);
  const params = useSid
    ? new URLSearchParams({
        VerificationSid: verificationSid as string,
        Code: code,
      })
    : new URLSearchParams({ To: to, Code: code });
  const url = `${VERIFY_BASE}/${VERIFY_SERVICE_SID}/VerificationCheck`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const bodyText = await res.text().catch(() => "");
  type TwilioBody = { status?: string; sid?: string };
  let parsed: TwilioBody | null = null;
  try {
    parsed = bodyText ? (JSON.parse(bodyText) as TwilioBody) : null;
  } catch {
    parsed = null;
  }

  // Twilio returns 404 when the verification is gone — expired,
  // already approved, or hit its attempt limit. This is NOT the same
  // as a wrong code; surface it distinctly so the UI can tell the
  // user to request a new one instead of misleadingly saying "Invalid".
  if (res.status === 404) {
    return { ok: false, reason: "expired" };
  }

  if (!res.ok) {
    console.error(
      `[sms.checkVerification] Twilio check failed http=${res.status}`,
    );
    return { ok: false, reason: "error", detail: bodyText };
  }

  if (parsed?.status === "approved") return { ok: true };
  // Twilio 200 with status `pending` means the code was checked but
  // did not match. Treat that as a genuine "invalid code".
  return { ok: false, reason: "invalid" };
}
