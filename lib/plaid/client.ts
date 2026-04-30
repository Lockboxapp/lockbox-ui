// ============================================================
// lib/plaid/client.ts
// Plaid client factory — server-only.
// ============================================================
// Reads PLAID_CLIENT_ID, PLAID_SECRET, and PLAID_ENV at call time so
// Vercel Preview env (sandbox creds) is honored without leaking into
// the client bundle. PLAID_ENV defaults to 'sandbox' for safety.
// ============================================================

import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  type CountryCode,
  type Products,
} from "plaid";

export function getPlaidClient(): PlaidApi {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = (process.env.PLAID_ENV ?? "sandbox") as keyof typeof PlaidEnvironments;

  if (!clientId || !secret) {
    throw new Error("PLAID_CLIENT_ID and PLAID_SECRET must be set");
  }
  if (!(env in PlaidEnvironments)) {
    throw new Error(`Unknown PLAID_ENV: ${env}`);
  }

  const config = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });

  return new PlaidApi(config);
}

export const PLAID_PRODUCTS: Products[] = [
  "transactions" as Products,
];

export const PLAID_COUNTRY_CODES: CountryCode[] = [
  "US" as CountryCode,
];
