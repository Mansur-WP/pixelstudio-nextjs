"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Globe, LogOut, Building2, Users, UserCheck,
  StarOff, ShieldCheck, ShieldOff, Search, RefreshCw,
  Plus, Eye, EyeOff, Link, Trash2, Image, FileText,
  LayoutDashboard, CheckCircle, AlertCircle, Crown, Layers,
  ChevronRight, X, Pencil, Activity, UserPlus, UserMinus, CreditCard,
  LogIn, Bell, TrendingUp, BarChart3, Wifi, Database, Server, Clock,
  Download, Filter, Calendar, AlertTriangle, Zap, MemoryStick,
  Banknote, Check, Copy, Save,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  getPlatformToken, clearPlatformToken,
  getPlatformStudios, getPlatformStats,
  createPlatformStudio, updatePlatformStudio, deletePlatformStudio,
  impersonateStudio, startImpersonation, getPlatformActivity,
  getPlatformAnalytics, getPlatformHealth, getPlatformNotifications, exportStudiosCSV,
  getPlatformSettings, updatePlatformSettings, getPlatformUpgradeRequests,
  confirmUpgradeRequest, rejectUpgradeRequest,
  getImageUrl,
  type PlatformStudio, type PlatformStats, type ActivityLogEntry,
  type PlatformAnalytics, type SystemHealth, type PlatformNotification,
  type PlatformSettingsData, type PlatformUpgradeRequest,
} from "@/lib/api";

type StudioFilter = "all" | "active" | "suspended" | "free" | "pro";
const FREE_LIMITS = { staff: 3, clients: 50, photos: 200 };

