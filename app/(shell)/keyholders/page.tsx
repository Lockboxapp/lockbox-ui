// ============================================================
// app/(shell)/keyholders/page.tsx
// Keyholder management hub
// Authenticated — lives inside the app shell
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Shield, Plus, ChevronLeft, Mail, Check, Clock, X } from "lucide-react";

type KeyholderRelationship = {
  id: string;
  status: string;
  scopeType: string;
  inviteExpiresAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  profile: {
    email: string;
    name: string | null;
    verified: boolean;
  };
};

type PageState = "loading" | "ready" | "invite_form";

export default function KeyholdersPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [relationships, setRelationships] = useState<KeyholderRelationship[]>(
    [],
  );
  const [error, setError] = useState("");

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [scopeType, setScopeType] = useState<"ALL" | "SELECTED">("ALL");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Self-keyholder validation
  const userEmail = session?.user?.email?.toLowerCase() ?? "";
  const isSelfEmail = inviteEmail.trim().toLowerCase() === userEmail;

  useEffect(() => {
    fetchRelationships();
  }, []);

  async function fetchRelationships() {
    try {
      const res = await fetch("/api/keyholders");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setRelationships(data);
    } catch {
      setError("Failed to load keyholder information.");
    } finally {
      setPageState("ready");
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || inviteLoading || isSelfEmail) return;

    setInviteLoading(true);
    setInviteError("");

    try {
      const res = await fetch("/api/keyholders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          name: inviteName.trim() || null,
          scopeType,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setInviteError(data.error ?? "Something went wrong.");
        setInviteLoading(false);
        return;
      }

      setInviteSuccess(true);
      setInviteEmail("");
      setInviteName("");
      setScopeType("ALL");
      await fetchRelationships();

      // Return to ready state after short delay
      setTimeout(() => {
        setPageState("ready");
        setInviteSuccess(false);
      }, 2000);
    } catch {
      setInviteError("Something went wrong. Please try again.");
    } finally {
      setInviteLoading(false);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
            <Check className="h-3 w-3" /> Active
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
            <Clock className="h-3 w-3" /> Pending
          </span>
        );
      case "REVOKED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
            <X className="h-3 w-3" /> Revoked
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">
            {status}
          </span>
        );
    }
  }

  if (pageState === "loading") {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-sm text-gray-400">Loading…</div>
      </div>
    );
  }

  // ── Invite form ──
  if (pageState === "invite_form") {
    return (
      <div className="px-4 py-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => {
              setPageState("ready");
              setInviteError("");
              setInviteSuccess(false);
            }}
            className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          </button>
          <h2 className="text-xl font-semibold text-gray-900">
            Invite a keyholder
          </h2>
        </div>

        {inviteSuccess ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">✅</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Invite sent
            </h3>
            <p className="text-sm text-gray-500">
              An invite email has been sent. They'll need to accept before
              becoming active.
            </p>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="space-y-5">
            {/* What is a keyholder */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Shield className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-800 leading-relaxed">
                  A keyholder is a trusted person who can approve or deny your
                  early unlock requests. They cannot move or access your funds —
                  only approve or deny.
                </p>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Their email address
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="trusted@example.com"
                required
                autoFocus
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {/* Self-keyholder validation — frontend enforcement */}
              {isSelfEmail && inviteEmail.length > 0 && (
                <p className="text-xs text-rose-600 mt-1.5">
                  You can't use your own email as a keyholder.
                </p>
              )}
            </div>

            {/* Name (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Their name{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="e.g. Alex"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Scope */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Which boxes do they cover?
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setScopeType("ALL")}
                  className={`py-3 px-4 rounded-xl border text-sm font-medium transition-colors ${
                    scopeType === "ALL"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                      : "bg-white border-gray-200 text-gray-600"
                  }`}
                >
                  All boxes
                </button>
                <button
                  type="button"
                  onClick={() => setScopeType("SELECTED")}
                  className={`py-3 px-4 rounded-xl border text-sm font-medium transition-colors ${
                    scopeType === "SELECTED"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                      : "bg-white border-gray-200 text-gray-600"
                  }`}
                >
                  Selected boxes
                </button>
              </div>
              {scopeType === "SELECTED" && (
                <p className="text-xs text-gray-500 mt-2">
                  Box selection coming soon. For now, invite with all boxes and
                  adjust scope later.
                </p>
              )}
            </div>

            {inviteError && (
              <p className="text-sm text-rose-600">{inviteError}</p>
            )}

            <button
              type="submit"
              disabled={inviteLoading || isSelfEmail || !inviteEmail.trim()}
              className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm disabled:opacity-50"
            >
              {inviteLoading ? "Sending invite…" : "Send invite"}
            </button>
          </form>
        )}
      </div>
    );
  }

  // ── Main management view ──
  const activeRelationships = relationships.filter(
    (r) => r.status === "ACTIVE",
  );
  const pendingRelationships = relationships.filter(
    (r) => r.status === "PENDING",
  );
  const otherRelationships = relationships.filter(
    (r) => !["ACTIVE", "PENDING"].includes(r.status),
  );

  return (
    <div className="px-4 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Keyholders</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Trusted people who approve your early unlock requests
          </p>
        </div>
        <button
          onClick={() => setPageState("invite_form")}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Invite
        </button>
      </div>

      {error && <p className="text-sm text-rose-600 mb-4">{error}</p>}

      {/* Empty state */}
      {relationships.length === 0 && (
        <div className="text-center py-12">
          <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="text-base font-medium text-gray-900 mb-1">
            No keyholders yet
          </h3>
          <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
            Invite a trusted person to help keep you accountable. They'll
            approve or deny your early unlock requests.
          </p>
          <button
            onClick={() => setPageState("invite_form")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Invite your first keyholder
          </button>
        </div>
      )}

      {/* Active */}
      {activeRelationships.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            Active
          </div>
          <div className="space-y-3">
            {activeRelationships.map((r) => (
              <RelationshipCard
                key={r.id}
                relationship={r}
                getStatusBadge={getStatusBadge}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pending */}
      {pendingRelationships.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            Pending invite
          </div>
          <div className="space-y-3">
            {pendingRelationships.map((r) => (
              <RelationshipCard
                key={r.id}
                relationship={r}
                getStatusBadge={getStatusBadge}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other */}
      {otherRelationships.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            History
          </div>
          <div className="space-y-3">
            {otherRelationships.map((r) => (
              <RelationshipCard
                key={r.id}
                relationship={r}
                getStatusBadge={getStatusBadge}
              />
            ))}
          </div>
        </div>
      )}

      {/* What is a keyholder */}
      {relationships.length > 0 && (
        <div className="mt-6 bg-gray-50 rounded-xl p-4 border border-gray-100">
          <p className="text-xs text-gray-500 leading-relaxed">
            <strong className="text-gray-700">About keyholders:</strong> Your
            keyholder can only approve or deny your early unlock requests. They
            cannot view your balance, move funds, or make any changes to your
            account.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Relationship card ──
function RelationshipCard({
  relationship,
  getStatusBadge,
}: {
  relationship: KeyholderRelationship;
  getStatusBadge: (status: string) => React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
            <Mail className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">
              {relationship.profile.name ?? relationship.profile.email}
            </div>
            {relationship.profile.name && (
              <div className="text-xs text-gray-500">
                {relationship.profile.email}
              </div>
            )}
          </div>
        </div>
        {getStatusBadge(relationship.status)}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span className="text-xs text-gray-400">
          Covers:{" "}
          {relationship.scopeType === "ALL" ? "All boxes" : "Selected boxes"}
        </span>
        {relationship.status === "PENDING" && relationship.inviteExpiresAt && (
          <span className="text-xs text-amber-600">
            Expires{" "}
            {new Date(relationship.inviteExpiresAt).toLocaleDateString()}
          </span>
        )}
        {relationship.acceptedAt && (
          <span className="text-xs text-gray-400">
            Since {new Date(relationship.acceptedAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}
