import React from "react";

export default function Card({ children, className = "" }: any) {
  return (
    <div className={`rounded-2xl shadow-sm border border-gray-100 p-4 ${className}`}>
      {children}
    </div>
  );
}
