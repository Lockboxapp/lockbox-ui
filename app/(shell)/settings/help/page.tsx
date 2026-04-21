// ============================================================
// app/(shell)/settings/help/page.tsx
// Help & Feedback — feedback form, bug report, how it works, support link.
// ============================================================

import HelpForms from "./HelpForms";

export const dynamic = "force-dynamic";

export default function HelpPage() {
  return (
    <div className="px-4 pt-4 pb-24 space-y-5 max-w-md mx-auto">
      <div className="pt-1">
        <h2 className="text-xl font-semibold text-gray-900">Help &amp; Feedback</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          We read every message. Beta feedback is gold right now.
        </p>
      </div>
      <HelpForms />
    </div>
  );
}
