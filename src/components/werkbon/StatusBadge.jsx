import React from 'react';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig = {
  open: { label: "Open", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  geclaimd: { label: "Geclaimd", className: "bg-blue-50 text-blue-700 border-blue-200" },
  ingepland: { label: "Ingepland", className: "bg-violet-50 text-violet-700 border-violet-200" },
  onderweg: { label: "Onderweg", className: "bg-amber-50 text-amber-700 border-amber-200" },
  in_uitvoering: { label: "In uitvoering", className: "bg-orange-50 text-orange-700 border-orange-200" },
  afgerond: { label: "Afgerond", className: "bg-slate-100 text-slate-600 border-slate-200" },
};

export default function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.open;
  return (
    <Badge variant="outline" className={cn("text-xs font-medium border", config.className)}>
      {config.label}
    </Badge>
  );
}