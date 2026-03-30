"use client";
import { Button } from "@/components/ui/button";
// import your data hook(s)…

// TEMP STUBS (remove when real implementations are wired)
const useVaults = () => ({
  data: [] as Array<{ id: string; name: string; balance: number }>,
  isLoading: false,
});

const SkeletonList = () => <div />;

const EmptyState = ({
  title = "No vaults yet",
  description = "Create your first vault to get started.",
  ctaLabel,
  onCtaClick,
}: {
  title?: string;
  description?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
}) => (
  <div>
    <h2>{title}</h2>
    <p>{description}</p>
    {ctaLabel && onCtaClick ? (
      <button onClick={onCtaClick}>{ctaLabel}</button>
    ) : null}
  </div>
);

const ScreenHeader = ({
  title,
  actions,
}: {
  title: string;
  actions?: React.ReactNode;
}) => (
  <div>
    <h1>{title}</h1>
    {actions ?? null}
  </div>
);

const VaultList = ({
  vaults,
}: {
  vaults: Array<{ id: string; name: string; balance: number }>;
}) => (
  <ul>
    {vaults.map((v) => (
      <li key={v.id}>
        {v.name} — {(v.balance / 100).toFixed(2)}
      </li>
    ))}
  </ul>
);

export default function VaultsScreen() {
  // 1) Data
  const { data: vaults, isLoading } = useVaults(); // your existing query
  const hasVaults = !isLoading && (vaults?.length ?? 0) > 0;

  // 2) Actions
  const onCreateVault = () => {
    /* open create modal */
  };

  // 3) Header (actions live here — standard spot)
  // Wherever you render your header, keep the button *here*:
  // <ScreenHeader title="Vaults" actions={hasVaults ? (<Button onClick={onCreateVault}>+ Create new</Button>) : null} />

  // 4) Body
  if (isLoading) return <SkeletonList />;
  if (!hasVaults) {
    return (
      <EmptyState
        title="No vaults yet"
        ctaLabel="Create your first vault"
        onCtaClick={onCreateVault}
      />
    );
  }
  return (
    <>
      <ScreenHeader
        title="Vaults"
        actions={
          hasVaults ? (
            <Button onClick={onCreateVault}>+ Create new</Button>
          ) : null
        }
      />
      <VaultList vaults={vaults} />
    </>
  );
}
