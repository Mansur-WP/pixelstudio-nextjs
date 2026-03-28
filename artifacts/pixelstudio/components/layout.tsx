"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  UserPlus, 
  Image as ImageIcon,
  LogOut,
  Camera,
  Bell,
  Settings,
  ChevronRight,
  Activity,
  ShieldAlert,
} from "lucide-react";
import { SyncStatusBar } from "@/components/sync-status-bar";
import { 
  Sidebar, 
  SidebarContent, 
  SidebarFooter,
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem, 
  SidebarProvider, 
  SidebarTrigger 
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [isImpersonating, setIsImpersonating]     = useState(false);
  const [impersonatedStudio, setImpersonatedStudio] = useState("Studio");
  const [userName, setUserName] = useState("User");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedRole = localStorage.getItem("role");
    if (!savedRole && pathname && !pathname.startsWith("/login") && !pathname.startsWith("/gallery") && !pathname.startsWith("/s/")) {
      router.push("/login");
    }
    setRole(savedRole);
    setIsImpersonating(localStorage.getItem("ps_impersonating") === "1");
    setImpersonatedStudio(localStorage.getItem("ps_impersonating_studio") || "Studio");
    setUserName(localStorage.getItem("user_name") || (savedRole === "admin" ? "Admin User" : "Staff Member"));
  }, [pathname, router]);

  const exitImpersonation = () => {
    ["ps_token", "role", "user_name", "user_id", "user_email", "studio_slug", "studio_name", "studio_logo", "studio_plan", "studio_id", "ps_impersonating", "ps_impersonating_studio"].forEach(k => localStorage.removeItem(k));
    router.push("/platform");
  };

  if (!mounted) return null;

  if (!pathname || pathname.startsWith("/login") || pathname.startsWith("/s/") || pathname.startsWith("/gallery") || pathname.includes("/invoice")) {
    return <>{children}</>;
  }

  if (!role) return null;

  const adminNav = [
    { title: "Dashboard",    url: "/admin",          icon: LayoutDashboard },
    { title: "Manage Staff", url: "/admin/staff",    icon: Users },
    { title: "All Payments", url: "/admin/payments", icon: CreditCard },
    { title: "Activity Log", url: "/admin/activity", icon: Activity },
    { title: "Settings",     url: "/admin/settings", icon: Settings },
  ];

  const staffNav = [
    { title: "Dashboard",       url: "/staff",             icon: LayoutDashboard },
    { title: "New Customer",    url: "/staff/clients/new", icon: UserPlus },
    { title: "Customer Records",url: "/staff/clients",     icon: ImageIcon },
  ];

  const navItems = role === "admin" ? adminNav : staffNav;

  const handleLogout = () => {
    localStorage.removeItem("role");
    localStorage.removeItem("user_name");
    router.push("/login");
  };

  return (
    <SidebarProvider style={{ "--sidebar-width": "16rem", "--sidebar-width-icon": "4rem" } as React.CSSProperties}>
      <div className="flex h-screen w-full bg-slate-50/50">
        <Sidebar variant="sidebar" className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
          <SidebarContent>
            <div className="flex h-20 items-center px-6 mb-2">
              <div className="flex items-center gap-3 font-display text-xl font-bold text-sidebar-primary-foreground">
                <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-indigo-600 shadow-lg shadow-primary/20">
                  <Camera className="w-5 h-5 text-white relative z-10" />
                  <div className="absolute inset-0 bg-white/20 blur-md rounded-xl"></div>
                </div>
                PixelStudio
              </div>
            </div>
            
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs tracking-wider uppercase text-sidebar-foreground/50 px-6 mb-2">
                Main Menu
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="px-3">
                  {navItems.map((item) => {
                    const isActive = pathname === item.url;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton 
                          asChild 
                          isActive={isActive}
                          className={`py-6 px-4 transition-all duration-200 rounded-xl mb-1 ${
                            isActive 
                              ? "bg-sidebar-accent/50 text-sidebar-primary-foreground border-l-4 border-primary" 
                              : "text-sidebar-foreground/70 hover:text-sidebar-primary-foreground hover:bg-sidebar-accent/30"
                          }`}
                        >
                          <Link href={item.url} className="flex items-center gap-3 font-medium text-sm">
                            <item.icon className={`w-5 h-5 ${isActive ? "text-primary" : "opacity-70"}`} />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/50">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0 shadow-inner">
                {userName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-sidebar-primary-foreground truncate">
                  {userName}
                </div>
                <div className="text-xs text-sidebar-foreground/60 capitalize truncate">
                  {role} Portal
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="text-sidebar-foreground/60 hover:text-sidebar-primary-foreground hover:bg-sidebar-accent h-8 w-8 shrink-0 rounded-lg">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>
        
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-dot-pattern">
          <header className="h-16 flex-shrink-0 flex items-center justify-between px-6 lg:px-10 border-b border-border/40 bg-white/80 backdrop-blur-md sticky top-0 z-10 shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="md:hidden" />
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground capitalize">{role}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                <span className="truncate">{
                  navItems.find(n => n.url === pathname)?.title || "Page"
                }</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <SyncStatusBar />
              <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground rounded-full">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
              </Button>
            </div>
          </header>
          
          {isImpersonating && (
            <div className="flex items-center gap-3 px-6 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
              <span>You are viewing <strong>{impersonatedStudio}</strong> as a platform superadmin.</span>
              <Button size="sm" variant="outline" onClick={exitImpersonation} className="ml-auto h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-100">
                Exit Studio View
              </Button>
            </div>
          )}
          <main className="flex-1 overflow-y-auto p-6 lg:p-10">
            <div className="max-w-7xl mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
