// app/AppContent.tsx
"use client";
import React, { useMemo, useState } from "react";
// ...your existing imports (framer-motion, lucide-react, etc.)

export default function AppContent() {
  // ALL your hooks start here and never inside conditionals
  const [tab, setTab] = useState<"home"|"vaults"|"banker"|"rewards">("home");
  const [showGoal, setShowGoal] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // keep this line uncommented or delete it everywhere consistently — but don’t toggle at runtime
  // const [bankConnected, setBankConnected] = useState(false);
  const [bankName, setBankName] = useState<string>("");

  // ...rest of your state/hooks and full UI exactly as you had it
}
