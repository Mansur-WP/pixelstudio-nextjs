"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Camera, ShieldCheck, UserCircle, CheckCircle, Eye, EyeOff,
  ImageIcon, AlertCircle, Mail, ArrowLeft, KeyRound, RefreshCw, Building2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  login as apiLogin,
  getToken,
  requestPasswordReset as apiRequestPasswordReset,
  verifyPasswordResetOtp as apiVerifyPasswordResetOtp,
  resetPassword as apiResetPassword,
  getStudioSlug,
} from "@/lib/api";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type Role = "admin" | "staff";
type ForgotStep = "email" | "otp" | "newpw";

export default function Login() {
  const router = useRouter();
  const { toast } = useToast();

  const [activeTab, setActiveTab]   = useState<Role>("admin");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [studioSlug, setStudioSlug] = useState(getStudioSlug() ?? "gbsm");
  const [showPw, setShowPw]         = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading]       = useState(false);

  const [forgotMode, setForgotMode]       = useState(false);
  const [forgotStep, setForgotStep]       = useState<ForgotStep>("email");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [otpInput, setOtpInput]           = useState("");
  const [otpPreview, setOtpPreview]       = useState("");
  const [resetToken, setResetToken]       = useState("");
  const [newPw, setNewPw]                 = useState("");
  const [confirmPw, setConfirmPw]         = useState("");
  const [showNewPw, setShowNewPw]         = useState(false);
  const [forgotError, setForgotError]     = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    const token = getToken();
    const role  = localStorage.getItem("role");
    if (token && role === "admin") router.push("/admin");
    if (token && role === "staff") router.push("/staff");
  }, [router]);

  const handleTabChange = (tab: Role) => {
    setActiveTab(tab);
    setEmail("");
    setPassword("");
    setLoginError("");
    setForgotMode(false);
    resetForgot();
  };

  const resetForgot = () => {
    setForgotStep("email");
    setRecoveryEmail("");
    setOtpInput("");
    setOtpPreview("");
    setResetToken("");
    setNewPw("");
    setConfirmPw("");
    setForgotError("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (!studioSlug.trim()) { setLoginError("Studio slug is required."); return; }
    setLoading(true);
    try {
      const { user } = await apiLogin(email.trim(), password, activeTab, studioSlug.trim().toLowerCase());
      localStorage.setItem("role",      user.role);
      localStorage.setItem("user_name", user.name);
      localStorage.setItem("user_id",   user.id);
      if (user.email) localStorage.setItem("user_email", user.email);
      toast({ title: "Login successful", description: `Welcome back, ${user.name}!` });
      if (user.role === "admin") router.push("/admin");
      else router.push("/staff");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed. Please try again.";
      setLoginError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    if (activeTab === "admin") {
      setEmail("admin@gbsm");
      setPassword("gbsm123");
      setStudioSlug("gbsm");
    } else {
      setEmail("staff@pixelstudio.com");
      setPassword("staff123");
      setStudioSlug("gbsm");
    }
    setLoginError("");
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    if (!studioSlug.trim()) { setForgotError("Studio slug is required."); return; }
    setForgotLoading(true);
    try {
      const result = await apiRequestPasswordReset(recoveryEmail.trim(), studioSlug.trim());
      setOtpPreview((result as any).previewCode ?? "");
      setForgotStep("otp");
      toast({ title: "Verification code sent", description: "Check your email or server logs for the code." });
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : "Could not send verification code.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotLoading(true);
    try {
      const result = await apiVerifyPasswordResetOtp(recoveryEmail.trim(), otpInput.trim(), studioSlug.trim());
      setResetToken(result.resetToken);
      setForgotStep("newpw");
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleNewPwSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    if (newPw.length < 6)     { setForgotError("Password must be at least 6 characters."); return; }
    if (newPw !== confirmPw)  { setForgotError("Passwords do not match."); return; }
    setForgotLoading(true);
    try {
      await apiResetPassword(recoveryEmail.trim(), resetToken, newPw, studioSlug.trim());
      toast({ title: "Password reset successfully!", description: "You can now sign in with your new password." });
      setForgotMode(false);
      resetForgot();
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : "Reset failed. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 relative bg-gradient-to-br from-indigo-950 via-slate-900 to-black items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent z-0" />
        <div className="absolute inset-0 opacity-20 mix-blend-overlay z-0" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=1600&auto=format&fit=crop)", backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="relative z-10 max-w-lg text-white">
          <div className="flex items-center gap-3 mb-10">
            <div className="bg-primary/20 p-3 rounded-2xl shadow-[0_0_30px_rgba(139,92,246,0.3)] border border-primary/30 backdrop-blur-sm">
              <Camera className="w-8 h-8 text-primary-foreground" />
            </div>
            <h4 className="text-4xl font-display font-bold tracking-tight">PixelStudio</h4>
          </div>
          <h2 className="text-5xl font-display font-bold leading-tight mb-8">From shoot to delivery.</h2>
          <div className="space-y-5 mb-12">
            {["Streamlined client galleries and instant delivery", "Automated invoicing and payment tracking", "Seamless staff and photographer coordination"].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-lg text-slate-300">
                <CheckCircle className="w-6 h-6 text-primary shrink-0" /><span>{feature}</span>
              </div>
            ))}
          </div>
          <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/30 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-700" />
            <div className="flex items-center gap-6 relative z-10">
              <div>
                <div className="text-4xl font-display font-bold text-white mb-1">Multi-tenant</div>
                <div className="text-sm font-medium text-slate-400 flex items-center gap-2"><ImageIcon className="w-4 h-4" />Each studio is fully isolated</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white relative">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-indigo-600 lg:hidden" />
        <div className="w-full max-w-md space-y-8">
          <div className="flex items-center justify-center gap-2 lg:hidden">
            <div className="bg-primary p-2 rounded-xl text-white"><Camera className="w-6 h-6" /></div>
            <h1 className="text-2xl font-display font-bold text-slate-900">PixelStudio</h1>
          </div>

          {!forgotMode ? (
            <>
              <div>
                <h2 className="text-4xl font-bold font-display tracking-tight text-slate-900">Sign in here</h2>
                <p className="text-slate-500 mt-2">Access your studio dashboard</p>
              </div>

              <div className="flex gap-1.5 p-1.5 bg-slate-100 rounded-xl">
                {([
                  { role: "admin" as Role, label: "Admin", icon: ShieldCheck },
                  { role: "staff" as Role, label: "Staff", icon: UserCircle  },
                ]).map(({ role, label, icon: Icon }) => (
                  <button key={role} type="button" onClick={() => handleTabChange(role)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${activeTab === role ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    <Icon className="w-3.5 h-3.5" />{label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="studio-slug" className="text-sm font-semibold text-slate-700">Studio Slug</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="studio-slug"
                      type="text"
                      placeholder="e.g. gbsm"
                      value={studioSlug}
                      onChange={(e) => { setStudioSlug(e.target.value); setLoginError(""); }}
                      className="h-12 text-base pl-10"
                      autoComplete="off"
                      required
                    />
                  </div>
                  <p className="text-xs text-slate-400">Your unique studio identifier (lowercase, no spaces).</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold text-slate-700">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="email"
                      type="text"
                      placeholder={activeTab === "admin" ? "admin@gbsm" : "staff@example.com"}
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setLoginError(""); }}
                      className="h-12 text-base pl-10"
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold text-slate-700">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPw ? "text" : "password"}
                      placeholder="........"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setLoginError(""); }}
                      className="h-12 text-base pr-12"
                      autoComplete="current-password"
                      required
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {activeTab === "admin" && (
                    <div className="flex justify-between items-center">
                      <button type="button" onClick={fillDemo} className="text-xs text-slate-400 hover:text-slate-600 underline">Fill demo</button>
                      <button type="button" onClick={() => setForgotMode(true)} className="text-xs font-semibold text-primary hover:underline mt-1">
                        Forgot password?
                      </button>
                    </div>
                  )}
                </div>

                {loginError && (
                  <div className="flex items-center gap-2.5 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />{loginError}
                  </div>
                )}
                <Button type="submit" size="lg" disabled={loading} className="w-full h-12 text-base font-bold shadow-md">
                  {loading ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Signing in...</span> : "Sign In"}
                </Button>
              </form>
            </>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => { setForgotMode(false); resetForgot(); }} className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-3xl font-bold font-display text-slate-900">
                    {forgotStep === "email" ? "Forgot Password" : forgotStep === "otp" ? "Enter OTP Code" : "Set New Password"}
                  </h2>
                  <p className="text-slate-500 text-sm mt-0.5">
                    {forgotStep === "email" ? "Enter your studio slug and recovery email" : forgotStep === "otp" ? "Enter the verification code we sent you" : "Choose a strong new password"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {(["email", "otp", "newpw"] as ForgotStep[]).map((step, i) => (
                  <div key={step} className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${forgotStep === step ? "bg-primary text-white shadow-md shadow-primary/30" : ["email", "otp", "newpw"].indexOf(forgotStep) > i ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"}`}>
                      {["email", "otp", "newpw"].indexOf(forgotStep) > i ? "✓" : i + 1}
                    </div>
                    {i < 2 && <div className={`flex-1 h-0.5 w-8 rounded ${["email", "otp", "newpw"].indexOf(forgotStep) > i ? "bg-emerald-400" : "bg-slate-200"}`} />}
                  </div>
                ))}
              </div>

              {forgotStep === "email" && (
                <form onSubmit={handleEmailSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700">Studio Slug</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input type="text" placeholder="e.g. gbsm" value={studioSlug} onChange={(e) => { setStudioSlug(e.target.value); setForgotError(""); }} className="h-12 pl-10 text-base" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700">Recovery Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input type="text" placeholder="admin@example.com" value={recoveryEmail} onChange={(e) => { setRecoveryEmail(e.target.value); setForgotError(""); }} className="h-12 pl-10 text-base" required />
                    </div>
                  </div>
                  {forgotError && <div className="flex items-center gap-2.5 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3.5"><AlertCircle className="w-4 h-4 shrink-0" />{forgotError}</div>}
                  <Button type="submit" size="lg" disabled={forgotLoading} className="w-full h-12 font-bold">
                    {forgotLoading ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending...</span> : <span className="flex items-center gap-2"><Mail className="w-4 h-4" />Send OTP Code</span>}
                  </Button>
                </form>
              )}

              {forgotStep === "otp" && (
                <form onSubmit={handleOtpSubmit} className="space-y-5">
                  {otpPreview ? (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2 text-indigo-700 font-semibold text-sm"><RefreshCw className="w-4 h-4" /> Local Preview Code</div>
                      <div className="text-center">
                        <span className="inline-block font-mono text-3xl font-bold tracking-[0.3em] text-indigo-700 bg-white border border-indigo-200 rounded-xl px-6 py-3 shadow-sm select-all">{otpPreview}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
                      A verification code was sent to <span className="font-semibold">{recoveryEmail}</span>.
                    </div>
                  )}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-slate-700">Enter OTP Code</Label>
                    <div className="flex justify-center">
                      <InputOTP maxLength={6} value={otpInput} onChange={(val) => { setOtpInput(val); setForgotError(""); }}>
                        <InputOTPGroup>
                          {[0, 1, 2, 3, 4, 5].map((i) => (
                            <InputOTPSlot key={i} index={i} className="w-12 h-12 text-xl font-bold font-mono" />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  </div>
                  {forgotError && <div className="flex items-center gap-2.5 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3.5"><AlertCircle className="w-4 h-4 shrink-0" />{forgotError}</div>}
                  <Button type="submit" size="lg" disabled={forgotLoading} className="w-full h-12 font-bold">
                    {forgotLoading ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Verifying...</span> : "Verify Code"}
                  </Button>
                </form>
              )}

              {forgotStep === "newpw" && (
                <form onSubmit={handleNewPwSubmit} className="space-y-5">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center gap-2.5 text-sm text-emerald-700 font-medium">
                    <CheckCircle className="w-4 h-4 shrink-0" /> Identity verified! Choose a new password for <span className="font-bold">{recoveryEmail}</span>.
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700">New Password</Label>
                    <div className="relative">
                      <Input type={showNewPw ? "text" : "password"} placeholder="Min 6 characters" value={newPw} onChange={(e) => { setNewPw(e.target.value); setForgotError(""); }} className="h-12 pr-12 text-base" required />
                      <button type="button" onClick={() => setShowNewPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showNewPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700">Confirm New Password</Label>
                    <Input type="password" placeholder="Repeat new password" value={confirmPw} onChange={(e) => { setConfirmPw(e.target.value); setForgotError(""); }} className="h-12 text-base" required />
                  </div>
                  {forgotError && <div className="flex items-center gap-2.5 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3.5"><AlertCircle className="w-4 h-4 shrink-0" />{forgotError}</div>}
                  <Button type="submit" size="lg" disabled={forgotLoading} className="w-full h-12 font-bold gap-2">
                    {forgotLoading
                      ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Resetting...</span>
                      : <span className="flex items-center gap-2"><KeyRound className="w-4 h-4" />Confirm Reset</span>}
                  </Button>
                </form>
              )}
            </div>
          )}

          <p className="text-center text-sm text-slate-400">
            © {new Date().getFullYear()} PixelStudio · by{" "}
            <a href="https://www.oralbits.com.ng" className="text-blue-500 hover:text-blue-700">Oralbits Technologies ltd.</a>
          </p>
        </div>
      </div>
    </div>
  );
}
