import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export type StatColorScheme = "violet" | "emerald" | "amber" | "rose" | "blue" | "default";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    label: string;
  };
  colorScheme?: StatColorScheme;
  className?: string;
}

export function StatCard({ title, value, icon: Icon, description, trend, colorScheme = "default", className }: StatCardProps) {
  
  const getIconStyles = (scheme: StatColorScheme) => {
    switch (scheme) {
      case "violet": return "bg-gradient-to-br from-violet-500 to-violet-400 text-white shadow-violet-500/20";
      case "emerald": return "bg-gradient-to-br from-emerald-500 to-emerald-400 text-white shadow-emerald-500/20";
      case "amber": return "bg-gradient-to-br from-amber-500 to-amber-400 text-white shadow-amber-500/20";
      case "rose": return "bg-gradient-to-br from-rose-500 to-rose-400 text-white shadow-rose-500/20";
      case "blue": return "bg-gradient-to-br from-blue-500 to-blue-400 text-white shadow-blue-500/20";
      default: return "bg-gradient-to-br from-slate-800 to-slate-700 text-white shadow-slate-800/20";
    }
  };

  return (
    <Card className={cn("overflow-hidden border-border/40 bg-white shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="text-3xl font-display font-bold tracking-tight text-foreground">{value}</h3>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {description && (
              <p className="text-xs text-muted-foreground pt-1">{description}</p>
            )}
          </div>
          <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-105", getIconStyles(colorScheme))}>
            <Icon className="h-5 w-5 opacity-90" />
          </div>
        </div>
        
        {trend && (
          <>
            <div className="h-px w-full bg-border/40 my-4" />
            <div className="flex items-center gap-2 text-sm">
              <span className={cn("font-semibold flex items-center gap-0.5", 
                trend.value >= 0 ? "text-emerald-600" : "text-rose-600"
              )}>
                {trend.value > 0 ? "↑ +" : "↓ "}{trend.value}%
              </span>
              <span className="text-muted-foreground text-xs">{trend.label}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
