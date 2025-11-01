"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Shield } from "lucide-react";

export default function GoalAchieved({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
            className="w-full max-w-sm rounded-3xl bg-white p-6 text-center"
          >
            <div className="mx-auto h-20 w-20 rounded-full grid place-items-center bg-emerald-100 mb-4">
              <Shield className="h-10 w-10 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold mb-1">Goal achieved!</div>
            <p className="text-gray-500 mb-6">Nice job! I knew you had it in you.</p>
            <button onClick={onClose} className="w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium">
              Continue
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
