"use client";
import React from "react";

export default function Button({ children, ...props }: any) {
  return (
    <button
      className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition"
      {...props}
    >
      {children}
    </button>
  );
}
