// components/ui/button.tsx
"use client";
import * as React from "react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

export function Button({ children, className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
