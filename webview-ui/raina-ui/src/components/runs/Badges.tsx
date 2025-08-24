/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";

export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "completed"
      ? "bg-emerald-600/20 text-emerald-300"
      : status === "failed"
      ? "bg-red-600/20 text-red-300"
      : status === "running"
      ? "bg-sky-600/20 text-sky-300"
      : "bg-neutral-700/50 text-neutral-300";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] ${cls}`}>{status}</span>;
}

export function DeltaPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "sky" | "neutral" | "amber" | "red";
}) {
  const hidden = value === 0;
  const color =
    tone === "emerald"
      ? "bg-emerald-600/20 text-emerald-300 border-emerald-700/40"
      : tone === "sky"
      ? "bg-sky-600/20 text-sky-300 border-sky-700/40"
      : tone === "amber"
      ? "bg-amber-600/20 text-amber-300 border-amber-700/40"
      : tone === "red"
      ? "bg-red-600/20 text-red-300 border-red-700/40"
      : "bg-neutral-700/40 text-neutral-300 border-neutral-600/40";

  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
        hidden ? "opacity-40" : "",
        color,
      ].join(" ")}
      title={String(value)}
    >
      <span className="capitalize">{label}</span>
      <span className="font-mono">{value}</span>
    </span>
  );
}
