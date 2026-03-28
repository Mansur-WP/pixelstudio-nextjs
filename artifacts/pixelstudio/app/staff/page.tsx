"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Users, Camera, UploadCloud, ArrowRight, UserPlus, FileText, ImageIcon, Clock, type LucideIcon } from "lucide-react";
import { useClients, useStaffDashboard } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout";

const NairaIcon = (({ className, ...props }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...props}>
    <path d="M7 5v14" /><path d="M17 5v14" /><path d="M7 7l10 10" /><path d="M7 17V7h10" />
    <path d="M5 10h14" /><path d="M5 14h14" />
  </svg>
)) as LucideIcon;

function StaffDashboardContent() {
  const router = useRouter();
  const { data: dashboard, isLoading: loadingDashboard } = useStaffDashboard();
  const { data: clients, isLoading } = useClients();
  const userName = typeof window !== "undefined" ? (localStorage.getItem("user_name") || "Staff Member") : "Staff Member";
  const clients_ = clients ?? [];
  const stats = dashboard?.stats;

  const totalPaid         = stats?.totalPaid ?? stats?.totalRevenue ?? 0;
  const totalPending      = stats?.totalPending ?? 0;
  const pendingEditing    = stats?.pendingEditingCount    ?? clients_.filter(c => c.orderStatus === "Editing").length;
  const readyToUpload     = stats?.readyForUploadCount   ?? clients_.filter(c => c.orderStatus === "Ready" && c.photoCount === 0).length;
  const uploadedGalleries = stats?.uploadedGalleriesCount ?? clients_.filter(c => c.photoCount > 0).length;
  const totalClients      = stats?.totalClients ?? clients_.length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white p-7 shadow-lg">
        <div className="absolute top-0 right-0 opacity-10 p-6"><Camera className="w-48 h-48" /></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <p className="text-indigo-200 text-sm font-medium mb-1">Staff Portal</p>
            <h1 className="text-3xl font-display font-bold">Welcome back, {userName}</h1>
            <p className="text-indigo-100 mt-2">
              You have <span className="font-bold text-white">{pendingEditing} shoots waiting for editing</span> and{" "}
              <span className="font-bold text-white">{readyToUpload} ready to upload</span>.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Button asChild variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white">
              <Link href="/staff/clients">View Records</Link>
            </Button>
            <Button asChild className="bg-white text-indigo-700 hover:bg-slate-50 shadow-md font-bold gap-2">
              <Link href="/staff/clients/new"><UserPlus className="w-4 h-4" /> New Customer</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
        <StatCard title="Total Clients"      value={loadingDashboard && isLoading ? "..." : totalClients}      icon={Users}      colorScheme="violet" />
        <StatCard title="Pending Editing"    value={loadingDashboard && isLoading ? "..." : pendingEditing}    icon={Camera}     colorScheme="amber"
          trend={pendingEditing > 0 ? { value: pendingEditing, label: "need attention" } : undefined} />
        <StatCard title="Uploaded Galleries" value={loadingDashboard && isLoading ? "..." : uploadedGalleries} icon={ImageIcon}  colorScheme="blue" />
        <StatCard title="Total Paid"         value={loadingDashboard ? "..." : `N${totalPaid.toLocaleString()}`}    icon={NairaIcon}  colorScheme="emerald" />
        <StatCard title="Total Pending"      value={loadingDashboard ? "..." : `N${totalPending.toLocaleString()}`}  icon={Clock}      colorScheme="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-2 shadow-sm border-border/40 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-4 bg-slate-50/50 border-b border-border/40">
            <CardTitle className="text-xl font-display font-bold">Recent Customer</CardTitle>
            <Button variant="ghost" size="sm" asChild className="hover:bg-white hover:shadow-sm">
              <Link href="/staff/clients" className="text-primary font-semibold gap-1 flex items-center">All Customer <ArrowRight className="w-4 h-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3 p-5">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}</div>
            ) : clients_.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No clients yet. <Link href="/staff/clients/new" className="text-primary underline">Add your first.</Link></p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {clients_.slice(0, 5).map((client, i) => (
                  <div key={client.id} className={`flex items-center justify-between p-4 hover:bg-slate-50/80 transition-colors cursor-pointer ${i % 2 === 0 ? "bg-white" : "bg-muted/20"}`}
                    onClick={() => router.push(`/staff/clients/${client.id}`)}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center text-violet-700 font-bold shadow-sm border border-violet-200/50 shrink-0">
                        {client.clientName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{client.clientName}</p>
                        <p className="text-xs text-muted-foreground">{new Date(client.date).toLocaleDateString()} · {client.photoCount} photos</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={client.orderStatus} />
                      <StatusBadge status={client.paymentStatus} />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg"
                        onClick={e => { e.stopPropagation(); router.push(`/staff/clients/${client.id}/invoice`); }}>
                        <FileText className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/40 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 bg-slate-50/50 border-b border-border/40">
              <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5">
              {[
                { label: "Add New Customer",  icon: UserPlus,    href: "/staff/clients/new", variant: "default" as const },
                { label: "Upload Photos",     icon: UploadCloud, href: "/staff/clients",     variant: "outline" as const },
                { label: "View All Records",  icon: Users,       href: "/staff/clients",     variant: "outline" as const },
              ].map(({ label, icon: Icon, href, variant }) => (
                <Button key={label} variant={variant} asChild className={`w-full justify-start gap-2 h-10 ${variant === "outline" ? "bg-white" : "shadow-md"}`}>
                  <Link href={href}><Icon className="w-4 h-4" />{label}</Link>
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/40 shadow-sm">
            <CardHeader className="pb-3 bg-slate-50/50 border-b border-border/40">
              <CardTitle className="text-base font-semibold">Upload Status</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {[
                { label: "Uploaded",        count: uploadedGalleries, color: "bg-emerald-500" },
                { label: "Pending Editing", count: pendingEditing,    color: "bg-amber-400" },
                { label: "Ready to Upload", count: readyToUpload,     color: "bg-violet-500" },
              ].map(({ label, count, color }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                    <span className="text-muted-foreground">{label}</span>
                  </div>
                  <span className="font-bold text-foreground">{loadingDashboard && isLoading ? "..." : count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function StaffDashboardPage() {
  return <AppLayout><StaffDashboardContent /></AppLayout>;
}
