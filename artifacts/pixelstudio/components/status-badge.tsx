import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colorMap: Record<string, string> = {
    Paid:      "bg-emerald-100 text-emerald-800 border-emerald-200",
    Active:    "bg-emerald-100 text-emerald-800 border-emerald-200",
    Softcopy:  "bg-blue-100 text-blue-800 border-blue-200",
    Delivered: "bg-emerald-100 text-emerald-800 border-emerald-200",
    Pending:   "bg-amber-100 text-amber-800 border-amber-200",
    Inactive:  "bg-slate-100 text-slate-600 border-slate-200",
    Hardcopy:  "bg-purple-100 text-purple-800 border-purple-200",
    Both:      "bg-cyan-100 text-cyan-800 border-cyan-200",
    Editing:   "bg-blue-100 text-blue-800 border-blue-200",
    Ready:     "bg-violet-100 text-violet-800 border-violet-200",
  };
  const color = colorMap[status] ?? "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <Badge variant="outline" className={cn("rounded-full px-3 py-0.5 font-medium text-xs border whitespace-nowrap", color, className)}>
      {status}
    </Badge>
  );
}
