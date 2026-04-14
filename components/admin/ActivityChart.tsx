"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export type ChartDataPoint = {
  date: string;
  users: number;
  waitlist: number;
  boxes: number;
};

export type ChartRanges = {
  "7": ChartDataPoint[];
  "30": ChartDataPoint[];
  "90": ChartDataPoint[];
};

type Range = keyof ChartRanges;

const RANGE_LABELS: Record<Range, string> = {
  "7": "Last 7 days",
  "30": "Last 30 days",
  "90": "Last 90 days",
};

export default function ActivityChart({ ranges }: { ranges: ChartRanges }) {
  const [range, setRange] = useState<Range>("30");
  const data = ranges[range];

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="font-semibold text-gray-900">Activity Over Time</div>
          <div className="text-xs text-gray-400 mt-0.5">
            Daily user signups, waitlist entries, and boxes created
          </div>
        </div>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as Range)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
        >
          {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
            <option key={r} value={r}>
              {RANGE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            interval={range === "7" ? 0 : range === "30" ? 4 : 9}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              fontSize: "12px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }}
          />
          <Line
            type="monotone"
            dataKey="users"
            name="User Signups"
            stroke="#059669"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="waitlist"
            name="Waitlist Entries"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="boxes"
            name="Boxes Created"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
