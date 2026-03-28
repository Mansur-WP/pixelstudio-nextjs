"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Eye, EyeOff, AlertCircle, Mail, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { platformLogin, getPlatformToken } from "@/lib/api";

export default function PlatformLogin() {
  const router      = useRouter();
  const { toast }   = useToast();

  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPw, setShowPw]         = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading]       = useState(false);

  useEffect(() => {
    if (getPlatformToken()) router.push("/platform");
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoading(true);
    try {
      const { user } = await platformLogin(email.trim(), password);
      localStorage.setItem("platform_user_name", user.name);
      localStorage.setItem("platform_user_id",   user.id);
      if (user.email) localStorage.setItem("platform_user_email", user.email);
      toast({ title: "Access granted", description: `Welcome, ${user.name}.` });
      router.push("/platform");
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 shadow-[0_0_40px_rgba(139,92,246,0.25)]">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Platform Administration</h1>
            <p className="text-slate-500 text-sm mt-1">Authorized personnel only</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-slate-300">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="email"
                  type="text"
                  placeholder="admin@platform"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setLoginError(""); }}
                  className="h-11 pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:border-primary focus:ring-primary/30"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-slate-300">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  placeholder="········"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setLoginError(""); }}
                  className="h-11 pl-10 pr-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:border-primary focus:ring-primary/30"
                  autoComplete="current-password"
                  required
                />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="flex items-center gap-2.5 text-sm text-rose-400 bg-rose-950/60 border border-rose-900 rounded-xl p-3.5">
                <AlertCircle className="w-4 h-4 shrink-0" />{loginError}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="w-full h-11 font-bold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
            >
              {loading
                ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Authenticating…</span>
                : <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Sign In</span>}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600">
          PixelStudio Platform · Restricted Access
        </p>
      </div>
    </div>
  );
}
