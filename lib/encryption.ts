// ============================================================
// lib/encryption.ts
// AES-256-GCM helpers for at-rest encryption of sensitive
// strings (Sprint 17 — Plaid access tokens).
// ============================================================
// Storage format: "<ivHex>:<tagHex>:<dataHex>"
//   - 96-bit IV is fresh per call (GCM nonce reuse = key compromise)
//   - 128-bit auth tag verifies integrity on decrypt
// ENCRYPTION_KEY must be a 64-char hex string (32 bytes / 256 bits).
// ============================================================

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must be 32 bytes (64 hex characters) for AES-256",
    );
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit GCM nonce
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(payload: string): string {
  const key = getKey();
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("Malformed encrypted payload");
  }
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
