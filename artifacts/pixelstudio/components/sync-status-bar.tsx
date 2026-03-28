/**
 * sync-status-bar.tsx — Inline sync indicator for the app header
 *
 * Shows one of four states, compactly:
 *   • Offline    — amber pill "Offline"
 *   • Syncing    — spinner + "Syncing…"
 *   • Pending    — amber count badge + "Sync Now" button
 *   • Done       — green "✓ Synced" (auto-fades after 3 s via context)
 *   • Error      — red pill with tooltip showing the error
 *   • Idle+online+0 pending — renders nothing
 */

import { Loader2, WifiOff, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSyncContext } from "@/hooks/use-sync-context";

export function SyncStatusBar() {
  const { isOnline, pendingCount, syncStatus, lastError, triggerSync } = useSyncContext();

  // ── Offline ────────────────────────────────────────────────────────────────
  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-3 py-1 text-xs font-semibold">
        <WifiOff className="w-3.5 h-3.5" />
        Offline
      </div>
    );
  }

  // ── Syncing ────────────────────────────────────────────────────────────────
  if (syncStatus === "syncing") {
    return (
      <div className="flex items-center gap-1.5 text-primary text-xs font-semibold">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Syncing…
      </div>
    );
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  if (syncStatus === "done") {
    return (
      <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold animate-in fade-in duration-300">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Synced
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (syncStatus === "error") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={triggerSync}
            className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 rounded-full px-3 py-1 h-auto text-xs font-semibold"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Sync failed · Retry
          </Button>
        </TooltipTrigger>
        {lastError && (
          <TooltipContent side="bottom" className="max-w-xs">
            {lastError}
          </TooltipContent>
        )}
      </Tooltip>
    );
  }

  // ── Pending (idle + online + records waiting) ──────────────────────────────
  if (pendingCount > 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={triggerSync}
            className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 rounded-full px-3 py-1 h-auto text-xs font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {pendingCount} pending · Sync Now
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {pendingCount} offline record{pendingCount !== 1 ? "s" : ""} waiting to upload
        </TooltipContent>
      </Tooltip>
    );
  }

  // ── Idle + online + nothing pending ────────────────────────────────────────
  return null;
}
