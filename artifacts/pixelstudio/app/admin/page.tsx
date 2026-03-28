"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Progress } from "@/components/ui/progress";
import { Users, Image as ImageIcon, Briefcase, ChevronRight, Clock, CreditCard, Crown, AlertTriangle, type LucideIcon } from "lucide-react";
import { useAdminDashboard, useStaff } from "@/hooks/use-data";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout";

const NairaIcon = (({ className, ...props }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...props}>
    <path d="M7 5v14" /><path d="M17 5v14" /><path d="M7 7l10 10" /><path d="M7 17V7h10" /><path d="M5 10h14" /><path d="M5 14h14" />
  </svg>
)) as LucideIcon;

function toTitle(s: string) {
  return s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function AdminDashboardContent() {
  const { data: dashboard, isLoading: loadingDashboard } = useAdminDashboard();
  const { data: staff, isLoading: loadingStaff } = useStaff();
  const router = useRouter();
  const userName = typeof window !== "undefined" ? localStorage.getItem("user_name") || "Admin" : "Admin";

  const stats          = dashboard?.stats;
  const recentClients  = dashboard?.recentClients ?? [];
  const recentPayments = dashboard?.recentPayments ?? [];
  const totalPaid      = stats?.totalPaid ?? stats?.totalRevenue ?? 0;
  const totalPending   = stats?.totalPending ?? 0;
  const pendingCount   = stats?.pendingPaymentsCount ?? 0;
  const uploadedGalleries = stats?.totalGalleries ?? 0;
  const totalStaff     = stats?.totalStaff ?? staff?.filter((s) => s.status === "Active").length ?? 0;
  const totalClients   = stats?.totalClients ?? 0;
  const totalPhotos    = stats?.totalPhotos ?? 0;

  const plan   = typeof window !== "undefined" ? (localStorage.getItem("studio_plan") ?? "free") : "free";
  const isFree = plan !== "pro";
  const FREE_LIMITS = { staff: 3, clients: 50, photos: 200 };
  const atLimit = isFree && (totalStaff >= FREE_LIMITS.staff || totalClients >= FREE_LIMITS.clients || totalPhotos >= FREE_LIMITS.photos);
  const nearLimit = isFree && (totalStaff >= FREE_LIMITS.staff * 0.8 || totalClients >= FREE_LIMITS.clients * 0.8 || totalPhotos >= FREE_LIMITS.photos * 0.8);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-7 shadow-lg border border-slate-700/50">
        <div className="absolute right-0 top-0 p-6 opacity-5"><Briefcase className="w-56 h-56" /></div>
        <div className="relative z-10">
          <p className="text-slate-400 text-sm font-medium mb-1">Admin Portal</p>
          <h1 className="text-3xl font-display font-bold">Good morning, {userName}</h1>
          <p className="text-slate-300 mt-2">Studio is running with <span className="text-white font-bold">{totalStaff} active staff</span> and <span className="text-white font-bold">{pendingCount} pending payment{pendingCount !== 1 ? "s" : ""}</span>.</p>
        </div>
      </div>

      {atLimit && (
        <div className="rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-amber-50 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5"><Crown className="w-4 h-4" /></div>
            <div>
              <p className="font-semibold text-rose-800 text-sm">You've reached your free plan limit</p>
              <p className="text-xs text-rose-600 mt-0.5">Upgrade to Pro for unlimited staff, clients, and photos.</p>
            </div>
          </div>
          <Link href="/admin/settings">
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white gap-2 shrink-0"><Crown className="w-3.5 h-3.5" />Upgrade to Pro</Button>
          </Link>
        </div>
      )}

      {isFree && (
        <div className={`rounded-2xl border p-5 ${nearLimit ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {nearLimit ? <AlertTriangle className="w-4 h-4 text-amber-600" /> : <Crown className="w-4 h-4 text-slate-400" />}
              <span className={`text-sm font-semibold ${nearLimit ? "text-amber-800" : "text-slate-700"}`}>{nearLimit ? "Approaching plan limits" : "Free Plan Usage"}</span>
            </div>
            <Link href="/admin/settings">
              <Button variant="ghost" size="sm" className="text-xs text-amber-600 hover:text-amber-700 h-7 px-2 gap-1"><Crown className="w-3 h-3" />Upgrade</Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[{ label: "Staff", used: totalStaff, limit: FREE_LIMITS.staff }, { label: "Clients", used: totalClients, limit: FREE_LIMITS.clients }, { label: "Photos", used: totalPhotos, limit: FREE_LIMITS.photos }].map(({ label, used, limit }) => {
              const pct = Math.min(100, Math.round((used / limit) * 100));
              const isNear = pct >= 80;
              return (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-600">{label}</span>
                    <span className={isNear ? "text-amber-700 font-semibold" : "text-slate-500"}>{used} / {limit}</span>
                  </div>
                  <Progress value={pct} className={`h-2 ${isNear ? "[&>div]:bg-amber-500" : "[&>div]:bg-slate-400"}`} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard title="Total Staff"   value={loadingDashboard || loadingStaff ? "..." : totalStaff}  icon={Briefcase}  colorScheme="violet" />
        <StatCard title="Total Clients" value={loadingDashboard ? "..." : totalClients}                  icon={Users}      colorScheme="blue" />
        <StatCard title="Total Paid"    value={loadingDashboard ? "..." : `N${totalPaid.toLocaleString()}`}    icon={NairaIcon}  colorScheme="emerald" />
        <StatCard title="Total Pending" value={loadingDashboard ? "..." : `N${totalPending.toLocaleString()}`} icon={Clock}      colorScheme="amber" />
        <StatCard title="Galleries Live" value={loadingDashboard ? "..." : uploadedGalleries}            icon={ImageIcon}  colorScheme="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-2 shadow-sm border-border/40">
          <CardHeader className="flex flex-row items-center justify-between pb-4 bg-slate-50/50 border-b border-border/40">
            <div><CardTitle className="text-xl font-display">Recent Payments</CardTitle><p className="text-sm text-muted-foreground mt-0.5">Latest customer transactions.</p></div>
            <Button variant="ghost" size="sm" asChild><Link href="/admin/payments" className="text-primary font-semibold gap-1 flex items-center">View All <ChevronRight className="w-4 h-4" /></Link></Button>
          </CardHeader>
          <CardContent className="p-0">
            {loadingDashboard ? (
              <div className="space-y-3 p-5">{[1,2,3].map((i) => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}</div>
            ) : recentPayments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-muted-foreground"><CreditCard className="w-8 h-8 mb-2 opacity-30" /><p className="text-sm">No payment records yet.</p></div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border/40 text-muted-foreground bg-slate-50/30"><th className="font-semibold text-left py-3 pl-6">Customer</th><th className="font-semibold text-left py-3">Staff</th><th className="font-semibold text-left py-3">Amount</th><th className="font-semibold text-left py-3">Status</th><th className="font-semibold text-right py-3 pr-6">Date</th></tr></thead>
                <tbody className="divide-y divide-border/30">
                  {recentPayments.slice(0, 6).map((payment: any, i: number) => (
                    <tr key={payment.id} className={`hover:bg-slate-50/60 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-muted/20"}`}>
                      <td className="py-3.5 pl-6 font-semibold text-foreground">{payment.client?.clientName}</td>
                      <td className="py-3.5 text-muted-foreground text-sm">{payment.receivedBy?.name}</td>
                      <td className="py-3.5 font-bold text-foreground">N{parseFloat(payment.amount).toLocaleString()}</td>
                      <td className="py-3.5"><StatusBadge status={payment.status === "PAID" ? "Paid" : "Pending"} /></td>
                      <td className="py-3.5 text-right pr-6 text-muted-foreground text-sm">{new Date(payment.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/40">
          <CardHeader className="pb-4 bg-slate-50/50 border-b border-border/40">
            <div className="flex items-center justify-between"><CardTitle className="text-xl font-display">Team</CardTitle><Button variant="ghost" size="sm" asChild><Link href="/admin/staff" className="text-primary text-sm font-semibold">Manage</Link></Button></div>
            <p className="text-sm text-muted-foreground">Active studio members.</p>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {loadingStaff ? (
              <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}</div>
            ) : !staff || staff.length === 0 ? (
              <p className="text-sm text-center text-muted-foreground py-6">No staff members yet.</p>
            ) : (
              staff.slice(0, 5).map((member) => (
                <div key={member.id} className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-sm ${member.status === "Active" ? "bg-gradient-to-br from-violet-100 to-indigo-100 text-violet-700 border border-violet-200/50" : "bg-slate-100 text-slate-500"}`}>{member.name.charAt(0)}</div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-foreground truncate">{member.name}</p><p className="text-xs text-muted-foreground truncate">{member.email}</p></div>
                  <StatusBadge status={member.status} />
                </div>
              ))
            )}
            <Button variant="outline" className="w-full mt-2 bg-white" asChild><Link href="/admin/staff">View All Staff</Link></Button>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-border/40">
        <CardHeader className="pb-4 bg-slate-50/50 border-b border-border/40 flex flex-row items-center justify-between">
          <div><CardTitle className="text-xl font-display">Recent Customer Activity</CardTitle><p className="text-sm text-muted-foreground mt-0.5">5 most recent client records and order statuses.</p></div>
          <Button variant="ghost" size="sm" asChild><Link href="/staff/clients" className="text-primary font-semibold gap-1 flex items-center">All Records <ChevronRight className="w-4 h-4" /></Link></Button>
        </CardHeader>
        <CardContent className="p-0">
          {loadingDashboard ? (
            <div className="space-y-3 p-5">{[1,2,3,4,5].map((i) => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}</div>
          ) : recentClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-muted-foreground"><Users className="w-8 h-8 mb-2 opacity-30" /><p className="text-sm font-medium">No client records yet.</p><p className="text-xs mt-1">Clients added by staff will appear here.</p></div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border/40 text-muted-foreground bg-slate-50/30"><th className="font-semibold text-left py-3 pl-6">Customer</th><th className="font-semibold text-left py-3">Staff</th><th className="font-semibold text-left py-3">Format</th><th className="font-semibold text-left py-3">Order</th><th className="font-semibold text-left py-3">Payment</th><th className="font-semibold text-right py-3 pr-6">Price</th></tr></thead>
              <tbody className="divide-y divide-border/30">
                {recentClients.map((client: any, i: number) => (
                  <tr key={client.id} className={`hover:bg-slate-50/60 transition-colors cursor-pointer ${i % 2 === 0 ? "bg-white" : "bg-muted/20"}`} onClick={() => router.push(`/staff/clients/${client.id}`)}>
                    <td className="py-3.5 pl-6 font-semibold text-foreground">{client.clientName}</td>
                    <td className="py-3.5 text-muted-foreground text-sm">{client.createdBy?.name ?? "—"}</td>
                    <td className="py-3.5"><StatusBadge status={toTitle(client.photoFormat ?? "SOFTCOPY") as any} /></td>
                    <td className="py-3.5"><StatusBadge status={toTitle(client.orderStatus ?? "PENDING") as any} /></td>
                    <td className="py-3.5"><StatusBadge status={toTitle(client.paymentStatus ?? "PENDING") as any} /></td>
                    <td className="py-3.5 text-right pr-6 font-bold text-foreground">N{parseFloat(client.price ?? "0").toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminDashboardPage() {
  return <AppLayout><AdminDashboardContent /></AppLayout>;
}
