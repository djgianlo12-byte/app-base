import React from 'react';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const typeConfig = {
  "Keuring": "bg-sky-50 text-sky-700",
  "Oplevering": "bg-green-50 text-green-700",
  "Montagewerk": "bg-purple-50 text-purple-700",
  "Magazijn keuring": "bg-teal-50 text-teal-700",
  "Jaarlijkse keuring": "bg-rose-50 text-rose-700",
  "Inmeten": "bg-indigo-50 text-indigo-700",
};

export default function TypeBadge({ type }) {
  return (
    <Badge className={cn("text-xs font-medium", typeConfig[type] || "bg-gray-50 text-gray-700")}>
      {type}
    </Badge>
  );
}