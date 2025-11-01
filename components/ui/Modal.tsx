"use client";
import { AnimatePresence, motion } from "framer-motion";

export default function Modal({ open, onClose, children }: any) {
  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/40 grid place-items-center z-50"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl p-6 max-w-sm w-full"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
        >
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
