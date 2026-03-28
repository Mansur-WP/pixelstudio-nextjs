"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Eye, EyeOff, KeyRound, Mail, User, ShieldCheck, AlertCircle, CheckCircle2, Pencil, X, Trash2, ImageOff, Building2, Upload, Star, Crown, Clock, Copy, Check, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  changePassword, updateProfile, deleteAllPhotos,
  getMyStudio, updateMyStudio, uploadStudioLogo,
  getMyUpgradeInfo, submitUpgradeRequest,
  saveStudioInfo, getImageUrl,
  type StudioInfo, type UpgradeInfo,
} from "@/lib/api";
import { AppLayout } from "@/components/layout";

function LogoPreview({ currentUrl, pendingPreview }: { currentUrl: string | null; pendingPreview: string | null }) {
  const [imgError, setImgError] = useState(false);
  const src = pendingPreview ?? currentUrl;
  useEffect(() => { setImgError(false); }, [src]);
  return (
    <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-slate-50 shrink-0">
      {src && !imgError ? (
        <img src={src} alt="Studio logo" className="w-full h-full object-contain p-1" onError={() => setImgError(true)} />
      ) : (
        <Building2 className="w-8 h-8 text-slate-300" />
      )}
    </div>
  );
}

function AdminSettingsContent() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [storedName, setStoredName] = useState(typeof window !== "undefined" ? (localStorage.getItem("user_name") || "Admin") : "Admin");
  const storedEmail = typeof window !== "undefined" ? localStorage.getItem("user_email") || "" : "";

  const [studio, setStudio]                       = useState<StudioInfo | null>(null);
  const [studioNameInput, setStudioNameInput]     = useState("");
  const [studioSlugInput, setStudioSlugInput]     = useState("");
  const [studioPhoneInput, setStudioPhoneInput]   = useState("");
  const [studioAddressInput, setStudioAddressInput] = useState("");
  const [studioEmailInput, setStudioEmailInput]   = useState("");
  const [savingStudio, setSavingStudio]           = useState(false);
  const [studioUsage, setStudioUsage]         = useState<{ staffCount: number; clientCount: number; photoCount: number } | null>(null);
  const [studioLimits, setStudioLimits]       = useState<{ staff: number | null; clients: number | null; photos: number | null } | null>(null);
  const [uploadingLogo, setUploadingLogo]       = useState(false);
  const [pendingLogoFile, setPendingLogoFile]   = useState<File | null>(null);
  const [pendingLogoPreview, setPendingLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [upgradeInfo, setUpgradeInfo]               = useState<UpgradeInfo | null>(null);
  const [referenceInput, setReferenceInput]         = useState("");
  const [notesInput, setNotesInput]                 = useState("");
  const [submittingUpgrade, setSubmittingUpgrade]   = useState(false);
  const [copiedAccount, setCopiedAccount]           = useState(false);

  useEffect(() => {
    getMyStudio().then(({ studio: s, usage, limits }) => {
      setStudio(s);
      setStudioNameInput(s.name);
      setStudioSlugInput(s.slug);
      setStudioPhoneInput(s.phone ?? "");
      setStudioAddressInput(s.address ?? "");
      setStudioEmailInput(s.email ?? "");
      setStudioUsage(usage);
      setStudioLimits(limits);
      if (s.plan !== "pro") getMyUpgradeInfo().then(setUpgradeInfo).catch(() => {});
    }).catch(() => {});
  }, []);

  const handleSubmitUpgrade = async () => {
    if (!referenceInput.trim()) { toast({ title: "Reference required", description: "Enter the payment reference or receipt number.", variant: "destructive" }); return; }
    setSubmittingUpgrade(true);
    try {
      const req = await submitUpgradeRequest({ reference: referenceInput.trim(), notes: notesInput.trim() || undefined });
      setUpgradeInfo(prev => prev ? { ...prev, request: req } : prev);
      setReferenceInput(""); setNotesInput("");
      toast({ title: "Request submitted!", description: "The platform team will verify your payment and activate Pro shortly." });
    } catch (err: unknown) {
      toast({ title: "Submission failed", description: err instanceof Error ? err.message : "Could not submit.", variant: "destructive" });
    } finally { setSubmittingUpgrade(false); }
  };

  const copyAccountNumber = () => {
    if (!upgradeInfo?.accountNumber) return;
    navigator.clipboard.writeText(upgradeInfo.accountNumber);
    setCopiedAccount(true); setTimeout(() => setCopiedAccount(false), 2000);
  };

  const refreshUpgradeInfo = () => { getMyUpgradeInfo().then(setUpgradeInfo).catch(() => {}); };

  const handleStudioSave = async () => {
    if (!studio) return;
    const trimmedName = studioNameInput.trim();
    const trimmedSlug = studioSlugInput.trim().toLowerCase();
    if (!trimmedName) { toast({ title: "Name required", variant: "destructive" }); return; }
    if (!/^[a-z0-9-]{3,30}$/.test(trimmedSlug)) { toast({ title: "Invalid slug", description: "3–30 chars, lowercase letters, numbers and hyphens only.", variant: "destructive" }); return; }
    setSavingStudio(true);
    try {
      const updates: Parameters<typeof updateMyStudio>[0] = {};
      if (trimmedName !== studio.name) updates.name = trimmedName;
      if (trimmedSlug !== studio.slug) updates.slug = trimmedSlug;
      const trimmedPhone   = studioPhoneInput.trim();
      const trimmedAddress = studioAddressInput.trim();
      const trimmedEmail   = studioEmailInput.trim();
      if (trimmedPhone   !== (studio.phone   ?? "")) updates.phone   = trimmedPhone   || null;
      if (trimmedAddress !== (studio.address ?? "")) updates.address = trimmedAddress || null;
      if (trimmedEmail   !== (studio.email   ?? "")) updates.email   = trimmedEmail   || null;
      if (Object.keys(updates).length === 0) { toast({ title: "No changes" }); return; }
      const updated = await updateMyStudio(updates);
      setStudio(updated);
      setStudioNameInput(updated.name);
      setStudioSlugInput(updated.slug);
      setStudioPhoneInput(updated.phone ?? "");
      setStudioAddressInput(updated.address ?? "");
      setStudioEmailInput(updated.email ?? "");
      saveStudioInfo(updated);
      toast({ title: "Studio updated", description: "Your studio details have been saved." });
    } catch (err: unknown) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : "Could not save.", variant: "destructive" });
    } finally { setSavingStudio(false); }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingLogoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setPendingLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const cancelLogoPending = () => {
    setPendingLogoFile(null);
    setPendingLogoPreview(null);
  };

  const handleLogoUpload = async () => {
    if (!pendingLogoFile) return;
    setUploadingLogo(true);
    try {
      const { logoUrl } = await uploadStudioLogo(pendingLogoFile);
      setStudio(prev => {
        const updated = prev ? { ...prev, logoUrl } : prev;
        if (updated) saveStudioInfo(updated);
        return updated;
      });
      setPendingLogoFile(null);
      setPendingLogoPreview(null);
      toast({ title: "Logo updated", description: "Your studio logo has been uploaded." });
    } catch (err: unknown) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Could not upload logo.", variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  };

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput]     = useState("");
  const [savingName, setSavingName]   = useState(false);

  const openNameEdit = () => { setNameInput(storedName); setEditingName(true); };
  const cancelNameEdit = () => setEditingName(false);

  const handleNameSave = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) { toast({ title: "Name required", description: "Please enter a display name.", variant: "destructive" }); return; }
    setSavingName(true);
    try {
      await updateProfile(trimmed);
      localStorage.setItem("user_name", trimmed);
      setStoredName(trimmed);
      setEditingName(false);
      toast({ title: "Name updated", description: `Your display name is now "${trimmed}".` });
    } catch (err: unknown) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : "Could not update name.", variant: "destructive" });
    } finally { setSavingName(false); }
  };

  const [currentPw, setCurrentPw]     = useState("");
  const [newPw, setNewPw]             = useState("");
  const [confirmPw, setConfirmPw]     = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPw, setSavingPw]       = useState(false);
  const [pwMsg, setPwMsg]             = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault(); setPwMsg(null);
    if (!currentPw.trim()) { setPwMsg({ type: "error", text: "Current password is required." }); return; }
    if (newPw.length < 6)  { setPwMsg({ type: "error", text: "New password must be at least 6 characters." }); return; }
    if (newPw !== confirmPw) { setPwMsg({ type: "error", text: "Passwords do not match." }); return; }
    if (newPw === currentPw) { setPwMsg({ type: "error", text: "New password must be different from the current one." }); return; }
    setSavingPw(true);
    try {
      await changePassword(currentPw, newPw);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setPwMsg({ type: "success", text: "Password changed successfully. Use the new password on your next login." });
      toast({ title: "Password updated", description: "Your new password is now active." });
    } catch (err: unknown) {
      setPwMsg({ type: "error", text: err instanceof Error ? err.message : "Failed to change password." });
    } finally { setSavingPw(false); }
  };

  const [deletingPhotos, setDeletingPhotos] = useState(false);

  const handleDeleteAllPhotos = async () => {
    setDeletingPhotos(true);
    try {
      const result = await deleteAllPhotos();
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "admin"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "staff"] });
      qc.invalidateQueries({ queryKey: ["activity"] });
      toast({ title: "Photos deleted", description: `${result.deletedCount} photo record(s) and ${result.filesRemoved} file(s) have been permanently removed.` });
    } catch (err: unknown) {
      toast({ title: "Delete failed", description: err instanceof Error ? err.message : "Could not delete photos.", variant: "destructive" });
    } finally { setDeletingPhotos(false); }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your admin profile, password, and studio data.</p>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center"><User className="w-5 h-5" /></div>
            <div><CardTitle className="text-lg font-semibold">Admin Profile</CardTitle><CardDescription>Update your display name shown across the system.</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 text-primary flex items-center justify-center text-2xl font-bold border border-primary/10 shadow-sm">
              {storedName.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <Input value={nameInput} onChange={e => setNameInput(e.target.value)} className="h-9 text-sm max-w-xs" placeholder="Your display name" autoFocus
                    onKeyDown={e => { if (e.key === "Enter") handleNameSave(); if (e.key === "Escape") cancelNameEdit(); }} />
                  <Button size="sm" onClick={handleNameSave} disabled={savingName} className="h-9 px-3">{savingName ? "Saving…" : "Save"}</Button>
                  <Button size="sm" variant="ghost" onClick={cancelNameEdit} disabled={savingName} className="h-9 px-2"><X className="w-4 h-4" /></Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground text-lg truncate">{storedName}</p>
                  <button onClick={openNameEdit} className="text-muted-foreground hover:text-foreground transition-colors shrink-0" title="Edit display name">
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              )}
              {storedEmail && <p className="text-sm text-muted-foreground font-mono flex items-center gap-1.5 mt-1"><Mail className="w-3.5 h-3.5" /> {storedEmail}</p>}
            </div>
          </div>
          <div className="bg-slate-50 border border-border/50 rounded-xl p-4 text-sm text-muted-foreground flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span>Your email address cannot be changed here. Contact a system administrator to update your login email.</span>
          </div>
        </CardContent>
      </Card>

      {studio && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center"><Building2 className="w-5 h-5" /></div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg font-semibold">Studio Branding</CardTitle>
                  <Badge variant={studio.plan === "pro" ? "default" : "secondary"} className="text-xs capitalize">
                    {studio.plan === "pro" ? <><Star className="w-3 h-3 mr-1" />Pro</> : "Free"}
                  </Badge>
                </div>
                <CardDescription>Customize your studio name, slug, and logo.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Studio Logo</Label>
              <div className="flex items-start gap-4">
                <LogoPreview
                  currentUrl={studio.logoUrl ? getImageUrl(studio.logoUrl) : null}
                  pendingPreview={pendingLogoPreview}
                />
                <div className="space-y-2 flex-1">
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                  {pendingLogoPreview ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">{pendingLogoFile?.name}</p>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleLogoUpload} disabled={uploadingLogo} className="gap-2">
                          <Upload className="w-4 h-4" />{uploadingLogo ? "Uploading…" : "Confirm Upload"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelLogoPending} disabled={uploadingLogo} className="gap-2">
                          <X className="w-4 h-4" />Cancel
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Review the preview above, then click Confirm Upload.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Button size="sm" variant="outline" onClick={() => logoInputRef.current?.click()} className="gap-2">
                        <Upload className="w-4 h-4" />{studio.logoUrl ? "Change Logo" : "Upload Logo"}
                      </Button>
                      <p className="text-xs text-muted-foreground">PNG, JPG or WebP, up to 2 MB.</p>
                      {studio.logoUrl && <p className="text-xs text-emerald-600 font-medium">✓ Logo is set</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-2"><Label className="text-sm font-semibold">Studio Name</Label><Input value={studioNameInput} onChange={e => setStudioNameInput(e.target.value)} placeholder="My Photography Studio" className="h-11" /></div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Studio Slug (login URL)</Label>
              <Input value={studioSlugInput} onChange={e => setStudioSlugInput(e.target.value.toLowerCase())} placeholder="my-studio" className="h-11 font-mono" />
              <p className="text-xs text-muted-foreground">Used as the login identifier. <span className="font-mono font-medium">{studioSlugInput || "my-studio"}</span></p>
            </div>

            <div className="pt-1 border-t border-border/40">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Invoice Details</p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Studio Phone Number(s)</Label>
                  <Input value={studioPhoneInput} onChange={e => setStudioPhoneInput(e.target.value)} placeholder="e.g. 08012345678, 08087654321" className="h-11" />
                  <p className="text-xs text-muted-foreground">Shown on every invoice. Separate multiple numbers with a comma.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Studio Address</Label>
                  <Input value={studioAddressInput} onChange={e => setStudioAddressInput(e.target.value)} placeholder="e.g. No 1, Main Street, Lagos" className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Studio Email</Label>
                  <Input type="email" value={studioEmailInput} onChange={e => setStudioEmailInput(e.target.value)} placeholder="e.g. hello@mystudio.com" className="h-11" />
                </div>
              </div>
            </div>

            {studioUsage && studioLimits && (
              <div className="bg-slate-50 border border-border/50 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">Plan Usage</p>
                {([
                  { label: "Staff members", used: studioUsage.staffCount,  limit: studioLimits.staff },
                  { label: "Clients",       used: studioUsage.clientCount, limit: studioLimits.clients },
                  { label: "Photos",        used: studioUsage.photoCount,  limit: studioLimits.photos },
                ] as { label: string; used: number; limit: number | null }[]).map(({ label, used, limit }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>{label}</span><span>{used}{limit ? ` / ${limit}` : " (unlimited)"}</span></div>
                    {limit && <div className="w-full bg-slate-200 rounded-full h-1.5"><div className={`h-1.5 rounded-full transition-all ${used / limit > 0.85 ? "bg-rose-500" : "bg-primary"}`} style={{ width: `${Math.min((used / limit) * 100, 100)}%` }} /></div>}
                  </div>
                ))}
              </div>
            )}
            <Button onClick={handleStudioSave} disabled={savingStudio} className="gap-2">
              {savingStudio ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</span> : <><Building2 className="w-4 h-4" />Save Studio Settings</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {studio && studio.plan !== "pro" && upgradeInfo && (
        <Card className="border-amber-200 shadow-sm bg-gradient-to-br from-amber-50/60 to-orange-50/30">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center"><Crown className="w-5 h-5" /></div>
              <div className="flex-1"><CardTitle className="text-lg font-semibold">Upgrade to Pro</CardTitle><CardDescription>Remove all limits — unlimited staff, clients, and photos.</CardDescription></div>
              <Button variant="ghost" size="sm" onClick={refreshUpgradeInfo} className="text-muted-foreground"><RefreshCw className="w-4 h-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[{ label: "Staff", free: "3", pro: "Unlimited" }, { label: "Clients", free: "50", pro: "Unlimited" }, { label: "Photos", free: "200", pro: "Unlimited" }].map(({ label, free, pro }) => (
                <div key={label} className="bg-white rounded-xl border border-amber-100 p-3 shadow-sm">
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className="text-xs line-through text-muted-foreground">{free}</p>
                  <p className="text-sm font-bold text-amber-600">{pro}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between bg-white border border-amber-200 rounded-xl px-4 py-3 shadow-sm">
              <span className="text-sm font-medium text-foreground">Pro Plan (one-time)</span>
              <span className="text-lg font-bold text-amber-600">₦{Number(upgradeInfo.proPlanPrice).toLocaleString()}</span>
            </div>
            {upgradeInfo.request?.status === "pending" && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm"><Clock className="w-4 h-4" />Payment Under Review</div>
                <p className="text-xs text-blue-600">Your payment reference <span className="font-mono font-bold">{upgradeInfo.request.reference}</span> was submitted on {new Date(upgradeInfo.request.createdAt).toLocaleDateString()}. The platform team will confirm it shortly.</p>
                <p className="text-xs text-muted-foreground">Once confirmed, reload this page to see your Pro status activated.</p>
              </div>
            )}
            {upgradeInfo.request?.status === "rejected" && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Your previous request was rejected. Please recheck the payment reference and try again below.</span>
              </div>
            )}
            {(!upgradeInfo.request || upgradeInfo.request.status === "rejected") && (
              <div className="space-y-4">
                {(upgradeInfo.bankName || upgradeInfo.accountNumber) && (
                  <div className="bg-white border border-amber-100 rounded-xl p-4 space-y-3 shadow-sm">
                    <p className="text-sm font-semibold text-foreground">Payment Details</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><p className="text-xs text-muted-foreground mb-0.5">Bank</p><p className="font-medium">{upgradeInfo.bankName}</p></div>
                      <div><p className="text-xs text-muted-foreground mb-0.5">Account Name</p><p className="font-medium">{upgradeInfo.accountName}</p></div>
                    </div>
                    <div className="flex items-center gap-2 justify-between bg-slate-50 rounded-lg px-3 py-2 border border-border/60">
                      <span className="font-mono font-semibold text-sm tracking-wider">{upgradeInfo.accountNumber}</span>
                      <Button variant="ghost" size="sm" onClick={copyAccountNumber} className="h-7 px-2 text-muted-foreground hover:text-foreground">
                        {copiedAccount ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Transfer exactly ₦{Number(upgradeInfo.proPlanPrice).toLocaleString()} to the account above, then submit your payment reference below.</p>
                  </div>
                )}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold">Payment Reference / Receipt No.</Label>
                    <Input value={referenceInput} onChange={e => setReferenceInput(e.target.value)} placeholder="e.g. TRX2025031200123456" className="h-11 font-mono" />
                    <p className="text-xs text-muted-foreground">Copy the transaction reference from your bank app or receipt.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold">Additional Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Textarea value={notesInput} onChange={e => setNotesInput(e.target.value)} placeholder="Any other info for the platform team…" className="resize-none h-20 text-sm" />
                  </div>
                  <Button onClick={handleSubmitUpgrade} disabled={submittingUpgrade || !referenceInput.trim()} className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white">
                    {submittingUpgrade ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Submitting…</> : <><Crown className="w-4 h-4" />Submit Payment for Verification</>}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center"><KeyRound className="w-5 h-5" /></div>
            <div><CardTitle className="text-lg font-semibold">Change Password</CardTitle><CardDescription>Update your admin login password. You must know your current password to change it.</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSave} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Current Password</Label>
              <div className="relative">
                <Input type={showCurrent ? "text" : "password"} placeholder="Your current password" value={currentPw} onChange={e => { setCurrentPw(e.target.value); setPwMsg(null); }} className="h-11 pr-11" required />
                <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">New Password</Label>
                <div className="relative">
                  <Input type={showNew ? "text" : "password"} placeholder="Min 6 characters" value={newPw} onChange={e => { setNewPw(e.target.value); setPwMsg(null); }} className="h-11 pr-11" required />
                  <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Confirm New Password</Label>
                <div className="relative">
                  <Input type={showConfirm ? "text" : "password"} placeholder="Repeat password" value={confirmPw} onChange={e => { setConfirmPw(e.target.value); setPwMsg(null); }} className="h-11 pr-11" required />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
              </div>
            </div>
            {newPw && (
              <div className="flex gap-1.5 items-center">
                {[1, 2, 3, 4].map(i => <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${newPw.length >= i * 3 ? i <= 1 ? "bg-rose-400" : i <= 2 ? "bg-amber-400" : i <= 3 ? "bg-blue-400" : "bg-emerald-500" : "bg-slate-200"}`} />)}
                <span className="text-xs text-muted-foreground ml-1 shrink-0">{newPw.length < 6 ? "Too short" : newPw.length < 9 ? "Fair" : newPw.length < 12 ? "Good" : "Strong"}</span>
              </div>
            )}
            {pwMsg && (
              <div className={`flex items-center gap-2.5 text-sm rounded-xl p-3.5 border ${pwMsg.type === "success" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-rose-600 bg-rose-50 border-rose-200"}`}>
                {pwMsg.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {pwMsg.text}
              </div>
            )}
            <Button type="submit" disabled={savingPw} className="gap-2 bg-amber-500 hover:bg-amber-600 text-white shadow-sm">
              {savingPw ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</span> : <><KeyRound className="w-4 h-4" />Change Password</>}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-red-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center"><ImageOff className="w-5 h-5" /></div>
            <div><CardTitle className="text-lg font-semibold text-red-700">Delete All Uploaded Photos</CardTitle><CardDescription>Permanently remove every photo file and record from the system.</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-2.5 mb-5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>This will permanently delete <strong>every uploaded photo</strong> across all clients — including the physical files stored on the server. Client gallery links will stop working. <strong>This cannot be undone.</strong></span>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700" disabled={deletingPhotos}>
                <Trash2 className="w-4 h-4" />{deletingPhotos ? "Deleting…" : "Delete All Photos"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete all uploaded photos?</AlertDialogTitle>
                <AlertDialogDescription>Every photo file across all client records will be permanently deleted from the server. Gallery links will stop working. This action <strong>cannot be undone</strong>.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeleteAllPhotos}>Yes, Delete All Photos</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm bg-slate-50/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><ShieldCheck className="w-4 h-4" /></div>
            <div>
              <p className="text-sm font-semibold text-foreground">Security tip</p>
              <p className="text-sm text-muted-foreground mt-0.5">Use a strong, unique password that you do not use on other websites. Staff members have separate accounts — do not share your admin credentials with anyone.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminSettingsPage() {
  return <AppLayout><AdminSettingsContent /></AppLayout>;
}