function fmt(n: number) { if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`; if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`; return String(n); }
function fmtMoney(n: number) { return `₦${new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(n)}`; }

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: string | number; icon: any; color: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}><Icon className="w-5 h-5" /></div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-slate-900 leading-tight">{value}</div>
        <div className="text-sm text-slate-500">{label}</div>
        {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function CreateStudioDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (s: PlatformStudio) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(""); const [slug, setSlug] = useState(""); const [adminName, setAdminName] = useState("");
  const [adminEmail, setEmail] = useState(""); const [adminPw, setAdminPw] = useState(""); const [plan, setPlan] = useState<"free" | "pro">("free");
  const [showPw, setShowPw] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const autoSlug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
  const reset = () => { setName(""); setSlug(""); setAdminName(""); setEmail(""); setAdminPw(""); setPlan("free"); setError(""); setLoading(false); };
  const handleClose = () => { reset(); onClose(); };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const studio = await createPlatformStudio({ name, slug, adminName, adminEmail, adminPassword: adminPw, plan });
      toast({ title: "Studio created!", description: `"${studio.name}" is ready at /s/${studio.slug}` });
      handleClose(); onCreated(studio);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to create studio"); }
    finally { setLoading(false); }
  };
  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Building2 className="w-5 h-5 text-primary" />Create New Studio</DialogTitle><DialogDescription>Set up a studio with a dedicated admin account.</DialogDescription></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-3 p-4 bg-slate-50 rounded-xl">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Studio Info</p>
            <div className="space-y-1.5"><Label className="text-sm font-medium">Studio Name</Label><Input placeholder="e.g. GBSM Photography" value={name} onChange={e => { setName(e.target.value); setSlug(autoSlug(e.target.value)); setError(""); }} className="h-10" required /></div>
            <div className="space-y-1.5"><Label className="text-sm font-medium">Slug</Label><div className="flex items-center gap-2"><span className="text-sm text-slate-400 shrink-0">/s/</span><Input placeholder="e.g. gbsm" value={slug} onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setError(""); }} className="h-10 font-mono text-sm" required /></div></div>
            <div className="space-y-1.5"><Label className="text-sm font-medium">Plan</Label><div className="flex gap-2">{(["free", "pro"] as const).map(p => (<button key={p} type="button" onClick={() => setPlan(p)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium transition-all ${plan === p ? (p === "pro" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-primary bg-primary/10 text-primary") : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>{p === "pro" ? <><Crown className="w-3.5 h-3.5" />Pro</> : <><Layers className="w-3.5 h-3.5" />Free</>}</button>))}</div></div>
          </div>
          <div className="space-y-3 p-4 bg-slate-50 rounded-xl">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Admin Account</p>
            <div className="space-y-1.5"><Label className="text-sm font-medium">Full Name</Label><Input placeholder="e.g. John Smith" value={adminName} onChange={e => { setAdminName(e.target.value); setError(""); }} className="h-10" required /></div>
            <div className="space-y-1.5"><Label className="text-sm font-medium">Email</Label><Input type="text" placeholder="e.g. admin@studio" value={adminEmail} onChange={e => { setEmail(e.target.value); setError(""); }} className="h-10" required /></div>
            <div className="space-y-1.5"><Label className="text-sm font-medium">Password</Label><div className="relative"><Input type={showPw ? "text" : "password"} placeholder="Min 6 characters" value={adminPw} onChange={e => { setAdminPw(e.target.value); setError(""); }} className="h-10 pr-10" required /><button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></div>
          </div>
          {error && <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={handleClose} disabled={loading}>Cancel</Button>
            <Button type="submit" className="flex-1 gap-2" disabled={loading}>{loading ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creating…</span> : <><Plus className="w-4 h-4" />Create Studio</>}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditStudioDialog({ studio, onClose, onUpdated }: { studio: PlatformStudio | null; onClose: () => void; onUpdated: (s: PlatformStudio) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(""); const [slug, setSlug] = useState("");
  const [subStatus, setSubStatus] = useState<"active" | "trial" | "expired">("active");
  const [trialEndsAt, setTrialEndsAt] = useState(""); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  useEffect(() => { if (studio) { setName(studio.name); setSlug(studio.slug); setSubStatus(studio.subscriptionStatus); setTrialEndsAt(studio.trialEndsAt ? studio.trialEndsAt.slice(0, 10) : ""); setError(""); } }, [studio]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!studio) return; setError(""); setLoading(true);
    try {
      const updated = await updatePlatformStudio(studio.id, { name, slug, subscriptionStatus: subStatus, trialEndsAt: subStatus === "trial" && trialEndsAt ? trialEndsAt : null });
      toast({ title: "Studio updated", description: `Changes saved to "${updated.name}"` }); onUpdated(updated); onClose();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Update failed"); }
    finally { setLoading(false); }
  };
  return (
    <Dialog open={!!studio} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4 text-primary" />Edit Studio</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-3 p-4 bg-slate-50 rounded-xl">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Studio Info</p>
            <div className="space-y-1.5"><Label className="text-sm font-medium">Studio Name</Label><Input value={name} onChange={e => { setName(e.target.value); setError(""); }} className="h-10" required /></div>
            <div className="space-y-1.5"><Label className="text-sm font-medium">Slug</Label><div className="flex items-center gap-2"><span className="text-sm text-slate-400 shrink-0">/s/</span><Input value={slug} onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setError(""); }} className="h-10 font-mono text-sm" required /></div></div>
          </div>
          <div className="space-y-3 p-4 bg-slate-50 rounded-xl">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Subscription</p>
            <div className="space-y-1.5"><Label className="text-sm font-medium">Status</Label><div className="flex gap-2">{(["active", "trial", "expired"] as const).map(s => (<button key={s} type="button" onClick={() => setSubStatus(s)} className={`flex-1 py-2 rounded-lg border text-xs font-medium capitalize transition-all ${subStatus === s ? (s === "active" ? "border-emerald-400 bg-emerald-50 text-emerald-700" : s === "trial" ? "border-blue-400 bg-blue-50 text-blue-700" : "border-rose-400 bg-rose-50 text-rose-700") : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>{s}</button>))}</div></div>
            {subStatus === "trial" && <div className="space-y-1.5"><Label className="text-sm font-medium">Trial Ends At</Label><Input type="date" value={trialEndsAt} onChange={e => setTrialEndsAt(e.target.value)} className="h-10" /></div>}
          </div>
          {error && <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading}>{loading ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</span> : "Save Changes"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const ACT_META: Record<string, { label: string; icon: any; color: string }> = {
  client_created: { label: "New client", icon: UserPlus, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  client_deleted: { label: "Client deleted", icon: UserMinus, color: "text-rose-600 bg-rose-50 border-rose-200" },
  staff_created: { label: "Staff added", icon: UserPlus, color: "text-violet-600 bg-violet-50 border-violet-200" },
  staff_deleted: { label: "Staff removed", icon: UserMinus, color: "text-orange-600 bg-orange-50 border-orange-200" },
  invoice_created: { label: "Invoice created", icon: FileText, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  payment_recorded: { label: "Payment recorded", icon: CreditCard, color: "text-green-600 bg-green-50 border-green-200" },
  photos_uploaded: { label: "Photos uploaded", icon: Image, color: "text-sky-600 bg-sky-50 border-sky-200" },
  photo_deleted: { label: "Photo deleted", icon: Trash2, color: "text-red-600 bg-red-50 border-red-200" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`; return `${Math.floor(h / 24)}d ago`;
}

function StudioCard({ studio, updating, onToggleActive, onTogglePlan, onEdit, onDelete, onCopyLink, onEnter }: {
  studio: PlatformStudio; updating: string | null;
  onToggleActive: (s: PlatformStudio) => void; onTogglePlan: (s: PlatformStudio) => void;
  onEdit: (s: PlatformStudio) => void; onDelete: (s: PlatformStudio) => void;
  onCopyLink: (s: PlatformStudio) => void; onEnter: (s: PlatformStudio) => void;
}) {
  const busy = updating === studio.id;
  const isPro = studio.plan === "pro";
  const staffPct  = isPro ? null : Math.min(100, (studio._stats.staffCount  / FREE_LIMITS.staff)   * 100);
  const clientPct = isPro ? null : Math.min(100, (studio._stats.clientCount / FREE_LIMITS.clients)  * 100);
  const photoPct  = isPro ? null : Math.min(100, (studio._stats.photoCount  / FREE_LIMITS.photos)   * 100);
  return (
    <div className={`bg-white rounded-2xl border shadow-sm flex flex-col transition-all hover:shadow-md ${studio.isActive ? "border-slate-200" : "border-red-200 bg-red-50/20"}`}>
      <div className="p-5 flex items-start gap-3 border-b border-slate-100">
        <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
          {studio.logoUrl ? <img src={getImageUrl(studio.logoUrl)} alt={studio.name} className="w-full h-full object-cover" /> : <Building2 className="w-6 h-6 text-slate-300" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900 truncate text-sm leading-tight">{studio.name}</h3>
            <Badge variant={isPro ? "default" : "secondary"} className={`text-xs shrink-0 ${isPro ? "bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200" : ""}`}>{isPro ? <><Crown className="w-3 h-3 mr-1" />Pro</> : "Free"}</Badge>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">/s/{studio.slug}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${studio.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{studio.isActive ? <><CheckCircle className="w-2.5 h-2.5" />Active</> : <><X className="w-2.5 h-2.5" />Suspended</>}</span>
            {studio.subscriptionStatus === "trial" && <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700"><Clock className="w-2.5 h-2.5" />Trial</span>}
            {studio.subscriptionStatus === "expired" && <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-rose-100 text-rose-700"><AlertTriangle className="w-2.5 h-2.5" />Expired</span>}
          </div>
        </div>
        <button onClick={() => onEdit(studio)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"><Pencil className="w-3.5 h-3.5" /></button>
      </div>
      <div className="p-5 space-y-3 flex-1">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500"><Users className="w-3.5 h-3.5 text-indigo-400" />{studio._stats.staffCount} staff</div>
          <div className="flex items-center gap-1.5 text-slate-500"><UserCheck className="w-3.5 h-3.5 text-emerald-400" />{studio._stats.clientCount} clients</div>
          <div className="flex items-center gap-1.5 text-slate-500"><Image className="w-3.5 h-3.5 text-sky-400" />{fmt(studio._stats.photoCount)} photos</div>
          <div className="flex items-center gap-1.5 text-slate-500"><Banknote className="w-3.5 h-3.5 text-green-400" />{fmtMoney(studio._stats.revenue)}</div>
          <div className="flex items-center gap-1.5 text-slate-500 col-span-2"><FileText className="w-3.5 h-3.5 text-violet-400" />{studio._stats.invoiceCount} invoices · joined {new Date(studio.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</div>
        </div>
        {!isPro && (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-medium text-slate-400">Free plan limits</p>
            {[{ label: `Staff ${studio._stats.staffCount}/${FREE_LIMITS.staff}`, pct: staffPct! }, { label: `Clients ${studio._stats.clientCount}/${FREE_LIMITS.clients}`, pct: clientPct! }, { label: `Photos ${fmt(studio._stats.photoCount)}/${FREE_LIMITS.photos}`, pct: photoPct! }].map(({ label, pct }) => (
              <div key={label} className="space-y-0.5">
                <div className="flex justify-between text-xs text-slate-500"><span>{label}</span><span className={pct >= 90 ? "text-rose-500 font-medium" : ""}>{Math.round(pct)}%</span></div>
                <Progress value={pct} className={`h-1.5 ${pct >= 90 ? "[&>div]:bg-rose-500" : pct >= 70 ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500"}`} />
              </div>
            ))}
          </div>
        )}
        {studio.subscriptionStatus === "trial" && studio.trialEndsAt && (
          <div className={`flex items-center gap-2 text-xs rounded-lg px-2.5 py-2 ${new Date(studio.trialEndsAt) < new Date() ? "bg-rose-50 border border-rose-200 text-rose-700" : "bg-blue-50 border border-blue-200 text-blue-700"}`}>
            <Calendar className="w-3.5 h-3.5 shrink-0" />Trial {new Date(studio.trialEndsAt) < new Date() ? "expired" : "ends"} {new Date(studio.trialEndsAt).toLocaleDateString()}
          </div>
        )}
        {!isPro && (staffPct! >= 100 || clientPct! >= 100 || photoPct! >= 100) && (
          <div className="flex items-center gap-2 text-xs rounded-lg px-2.5 py-2 bg-amber-50 border border-amber-200 text-amber-700"><Zap className="w-3.5 h-3.5 shrink-0" />Limit reached — upgrade to Pro to unlock unlimited usage</div>
        )}
        {studio._admin && <div className="bg-slate-50 rounded-lg p-2.5 text-xs"><span className="text-slate-400">Admin: </span><span className="font-medium text-slate-700">{studio._admin.name}</span><span className="text-slate-400"> · {studio._admin.email}</span></div>}
      </div>
      <div className="p-4 border-t border-slate-100 space-y-2">
        <Button size="sm" onClick={() => onEnter(studio)} disabled={busy || !studio.isActive} className="w-full gap-1.5 text-xs h-8 bg-primary/90 hover:bg-primary"><LogIn className="w-3 h-3" />Enter Studio</Button>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onToggleActive(studio)} disabled={busy} className={`flex-1 gap-1 text-xs h-8 ${studio.isActive ? "border-red-200 text-red-600 hover:bg-red-50" : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"}`}>
            {busy ? <RefreshCw className="w-3 h-3 animate-spin" /> : studio.isActive ? <ShieldOff className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
            {studio.isActive ? "Suspend" : "Activate"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onTogglePlan(studio)} disabled={busy} className={`flex-1 gap-1 text-xs h-8 ${isPro ? "border-slate-200 text-slate-600" : "border-amber-200 text-amber-600 hover:bg-amber-50"}`}>
            {isPro ? <><StarOff className="w-3 h-3" />Free plan</> : <><Crown className="w-3 h-3" />Upgrade</>}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onCopyLink(studio)} className="flex-1 gap-1 text-xs h-8 text-slate-600"><Link className="w-3 h-3" />Copy Link</Button>
          <Button size="sm" variant="outline" onClick={() => onDelete(studio)} className="flex-1 gap-1 text-xs h-8 border-rose-200 text-rose-600 hover:bg-rose-50"><Trash2 className="w-3 h-3" />Delete</Button>
        </div>
      </div>
    </div>
  );
}

export default function PlatformDashboard() {
  const router = useRouter();
  const { toast } = useToast();

  const [studios, setStudios]           = useState<PlatformStudio[]>([]);
  const [stats, setStats]               = useState<PlatformStats | null>(null);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [filter, setFilter]             = useState<StudioFilter>("all");
  const [updating, setUpdating]         = useState<string | null>(null);
  const [createOpen, setCreateOpen]     = useState(false);
  const [editTarget, setEditTarget]     = useState<PlatformStudio | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlatformStudio | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [entering, setEntering]         = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityStudioFilter, setActivityStudioFilter] = useState("");
  const [activityActionFilter, setActivityActionFilter] = useState("all");
  const [activityDateFilter, setActivityDateFilter]     = useState("");

  const [analytics, setAnalytics]             = useState<PlatformAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [health, setHealth]                   = useState<SystemHealth | null>(null);
  const [healthLoading, setHealthLoading]     = useState(false);
  const [upgradeRequests, setUpgradeRequests] = useState<PlatformUpgradeRequest[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettingsData>({ bankName: "", accountNumber: "", accountName: "", proPlanPrice: "50000" });
  const [settingsLoaded, setSettingsLoaded]   = useState(false);
  const [savingSettings, setSavingSettings]   = useState(false);
  const [confirmingId, setConfirmingId]       = useState<string | null>(null);
  const [rejectingId, setRejectingId]         = useState<string | null>(null);
  const [copiedAcct, setCopiedAcct]           = useState(false);
  const [exportingCsv, setExportingCsv]       = useState(false);
  const [notifications, setNotifications]     = useState<PlatformNotification[]>([]);
  const [notifOpen, setNotifOpen]             = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const adminName = typeof window !== "undefined" ? (localStorage.getItem("platform_user_name") || "Superadmin") : "Superadmin";

  useEffect(() => { if (!getPlatformToken()) router.push("/platform/login"); }, [router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [studioData, statsData] = await Promise.all([getPlatformStudios(), getPlatformStats()]);
      setStudios(studioData); setStats(statsData);
    } catch (err: unknown) { toast({ title: "Failed to load data", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" }); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) { if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false); }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => { getPlatformNotifications().then(setNotifications).catch(() => {}); }, []);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try { const data = await getPlatformAnalytics(); setAnalytics(data); }
    catch (err: unknown) { toast({ title: "Failed to load analytics", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" }); }
    finally { setAnalyticsLoading(false); }
  }, [toast]);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    try { const data = await getPlatformHealth(); setHealth(data); }
    catch (err: unknown) { toast({ title: "Failed to load health data", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" }); }
    finally { setHealthLoading(false); }
  }, [toast]);

  const loadPayments = useCallback(async () => {
    setPaymentsLoading(true);
    try {
      const [requests, settings] = await Promise.all([getPlatformUpgradeRequests(), settingsLoaded ? Promise.resolve(platformSettings) : getPlatformSettings()]);
      setUpgradeRequests(requests);
      if (!settingsLoaded) { setPlatformSettings(settings as PlatformSettingsData); setSettingsLoaded(true); }
    } catch (err: unknown) { toast({ title: "Failed to load payment data", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" }); }
    finally { setPaymentsLoading(false); }
  }, [toast, settingsLoaded, platformSettings]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try { const updated = await updatePlatformSettings(platformSettings); setPlatformSettings(updated); toast({ title: "Settings saved", description: "Bank account details updated." }); }
    catch (err: unknown) { toast({ title: "Save failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" }); }
    finally { setSavingSettings(false); }
  };

  const handleConfirmRequest = async (id: string) => {
    setConfirmingId(id);
    try {
      await confirmUpgradeRequest(id);
      setUpgradeRequests(prev => prev.map(r => r.id === id ? { ...r, status: "confirmed" as const } : r));
      setStudios(prev => { const req = upgradeRequests.find(r => r.id === id); if (!req) return prev; return prev.map(s => s.id === req.studioId ? { ...s, plan: "pro" } : s); });
      toast({ title: "Payment confirmed", description: "Studio has been upgraded to Pro." });
    } catch (err: unknown) { toast({ title: "Confirmation failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" }); }
    finally { setConfirmingId(null); }
  };

  const handleRejectRequest = async (id: string) => {
    setRejectingId(id);
    try { await rejectUpgradeRequest(id); setUpgradeRequests(prev => prev.map(r => r.id === id ? { ...r, status: "rejected" as const } : r)); toast({ title: "Request rejected" }); }
    catch (err: unknown) { toast({ title: "Rejection failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" }); }
    finally { setRejectingId(null); }
  };

  const handleToggleActive = async (studio: PlatformStudio) => {
    setUpdating(studio.id);
    try {
      const updated = await updatePlatformStudio(studio.id, { isActive: !studio.isActive });
      setStudios(prev => prev.map(s => s.id === studio.id ? { ...s, ...updated } : s));
      setStats(prev => prev ? { ...prev, activeStudios: updated.isActive ? prev.activeStudios + 1 : prev.activeStudios - 1, suspendedStudios: updated.isActive ? prev.suspendedStudios - 1 : prev.suspendedStudios + 1 } : prev);
      toast({ title: updated.isActive ? "Studio activated" : "Studio suspended" });
    } catch (err: unknown) { toast({ title: "Update failed", description: err instanceof Error ? err.message : "", variant: "destructive" }); }
    finally { setUpdating(null); }
  };

  const handleTogglePlan = async (studio: PlatformStudio) => {
    setUpdating(studio.id);
    try {
      const newPlan = studio.plan === "pro" ? "free" : "pro";
      const updated = await updatePlatformStudio(studio.id, { plan: newPlan });
      setStudios(prev => prev.map(s => s.id === studio.id ? { ...s, ...updated } : s));
      setStats(prev => prev ? { ...prev, proStudios: newPlan === "pro" ? prev.proStudios + 1 : prev.proStudios - 1, freeStudios: newPlan === "pro" ? prev.freeStudios - 1 : prev.freeStudios + 1 } : prev);
      toast({ title: `Plan changed to ${newPlan.toUpperCase()}` });
    } catch (err: unknown) { toast({ title: "Update failed", description: err instanceof Error ? err.message : "", variant: "destructive" }); }
    finally { setUpdating(null); }
  };

  const handleUpdated = (updated: PlatformStudio) => setStudios(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s));

  const handleDelete = async () => {
    if (!deleteTarget) return; setDeleting(true);
    try {
      await deletePlatformStudio(deleteTarget.id);
      setStudios(prev => prev.filter(s => s.id !== deleteTarget.id));
      setStats(prev => prev ? { ...prev, totalStudios: prev.totalStudios - 1, activeStudios: deleteTarget.isActive ? prev.activeStudios - 1 : prev.activeStudios } : prev);
      toast({ title: "Studio deleted", description: `"${deleteTarget.name}" and all its data have been removed.` }); setDeleteTarget(null);
    } catch (err: unknown) { toast({ title: "Delete failed", description: err instanceof Error ? err.message : "", variant: "destructive" }); }
    finally { setDeleting(false); }
  };

  const handleCopyLink = (studio: PlatformStudio) => {
    const url = `${window.location.origin}/s/${studio.slug}`;
    navigator.clipboard.writeText(url).then(() => toast({ title: "Link copied!", description: url }));
  };

  const handleEnterStudio = async (studio: PlatformStudio) => {
    setEntering(studio.id);
    try { const result = await impersonateStudio(studio.id); startImpersonation(result); router.push("/admin"); }
    catch (err: unknown) { toast({ title: "Failed to enter studio", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" }); setEntering(null); }
  };

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    try { const logs = await getPlatformActivity(); setActivityLogs(logs); }
    catch (err: unknown) { toast({ title: "Failed to load activity", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" }); }
    finally { setActivityLoading(false); }
  }, [toast]);

  const filtered = studios.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.slug.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" ? true : filter === "active" ? s.isActive : filter === "suspended" ? !s.isActive : filter === "pro" ? s.plan === "pro" : s.plan === "free";
    return matchSearch && matchFilter;
  });

  const filteredActivity = activityLogs.filter(log => {
    const matchStudio = activityStudioFilter === "" ? true : (log.studioName ?? "").toLowerCase().includes(activityStudioFilter.toLowerCase()) || (log.studioSlug ?? "").toLowerCase().includes(activityStudioFilter.toLowerCase());
    const matchAction = activityActionFilter === "all" ? true : log.action === activityActionFilter;
    const matchDate   = activityDateFilter === "" ? true : log.createdAt.startsWith(activityDateFilter);
    return matchStudio && matchAction && matchDate;
  });

  const unreadNotifCount = notifications.filter(n => n.type === "error" || n.type === "limit").length;

  const PIE_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444"];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Globe className="w-4 h-4" /></div>
            <div><span className="text-sm font-bold text-slate-900">PixelStudio Platform</span><span className="text-xs text-slate-400 ml-2">· {adminName}</span></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative" ref={notifRef}>
              <button onClick={() => setNotifOpen(v => !v)} className="relative w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors">
                <Bell className="w-4 h-4" />
                {unreadNotifCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{unreadNotifCount > 9 ? "9+" : unreadNotifCount}</span>}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-10 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">Notifications</span>
                    {notifications.length > 0 && <span className="text-xs text-slate-400">{notifications.length} alerts</span>}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? <div className="py-8 text-center text-slate-400 text-sm">No notifications</div> : notifications.map(n => (
                      <div key={n.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start gap-2.5">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${n.type === "error" ? "bg-rose-100 text-rose-600" : n.type === "warning" ? "bg-amber-100 text-amber-600" : n.type === "limit" ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"}`}>
                            {n.type === "error" ? <AlertTriangle className="w-3.5 h-3.5" /> : n.type === "warning" || n.type === "limit" ? <AlertCircle className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                          </div>
                          <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-slate-800">{n.title}</p><p className="text-xs text-slate-500 mt-0.5">{n.body}</p><p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.createdAt)}</p></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-2 h-8 text-xs font-semibold"><Plus className="w-3.5 h-3.5" />New Studio</Button>
            <Button variant="outline" size="sm" onClick={() => { clearPlatformToken(); router.push("/platform/login"); }} className="gap-1.5 h-8 text-xs text-slate-600"><LogOut className="w-3.5 h-3.5" />Sign out</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs defaultValue="overview">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <TabsList className="h-9 flex-wrap">
              <TabsTrigger value="overview"  className="gap-1.5 text-xs"><LayoutDashboard className="w-3.5 h-3.5" />Overview</TabsTrigger>
              <TabsTrigger value="studios"   className="gap-1.5 text-xs"><Building2 className="w-3.5 h-3.5" />Studios <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">{studios.length}</Badge></TabsTrigger>
              <TabsTrigger value="analytics" className="gap-1.5 text-xs" onClick={loadAnalytics}><TrendingUp className="w-3.5 h-3.5" />Analytics</TabsTrigger>
              <TabsTrigger value="activity"  className="gap-1.5 text-xs" onClick={loadActivity}><Activity className="w-3.5 h-3.5" />Activity</TabsTrigger>
              <TabsTrigger value="health"    className="gap-1.5 text-xs" onClick={loadHealth}><Wifi className="w-3.5 h-3.5" />Health</TabsTrigger>
              <TabsTrigger value="payments"  className="gap-1.5 text-xs" onClick={loadPayments}>
                <Banknote className="w-3.5 h-3.5" />Payments
                {upgradeRequests.filter(r => r.status === "pending").length > 0 && <Badge className="ml-1 text-xs px-1.5 py-0 bg-amber-500 text-white">{upgradeRequests.filter(r => r.status === "pending").length}</Badge>}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-0 space-y-6">
            <div><h2 className="text-xl font-bold text-slate-900">Platform Overview</h2><p className="text-sm text-slate-500 mt-0.5">Real-time metrics across all studios on PixelStudio.</p></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Studios"  value={stats?.totalStudios ?? "—"}                  icon={Building2}  color="bg-indigo-50 text-indigo-600" />
              <StatCard label="Active Studios" value={stats?.activeStudios ?? "—"}                 icon={CheckCircle} color="bg-emerald-50 text-emerald-600" sub={`${stats?.suspendedStudios ?? 0} suspended`} />
              <StatCard label="Pro Studios"    value={stats?.proStudios ?? "—"}                    icon={Crown}      color="bg-amber-50 text-amber-600" sub={`${stats?.freeStudios ?? 0} free`} />
              <StatCard label="Total Revenue"  value={stats ? fmtMoney(stats.totalRevenue) : "—"} icon={Banknote}   color="bg-green-50 text-green-600" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard label="Total Users"   value={fmt(stats?.totalUsers   ?? 0)} icon={Users}     color="bg-violet-50 text-violet-600" />
              <StatCard label="Total Clients" value={fmt(stats?.totalClients ?? 0)} icon={UserCheck} color="bg-sky-50 text-sky-600" />
              <StatCard label="Total Photos"  value={fmt(stats?.totalPhotos  ?? 0)} icon={Image}     color="bg-pink-50 text-pink-600" />
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 text-sm">Studio Breakdown</h3>
                <Button variant="ghost" size="sm" onClick={loadData} disabled={loading} className="gap-1.5 h-7 text-xs text-slate-500"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
              </div>
              {loading ? <div className="p-6 space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}</div> : studios.length === 0 ? (
                <div className="p-12 text-center text-slate-400"><Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No studios yet. Create the first one!</p></div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {studios.map(s => (
                    <div key={s.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                        {s.logoUrl ? <img src={getImageUrl(s.logoUrl)} alt={s.name} className="w-full h-full object-cover" /> : <Building2 className="w-4 h-4 text-slate-300" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-900">{s.name}</span>
                          <Badge variant="secondary" className="text-xs px-1.5">{s.slug}</Badge>
                          {s.plan === "pro" && <Badge className="text-xs px-1.5 bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200"><Crown className="w-2.5 h-2.5 mr-0.5" />Pro</Badge>}
                          {!s.isActive && <Badge variant="destructive" className="text-xs px-1.5">Suspended</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-xs text-slate-400 shrink-0">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{s._stats.staffCount}</span>
                        <span className="flex items-center gap-1"><UserCheck className="w-3 h-3" />{s._stats.clientCount}</span>
                        <span className="flex items-center gap-1"><Banknote className="w-3 h-3" />{fmtMoney(s._stats.revenue)}</span>
                        <span className="text-slate-300">{new Date(s.createdAt).toLocaleDateString()}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="studios" className="mt-0 space-y-5">
            <div className="flex items-center justify-between">
              <div><h2 className="text-xl font-bold text-slate-900">All Studios</h2><p className="text-sm text-slate-500 mt-0.5">Create, manage plans, and control access for every studio.</p></div>
              <div className="flex items-center gap-2">
                <Button variant="outline" disabled={exportingCsv} onClick={async () => { setExportingCsv(true); try { await exportStudiosCSV(); } catch (err: unknown) { toast({ title: "Export failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" }); } finally { setExportingCsv(false); } }} className="gap-2 text-sm">
                  {exportingCsv ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}Export CSV
                </Button>
                <Button onClick={() => setCreateOpen(true)} className="gap-2 text-sm"><Plus className="w-4 h-4" />New Studio</Button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or slug…" className="pl-9 h-9 text-sm" /></div>
              <Select value={filter} onValueChange={v => setFilter(v as StudioFilter)}>
                <SelectTrigger className="w-40 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Studios</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="suspended">Suspended</SelectItem><SelectItem value="pro">Pro Plan</SelectItem><SelectItem value="free">Free Plan</SelectItem></SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-1.5 h-9 text-sm text-slate-600 shrink-0"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
            </div>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-pulse space-y-3"><div className="flex gap-3"><div className="w-12 h-12 bg-slate-100 rounded-xl" /><div className="flex-1 space-y-2"><div className="h-4 bg-slate-100 rounded w-2/3" /><div className="h-3 bg-slate-100 rounded w-1/3" /></div></div></div>)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-slate-400"><Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="font-medium text-sm">{search || filter !== "all" ? "No studios match your filters" : "No studios yet — create the first one!"}</p></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(studio => <StudioCard key={studio.id} studio={studio} updating={entering === studio.id ? studio.id : updating} onToggleActive={handleToggleActive} onTogglePlan={handleTogglePlan} onEdit={setEditTarget} onDelete={setDeleteTarget} onCopyLink={handleCopyLink} onEnter={handleEnterStudio} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="mt-0 space-y-6">
            <div className="flex items-center justify-between">
              <div><h2 className="text-xl font-bold text-slate-900">Platform Analytics</h2><p className="text-sm text-slate-500 mt-0.5">Charts and trends across all studios.</p></div>
              <Button variant="outline" size="sm" onClick={loadAnalytics} disabled={analyticsLoading} className="gap-1.5 h-8 text-xs"><RefreshCw className={`w-3.5 h-3.5 ${analyticsLoading ? "animate-spin" : ""}`} />Refresh</Button>
            </div>
            {analyticsLoading ? <div className="py-16 flex items-center justify-center gap-2 text-slate-400 text-sm"><RefreshCw className="w-4 h-4 animate-spin" />Loading analytics…</div> : !analytics ? (
              <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-3"><BarChart3 className="w-10 h-10 opacity-30" /><p className="text-sm">Click Refresh to load analytics.</p></div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Total Revenue"  value={fmtMoney(analytics.totalRevenue)}                    icon={Banknote}   color="bg-green-50 text-green-600" />
                  <StatCard label="Total Invoices" value={analytics.totalInvoices}                              icon={FileText}   color="bg-indigo-50 text-indigo-600" />
                  <StatCard label="Paid Invoices"  value={analytics.paidInvoices}                              icon={CheckCircle} color="bg-emerald-50 text-emerald-600" sub={`${analytics.pendingInvoices} pending`} />
                  <StatCard label="Avg per Studio" value={fmtMoney(Math.round(analytics.avgRevenuePerStudio))} icon={TrendingUp}  color="bg-violet-50 text-violet-600" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2"><Crown className="w-4 h-4 text-amber-500" />Top Studios by Revenue</h3>
                    {analytics.topStudios.length === 0 ? <div className="py-8 text-center text-slate-400 text-sm">No revenue data yet.</div> : (
                      <div className="space-y-3">
                        {analytics.topStudios.map((s, i) => (
                          <div key={s.studioId} className="flex items-center gap-3">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-slate-100 text-slate-600" : "bg-orange-50 text-orange-600"}`}>{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2"><span className="text-sm font-medium text-slate-800 truncate">{s.studioName}</span>{s.plan === "pro" && <Badge className="text-[10px] h-4 px-1.5 bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200"><Crown className="w-2.5 h-2.5 mr-0.5" />Pro</Badge>}</div>
                              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1"><div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${analytics.topStudios[0].revenue > 0 ? (s.revenue / analytics.topStudios[0].revenue) * 100 : 0}%` }} /></div>
                            </div>
                            <span className="text-sm font-semibold text-emerald-700 shrink-0">{fmtMoney(s.revenue)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2"><Banknote className="w-4 h-4 text-emerald-500" />Revenue Over Time (Last 12 Months)</h3>
                    {analytics.revenueByMonth.length === 0 ? <div className="py-8 text-center text-slate-400 text-sm">No revenue data yet.</div> : (
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={analytics.revenueByMonth.map(r => ({ ...r, month: (() => { try { return format(parseISO(r.month + "-01"), "MMM yy"); } catch { return r.month; } })() }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `₦${v}`} />
                          <Tooltip formatter={(v: number) => [fmtMoney(v), "Revenue"]} contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
                          <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2.5} dot={{ fill: "#10b981", r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="mt-0 space-y-5">
            <div className="flex items-center justify-between">
              <div><h2 className="text-xl font-bold text-slate-900">Platform Activity</h2><p className="text-sm text-slate-500 mt-0.5">Recent actions across all studios — {filteredActivity.length} of {activityLogs.length} events.</p></div>
              <Button variant="outline" size="sm" onClick={loadActivity} disabled={activityLoading} className="gap-1.5 h-8 text-xs"><RefreshCw className={`w-3.5 h-3.5 ${activityLoading ? "animate-spin" : ""}`} />Refresh</Button>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-36 max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" /><Input value={activityStudioFilter} onChange={e => setActivityStudioFilter(e.target.value)} placeholder="Filter by studio…" className="pl-9 h-8 text-xs" /></div>
              <Select value={activityActionFilter} onValueChange={setActivityActionFilter}>
                <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Actions</SelectItem>{Object.keys(ACT_META).map(k => <SelectItem key={k} value={k}>{ACT_META[k].label}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="date" value={activityDateFilter} onChange={e => setActivityDateFilter(e.target.value)} className="h-8 text-xs w-40" />
              {(activityStudioFilter || activityActionFilter !== "all" || activityDateFilter) && <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-slate-500" onClick={() => { setActivityStudioFilter(""); setActivityActionFilter("all"); setActivityDateFilter(""); }}><X className="w-3 h-3" />Clear</Button>}
            </div>
            {activityLoading ? <div className="py-16 flex items-center justify-center gap-2 text-slate-400 text-sm"><RefreshCw className="w-4 h-4 animate-spin" />Loading…</div> : activityLogs.length === 0 ? (
              <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-3"><Activity className="w-10 h-10 opacity-30" /><p className="text-sm">Click Refresh to load activity logs.</p></div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
                {filteredActivity.length === 0 ? <div className="py-8 text-center text-slate-400 text-sm">No activity matches your filters.</div> : filteredActivity.map(log => {
                  const meta = ACT_META[log.action];
                  return (
                    <div key={log.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50/70 transition-colors">
                      <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${meta?.color ?? "bg-slate-100 text-slate-400 border-slate-200"}`}>{meta ? <meta.icon className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800">{meta?.label ?? log.action}</span>
                          {log.entityName && <span className="text-sm text-slate-600">— <span className="font-medium">{log.entityName}</span></span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-slate-500">by <span className="font-medium text-slate-700">{log.userName}</span></span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">{log.userRole}</Badge>
                          {log.studioName && <Badge variant="outline" className="text-[10px] h-4 px-1.5">{log.studioName}</Badge>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-medium text-slate-500">{timeAgo(log.createdAt)}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{new Date(log.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="health" className="mt-0 space-y-6">
            <div className="flex items-center justify-between">
              <div><h2 className="text-xl font-bold text-slate-900">System Health</h2><p className="text-sm text-slate-500 mt-0.5">API, database, and server status.</p></div>
              <Button variant="outline" size="sm" onClick={loadHealth} disabled={healthLoading} className="gap-1.5 h-8 text-xs"><RefreshCw className={`w-3.5 h-3.5 ${healthLoading ? "animate-spin" : ""}`} />Check Now</Button>
            </div>
            {healthLoading ? <div className="py-16 flex items-center justify-center gap-2 text-slate-400 text-sm"><RefreshCw className="w-4 h-4 animate-spin" />Checking system health…</div> : !health ? (
              <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-3"><Wifi className="w-10 h-10 opacity-30" /><p className="text-sm">Click "Check Now" to run a health check.</p></div>
            ) : (
              <div className="space-y-4">
                <div className={`flex items-center gap-3 rounded-2xl border px-5 py-4 ${health.status === "operational" ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${health.status === "operational" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}>{health.status === "operational" ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}</div>
                  <div><div className="font-semibold text-slate-900 capitalize">{health.status === "operational" ? "All Systems Operational" : "System Issues Detected"}</div><div className="text-xs text-slate-500 mt-0.5">Checked at {new Date(health.checkedAt).toLocaleTimeString()}</div></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Database className="w-5 h-5" /></div><div><p className="text-sm font-semibold text-slate-800">Database</p><span className={`text-xs font-medium ${health.database.status === "connected" ? "text-emerald-600" : "text-rose-600"}`}>{health.database.status}</span></div></div>
                    <div className="space-y-2 text-xs text-slate-600"><div className="flex justify-between"><span>Latency</span><span className={`font-semibold ${health.database.latencyMs < 50 ? "text-emerald-600" : health.database.latencyMs < 200 ? "text-amber-600" : "text-rose-600"}`}>{health.database.latencyMs}ms</span></div></div>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center"><Server className="w-5 h-5" /></div><div><p className="text-sm font-semibold text-slate-800">Server</p><span className="text-xs font-medium text-emerald-600">running</span></div></div>
                    <div className="space-y-2 text-xs text-slate-600"><div className="flex justify-between"><span className="flex items-center gap-1"><Clock className="w-3 h-3" />Uptime</span><span className="font-semibold text-slate-800">{health.server.uptimeHuman}</span></div></div>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center"><MemoryStick className="w-5 h-5" /></div><div><p className="text-sm font-semibold text-slate-800">Memory</p><span className="text-xs font-medium text-slate-500">Node.js heap</span></div></div>
                    <div className="space-y-2 text-xs text-slate-600"><div className="flex justify-between"><span>Heap used</span><span className="font-semibold">{health.memory.heapUsedMb} MB</span></div><div className="flex justify-between"><span>RSS</span><span className="font-semibold">{health.memory.rss} MB</span></div></div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="payments" className="mt-0 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
              <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0"><Banknote className="w-5 h-5" /></div><div><h3 className="text-base font-semibold text-slate-900">Bank Account Settings</h3><p className="text-sm text-slate-500">Studios will use these details to make upgrade payments.</p></div></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-sm font-medium">Bank Name</Label><Input value={platformSettings.bankName} onChange={e => setPlatformSettings(p => ({ ...p, bankName: e.target.value }))} placeholder="e.g. Zenith Bank" className="h-10" /></div>
                <div className="space-y-1.5"><Label className="text-sm font-medium">Account Name</Label><Input value={platformSettings.accountName} onChange={e => setPlatformSettings(p => ({ ...p, accountName: e.target.value }))} placeholder="e.g. PixelStudio Ltd" className="h-10" /></div>
                <div className="space-y-1.5"><Label className="text-sm font-medium">Account Number</Label><div className="flex gap-2"><Input value={platformSettings.accountNumber} onChange={e => setPlatformSettings(p => ({ ...p, accountNumber: e.target.value }))} placeholder="0123456789" className="h-10 font-mono" /><Button variant="outline" size="sm" className="h-10 px-3" onClick={() => { navigator.clipboard.writeText(platformSettings.accountNumber); setCopiedAcct(true); setTimeout(() => setCopiedAcct(false), 2000); }}>{copiedAcct ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}</Button></div></div>
                <div className="space-y-1.5"><Label className="text-sm font-medium">Pro Plan Price (₦)</Label><Input type="number" value={platformSettings.proPlanPrice} onChange={e => setPlatformSettings(p => ({ ...p, proPlanPrice: e.target.value }))} placeholder="50000" className="h-10" /></div>
              </div>
              <Button onClick={handleSaveSettings} disabled={savingSettings} className="gap-2">{savingSettings ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</> : <><Save className="w-4 h-4" />Save Settings</>}</Button>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between px-6 pt-6 pb-4">
                <div><h3 className="text-base font-semibold text-slate-900">Upgrade Requests</h3><p className="text-sm text-slate-500">Review studio payment submissions and confirm or reject them.</p></div>
                <Button variant="outline" size="sm" onClick={loadPayments} disabled={paymentsLoading} className="gap-1.5"><RefreshCw className={`w-3.5 h-3.5 ${paymentsLoading ? "animate-spin" : ""}`} />Refresh</Button>
              </div>
              {paymentsLoading ? <div className="flex items-center justify-center py-12 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" />Loading…</div> : upgradeRequests.length === 0 ? (
                <div className="text-center py-12 text-slate-400"><Banknote className="w-10 h-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No upgrade requests yet.</p></div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {upgradeRequests.map(req => {
                    const isPending = req.status === "pending"; const isConfirmed = req.status === "confirmed";
                    const isBusy = confirmingId === req.id || rejectingId === req.id;
                    return (
                      <div key={req.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm text-slate-900">{req.studioName}</span>
                            <Badge variant="outline" className="text-xs">/s/{req.studioSlug}</Badge>
                            <Badge className={`text-xs ${req.studioPlan === "pro" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{req.studioPlan}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span>Ref: <span className="font-mono font-medium text-slate-700">{req.reference}</span></span>
                            <span>Amount: <span className="font-medium text-slate-700">₦{Number(req.amount).toLocaleString()}</span></span>
                            <span>Submitted: {new Date(req.createdAt).toLocaleDateString()}</span>
                          </div>
                          {req.notes && <p className="text-xs text-slate-400 mt-1 italic">"{req.notes}"</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isPending ? (
                            <>
                              <Button size="sm" onClick={() => handleConfirmRequest(req.id)} disabled={isBusy} className="gap-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">{confirmingId === req.id ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-3.5 h-3.5" />}Confirm</Button>
                              <Button size="sm" variant="outline" onClick={() => handleRejectRequest(req.id)} disabled={isBusy} className="gap-1 h-8 text-xs border-rose-200 text-rose-600 hover:bg-rose-50">{rejectingId === req.id ? <span className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" /> : <X className="w-3.5 h-3.5" />}Reject</Button>
                            </>
                          ) : (
                            <Badge className={`text-xs ${isConfirmed ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{isConfirmed ? <><Check className="w-3 h-3 mr-1 inline" />Confirmed</> : <><X className="w-3 h-3 mr-1 inline" />Rejected</>}</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <CreateStudioDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={s => { setStudios(prev => [s, ...prev]); setStats(prev => prev ? { ...prev, totalStudios: prev.totalStudios + 1, activeStudios: prev.activeStudios + 1, freeStudios: s.plan === "free" ? prev.freeStudios + 1 : prev.freeStudios, proStudios: s.plan === "pro" ? prev.proStudios + 1 : prev.proStudios } : prev); }} />
      <EditStudioDialog studio={editTarget} onClose={() => setEditTarget(null)} onUpdated={handleUpdated} />
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600"><Trash2 className="w-5 h-5" />Delete Studio</AlertDialogTitle>
            <AlertDialogDescription>You are about to permanently delete <strong>"{deleteTarget?.name}"</strong> and all of its data — clients, photos, invoices, payments, galleries, and staff accounts.<br /><br /><span className="text-rose-600 font-medium">This cannot be undone.</span></AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-rose-600 hover:bg-rose-700 focus:ring-rose-600">{deleting ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Deleting…</span> : "Yes, delete everything"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
