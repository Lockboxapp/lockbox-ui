// lib/helpers.ts
export const currency = (n: number | null | undefined) =>
  typeof n === "number" && !isNaN(n)
    ? n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : "$0";

// optional: common vault update helper (if you use it elsewhere)
export async function vaultAction(
  id: string,
  data: Record<string, unknown>
) {
  const res = await fetch(`/api/vaults/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update vault");
  return res.json();
}
