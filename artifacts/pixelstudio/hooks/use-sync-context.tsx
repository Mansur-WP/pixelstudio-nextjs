// @refresh reset
/**
 * use-sync-context.tsx — Global sync state for PixelStudio
 *
 * Provides:
 *   isOnline             — live network status (from useOnlineStatus)
 *   pendingCount         — number of operations waiting to be synced
 *   syncStatus           — "idle" | "syncing" | "done" | "error"
 *   lastError            — error message from the last failed sync attempt
 *   triggerSync()        — manually kick off a sync pass
 *   refreshPendingCount() — re-read the pending count from IndexedDB
 *
 * Auto-sync behaviour:
 *   When the browser fires the "online" event (i.e. connectivity restored),
 *   we wait 800 ms to let the network stabilise, then trigger sync automatically.
 *
 * The "// @refresh reset" directive above tells Vite to do a full page reset
 * when this file changes during development.  This file mixes a React component
 * (SyncProvider) with a hook (useSyncContext), which prevents Fast Refresh from
 * doing a component-level hot swap — a full reset is the correct fallback.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useOnlineStatus } from "@/hooks/use-online-status";
import {
  getPendingEntries,
  patchSyncEntry,
  clearDoneEntries,
  countByStatus,
} from "@/lib/offline-db";
import { createClient } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncStatus = "idle" | "syncing" | "done" | "error";

interface SyncContextValue {
  isOnline:            boolean;
  pendingCount:        number;
  syncStatus:          SyncStatus;
  lastError:           string | null;
  triggerSync:         () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const SyncContext = createContext<SyncContextValue>({
  isOnline:            true,
  pendingCount:        0,
  syncStatus:          "idle",
  lastError:           null,
  triggerSync:         async () => {},
  refreshPendingCount: async () => {},
});

export function useSyncContext(): SyncContextValue {
  return useContext(SyncContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();

  // Delegate online/offline detection to the dedicated hook — avoids
  // duplicating event-listener logic that already lives in use-online-status.ts
  const isOnline = useOnlineStatus();

  const [pendingCount, setPendingCount] = useState(0);
  const [syncStatus,   setSyncStatus]   = useState<SyncStatus>("idle");
  const [lastError,    setLastError]    = useState<string | null>(null);

  const syncLock   = useRef(false); // prevent concurrent sync runs
  const doneTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevOnline = useRef(isOnline); // tracks the previous online state

  // ── Pending count helper ─────────────────────────────────────────────────
  const refreshPendingCount = useCallback(async () => {
    const n = await countByStatus("pending");
    setPendingCount(n);
  }, []);

  // ── Core sync logic ──────────────────────────────────────────────────────
  const triggerSync = useCallback(async () => {
    if (syncLock.current || !navigator.onLine) return;

    // Read pending items first — only start "syncing" state if there is
    // actually something to send. Avoids a brief spinner flash when called
    // with an empty queue.
    const pending = await getPendingEntries();
    if (pending.length === 0) return;

    syncLock.current = true;
    setSyncStatus("syncing");
    setLastError(null);

    try {
      let anySucceeded = false;
      let anyFailed    = false;

      for (const entry of pending) {
        await patchSyncEntry(entry.id, { status: "syncing" });

        try {
          if (entry.type === "createClient") {
            const p = entry.payload as {
              clientName:    string;
              phone:         string;
              price:         number;
              photoFormat:   "SOFTCOPY" | "HARDCOPY" | "BOTH";
              orderStatus?:  "PENDING" | "EDITING" | "READY" | "DELIVERED";
              paymentStatus?: "PENDING" | "PAID";
              notes:         string;
            };
            await createClient({
              clientName:    p.clientName,
              phone:         p.phone,
              price:         p.price,
              photoFormat:   p.photoFormat,
              orderStatus:   p.orderStatus,
              paymentStatus: p.paymentStatus,
              notes:         p.notes,
            });
          }

          await patchSyncEntry(entry.id, {
            status:   "done",
            syncedAt: Date.now(),
          });
          anySucceeded = true;
        } catch (err: unknown) {
          anyFailed = true;
          const msg = err instanceof Error ? err.message : "Unknown error";
          // Reset to "pending" (with error note) so the entry retries next time
          await patchSyncEntry(entry.id, { status: "pending", error: msg });
        }
      }

      // Only clean up and refresh the client list if at least one entry succeeded
      if (anySucceeded) {
        await clearDoneEntries();
        await qc.invalidateQueries({ queryKey: ["clients"] });
      }

      await refreshPendingCount();

      if (anyFailed) {
        setSyncStatus("error");
        setLastError("Some records couldn't sync. Will retry when online.");
      } else {
        setSyncStatus("done");
        // Auto-reset "done" → "idle" after 3 s
        if (doneTimer.current) clearTimeout(doneTimer.current);
        doneTimer.current = setTimeout(() => setSyncStatus("idle"), 3000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      setSyncStatus("error");
      setLastError(msg);
    } finally {
      // Always release the lock — whether sync succeeded, partially failed,
      // or threw an unexpected error.
      syncLock.current = false;
    }
  }, [qc, refreshPendingCount]);

  // ── React to online/offline transitions ──────────────────────────────────
  useEffect(() => {
    const wasOnline = prevOnline.current;
    prevOnline.current = isOnline;

    // Declare the reconnect timer here so the cleanup below can always cancel it,
    // regardless of which branch was taken.  This keeps all code paths consistent
    // and satisfies TypeScript's "not all paths return a value" check.
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    if (isOnline && !wasOnline) {
      // Just came back online — wait 800 ms for the network to stabilise
      reconnectTimer = setTimeout(() => triggerSync(), 800);
    }

    if (!isOnline) {
      // Just went offline — clear any transient sync status from the header
      setSyncStatus("idle");
    }

    return () => {
      if (reconnectTimer !== undefined) clearTimeout(reconnectTimer);
    };
  }, [isOnline, triggerSync]);

  // ── Seed pending count on mount ───────────────────────────────────────────
  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (doneTimer.current) clearTimeout(doneTimer.current);
    };
  }, []);

  return (
    <SyncContext.Provider value={{
      isOnline,
      pendingCount,
      syncStatus,
      lastError,
      triggerSync,
      refreshPendingCount,
    }}>
      {children}
    </SyncContext.Provider>
  );
}
