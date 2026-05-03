import React from 'react';
import { cn } from "@/lib/utils";

const prioriteitConfig = {
  laag: { color: "bg-slate-300", label: "Laag" },
  normaal: { color: "bg-blue-400", label: "Normaal" },
  hoog: { color: "bg-orange-400", label: "Hoog" },
  spoed: { color: "bg-red-500", label: "Spoed" },
};

export default function PrioriteitIndicator({ prioriteit, showLabel = false }) {
  const config = prioriteitConfig[prioriteit] || prioriteitConfig.normaal;
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn("w-2 h-2 rounded-full", config.color)} />
      {showLabel && <span className="text-xs text-slate-500">{config.label}</span>}
    </div>
  );
}