// ============================================================
// lib/unit.ts
// Unit BaaS API client
// All Unit API calls go through this file — never call Unit
// directly from route handlers
// ============================================================

const UNIT_API_URL = "https://api.s.unit.sh"; // sandbox
const UNIT_TOKEN = process.env.UNIT_API_TOKEN;
console.log("[Unit] Token prefix:", UNIT_TOKEN?.slice(0, 20));

if (!UNIT_TOKEN) {
  console.warn("[Unit] UNIT_API_TOKEN is not set");
}

// ------------------------------------------------------------
// Base fetch wrapper
// ------------------------------------------------------------
async function unitFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${UNIT_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${UNIT_TOKEN}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => null);
    console.error("[Unit API Error]", JSON.stringify(error, null, 2));
    const message =
      error?.errors?.[0]?.detail ?? error?.errors?.[0]?.title ?? res.statusText;
    throw new Error(`[Unit ${res.status}] ${message}`);
  }

  return res.json();
}

// ------------------------------------------------------------
// Customers
// Creates an individual customer in Unit (required before
// creating accounts — this is where KYC/CIP runs)
// ------------------------------------------------------------
export async function createUnitCustomer({
  firstName,
  lastName,
  email,
  phone,
  ssn,
  dateOfBirth,
  occupation,
  annualIncome,
  sourceOfIncome,
  address,
}: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  ssn: string;
  dateOfBirth: string;
  occupation: string;
  annualIncome: string;
  sourceOfIncome: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}) {
  return unitFetch<{ data: { id: string; type: string } }>("/applications", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "individualApplication",
        attributes: {
          ssn,
          fullName: { first: firstName, last: lastName },
          dateOfBirth,
          address: {
            street: address.street,
            city: address.city,
            state: address.state,
            postalCode: address.postalCode,
            country: address.country,
          },
          email,
          phone: { countryCode: "1", number: phone },
          occupation,
          annualIncome,
          sourceOfIncome,
          ip: "127.0.0.1",
          idempotencyKey: crypto.randomUUID(),
        },
      },
    }),
  });
}

// ------------------------------------------------------------
// Create Customer Token Verification
// Step 1 of the customer token flow
// ------------------------------------------------------------
export async function createCustomerTokenVerification(customerId: string) {
  return unitFetch<{ data: { attributes: { verificationToken: string } } }>(
    `/customers/${customerId}/token/verification`,
    {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "customerTokenVerification",
          attributes: { channel: "sms" },
        },
      }),
    }
  );
}

// ------------------------------------------------------------
// Create Customer Token
// Step 2 of the customer token flow
// In sandbox use verificationCode "000001"
// ------------------------------------------------------------
export async function createCustomerToken({
  customerId,
  verificationToken,
  verificationCode,
  scope = "accounts accounts-write transactions payments",
}: {
  customerId: string;
  verificationToken: string;
  verificationCode: string;
  scope?: string;
}) {
  return unitFetch<{
    data: { attributes: { token: string; expiresIn: number } };
  }>(`/customers/${customerId}/token`, {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "customerToken",
        attributes: {
          scope,
          verificationToken,
          verificationCode,
        },
      },
    }),
  });
}

// ------------------------------------------------------------
// Create Deposit Account using Customer Token
// ------------------------------------------------------------
export async function createDepositAccountForCustomer({
  customerId,
  customerToken,
  tags,
}: {
  customerId: string;
  customerToken: string;
  tags?: Record<string, string>;
}) {
  // Use customer token for this call
  const res = await fetch(`${UNIT_API_URL}/accounts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      data: {
        type: "depositAccount",
        attributes: {
          depositProduct: "checking",
          tags: tags ?? {},
        },
        relationships: {
          customer: {
            data: { type: "customer", id: customerId },
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => null);
    console.error(
      "[Unit] Create account error",
      JSON.stringify(error, null, 2)
    );
    const message =
      error?.errors?.[0]?.detail ?? error?.errors?.[0]?.title ?? res.statusText;
    throw new Error(`[Unit ${res.status}] ${message}`);
  }

  return res.json() as Promise<{
    data: {
      id: string;
      type: string;
      attributes: {
        accountNumber: string;
        routingNumber: string;
        balance: number;
        status: string;
      };
    };
  }>;
}

// ------------------------------------------------------------
// Deposit Accounts
// Creates a deposit account for a Unit customer.
// In LockBox, each Safe Deposit Box maps to one Unit account.
// ------------------------------------------------------------
export async function createUnitDepositAccount({
  customerId,
  tags,
}: {
  customerId: string;
  tags?: Record<string, string>;
}) {
  return unitFetch<{ data: { id: string; type: string } }>("/accounts", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "depositAccount",
        attributes: {
          depositProduct: "checking",
          tags: tags ?? {},
        },
        relationships: {
          customer: {
            data: { type: "customer", id: customerId },
          },
        },
      },
    }),
  });
}

// ------------------------------------------------------------
// Get Account
// ------------------------------------------------------------
export async function getUnitAccount(accountId: string) {
  return unitFetch<{
    data: { id: string; attributes: { balance: number; hold: number } };
  }>(`/accounts/${accountId}`);
}

// ------------------------------------------------------------
// List Accounts for a Customer
// ------------------------------------------------------------
export async function listUnitAccounts(customerId: string) {
  return unitFetch<{
    data: Array<{ id: string; attributes: { balance: number } }>;
  }>(`/accounts?filter[customerId]=${customerId}`);
}

// ------------------------------------------------------------
// ACH Payment — Pull funds into a LockBox account
// ------------------------------------------------------------
export async function createAchPayment({
  accountId,
  counterpartyId,
  amount,
  description,
}: {
  accountId: string;
  counterpartyId: string;
  amount: number; // cents
  description: string;
}) {
  return unitFetch("/payments", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "achPayment",
        attributes: {
          amount,
          direction: "Credit",
          description,
        },
        relationships: {
          account: { data: { type: "depositAccount", id: accountId } },
          counterparty: { data: { type: "counterparty", id: counterpartyId } },
        },
      },
    }),
  });
}

// ------------------------------------------------------------
// Get or create a customer token for server-side use
// Tokens last 24 hours — in production store in Redis/Upstash
// For now we generate fresh each time (sandbox only)
// ------------------------------------------------------------
export async function getServerCustomerToken(
  customerId: string
): Promise<string> {
  // Step 1 — get verification token
  const verifyResult = await createCustomerTokenVerification(customerId);
  const verificationToken = verifyResult.data.attributes.verificationToken;

  // Step 2 — exchange for customer token
  // In sandbox, verification code is always 000001
  const tokenResult = await createCustomerToken({
    customerId,
    verificationToken,
    verificationCode: process.env.NODE_ENV === "production" ? "" : "000001",
  });

  return tokenResult.data.attributes.token;
}
