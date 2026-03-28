"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus, UserMinus, FileText, CreditCard, Image, Trash2,
  Users, Activity, RefreshCw, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useActivityLog } from "@/hooks/use-data";
import { AppLayout } from "@/components/layout";

const ACTION_META: Record<string, { label: string; icon: any; color: string }> = {
  client_created:   { label: "New client added",    icon: UserPlus,   color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  client_deleted:   { label: "Client deleted",       icon: UserMinus,  color: "text-rose-600 bg-rose-50 border-rose-200" },
  client_updated:   { label: "Client updated",       icon: Users,      color: "text-blue-600 bg-blue-50 border-blue-200" },
  staff_created:    { label: "Staff member added",   icon: UserPlus,   color: "text-violet-600 bg-violet-50 border-violet-200" },
  staff_deleted:    { label: "Staff member removed", icon: UserMinus,  color: "text-orange-600 bg-orange-50 border-orange-200" },
  invoice_created:  { label: "Invoice generated",    icon: FileText,   color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  payment_recorded: { label: "Payment recorded",     icon: CreditCard, color: "text-green-600 bg-green-50 border-green-200" },
  photos_uploaded:  { label: "Photos uploaded",      icon: Image,      color: "text-sky-600 bg-sky-50 border-sky-200" },
  photo_deleted:    { label: "Photo deleted",         icon: Trash2,     color: "text-red-600 bg-red-50 border-red-200" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ActionIcon({ action }: { action: string }) {
  const meta = ACTION_META[action];
  if (!meta) return <div className="w-9 h-9 rounded-full border bg-slate-100 flex items-center justify-center"><Activity className="w-4 h-4 text-slate-400" /></div>;
  const Icon = meta.icon;
  return <div className={`w-9 h-9 rounded-full border flex items-center justify-center shrink-0 ${meta.color}`}><Icon className="w-4 h-4" /></div>;
}

function ActivityLogContent() {
  const router = useRouter();
  const { data: logs, isLoading, isError, error, refetch, isFetching } = useActivityLog();

  useEffect(() => {
    const role = typeof window !== "undefined" ? localStorage.getItem("role") : null;
    if (role !== "admin") router.push("/staff");
  }, [router]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Activity Log</h1>
          <p className="text-sm text-slate-500 mt-1">Recent actions taken in your studio</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" />Loading…</div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 text-rose-500 gap-3">
          <AlertCircle className="w-8 h-8 opacity-60" />
          <p className="text-sm">{error instanceof Error ? error.message : "Failed to load activity log."}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : !logs || logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <Activity className="w-10 h-10 opacity-30" />
          <p className="text-sm">No activity recorded yet. Actions like adding clients or recording payments will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
          {logs.map((log) => {
            const meta = ACTION_META[log.action];
            return (
              <div key={log.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50/70 transition-colors">
                <ActionIcon action={log.action} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">{meta?.label ?? log.action}</span>
                    {log.entityName && <span className="text-sm text-slate-600">— <span className="font-medium">{log.entityName}</span></span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-slate-500">by <span className="font-medium text-slate-700">{log.userName}</span></span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">{log.userRole}</Badge>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-medium text-slate-500">{timeAgo(log.createdAt)}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{fmtDate(log.createdAt)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ActivityLogPage() {
  return <AppLayout><ActivityLogContent /></AppLayout>;
}
