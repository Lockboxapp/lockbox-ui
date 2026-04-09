// ============================================================
// app/(onboarding)/layout.tsx
// Onboarding shell — logo + step progress only, no bottom nav
// ============================================================

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col max-w-md mx-auto">
      {/* Logo header */}
      <header className="px-6 pt-8 pb-4 flex items-center gap-2">
        <div className="h-8 w-8 bg-emerald-600 rounded-lg flex items-center justify-center">
          <svg
            className="h-4 w-4 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" strokeWidth="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" strokeWidth="2" />
          </svg>
        </div>
        <span className="text-lg font-bold text-gray-900">LockBox</span>
      </header>

      {/* Page content */}
      <main className="flex-1 px-6 py-4">{children}</main>
    </div>
  );
}
