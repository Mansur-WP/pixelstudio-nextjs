"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useClient, useUpdateClient, useDeleteClient } from "@/hooks/use-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, UploadCloud, FileText, Copy, Check, Camera, Image as ImageIcon, Phone, DollarSign, Calendar, Trash2, Pencil, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout";

function ClientDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const { data: client, isLoading } = useClient(id);
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  const { toast } = useToast();
  const [copied, setCopied]               = useState(false);
  const [editingDeposit, setEditingDeposit] = useState(false);
  const [depositInput, setDepositInput]     = useState("");
  const isAdmin = typeof window !== "undefined" && localStorage.getItem("role") === "admin";

  const handleDelete = async () => {
    if (!client) return;
    try {
      await deleteClient.mutateAsync(client.id);
      toast({ title: "Client deleted", description: `${client.clientName} and all their data have been permanently removed.` });
      router.push("/staff/clients");
    } catch {
      toast({ title: "Delete failed", description: "Could not delete client. Please try again.", variant: "destructive" });
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.origin + client!.galleryLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied!", description: "Gallery link copied to clipboard." });
  };

  const handleOrderStatusChange = async (value: string) => {
    await updateClient.mutateAsync({ id: client!.id, orderStatus: value as any });
    toast({ title: "Updated", description: `Order status set to ${value}` });
  };

  const openDepositEdit = () => { setDepositInput(String(client!.deposit ?? 0)); setEditingDeposit(true); };
  const cancelDepositEdit = () => { setEditingDeposit(false); setDepositInput(""); };

  const saveDeposit = async () => {
    const newDeposit = parseFloat(depositInput);
    if (isNaN(newDeposit) || newDeposit < 0) { toast({ title: "Invalid amount", description: "Please enter a valid deposit amount.", variant: "destructive" }); return; }
    if (newDeposit > client!.price) { toast({ title: "Invalid amount", description: "Deposit cannot exceed the agreed price.", variant: "destructive" }); return; }
    await updateClient.mutateAsync({ id: client!.id, deposit: newDeposit });
    setEditingDeposit(false); setDepositInput("");
    const fullyPaid = newDeposit >= client!.price;
    toast({ title: fullyPaid ? "Marked as Paid" : "Deposit updated", description: fullyPaid ? `Payment status set to Paid for ${client!.clientName}.` : `Deposit updated. Remaining balance: ₦${(client!.price - newDeposit).toLocaleString()}.` });
  };

  if (isLoading) {
    return <div className="max-w-4xl mx-auto space-y-6 animate-pulse">{[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-100 rounded-2xl" />)}</div>;
  }

  if (!client) {
    return (
      <div className="text-center py-24">
        <Camera className="w-12 h-12 mx-auto text-slate-300 mb-4" />
        <h2 className="text-xl font-bold">Client not found</h2>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/staff/clients")}>Back to Records</Button>
      </div>
    );
  }

  const hasPhotos  = client.photos.length > 0;
  const deposit    = client.deposit ?? 0;
  const remaining  = Math.max(0, client.price - deposit);
  const hasDeposit = deposit > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/staff/clients")} className="rounded-full border border-border/50">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">{client.clientName}</h1>
            <p className="text-muted-foreground text-sm mt-0.5 font-mono">{client.invoiceId}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="gap-2 bg-white shadow-sm" asChild>
            <Link href={`/staff/clients/${client.id}/invoice`}><FileText className="w-4 h-4" /> Invoice</Link>
          </Button>
          <Button className="gap-2 shadow-md" asChild>
            <Link href={`/staff/clients/${client.id}/upload`}><UploadCloud className="w-4 h-4" /> Upload Photos</Link>
          </Button>
          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="gap-2 bg-white shadow-sm border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
                  <Trash2 className="w-4 h-4" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {client.clientName}?</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently delete this client record, all {client.photos.length} uploaded photo(s), their gallery, invoices, and payment records. This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete}>Delete Permanently</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Phone",           value: client.phone, icon: Phone },
          { label: "Agreed Price",    value: `₦${client.price.toLocaleString()}`, icon: DollarSign },
          { label: "Date Created",    value: new Date(client.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }), icon: Calendar },
          { label: "Photos Uploaded", value: `${client.photos.length} photos`, icon: ImageIcon },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="border-border/40 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1.5"><Icon className="w-4 h-4" /><span className="text-xs font-medium uppercase tracking-wider">{label}</span></div>
              <p className="font-semibold text-foreground">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {hasDeposit && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-3 rounded-md border border-border/40 bg-slate-50/60 px-4 py-2.5 text-sm flex-1 min-w-[180px]">
            <span className="text-muted-foreground font-medium">Deposit Paid</span>
            <span className="ml-auto font-semibold text-foreground">₦{deposit.toLocaleString()}</span>
          </div>
          <div className={`flex items-center gap-3 rounded-md border px-4 py-2.5 text-sm flex-1 min-w-[180px] ${remaining === 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
            <span className="font-medium">Remaining Balance</span>
            <span className="ml-auto font-bold">₦{remaining.toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-border/40 shadow-sm lg:col-span-1">
          <CardHeader className="pb-3 border-b border-border/40 bg-slate-50/50">
            <CardTitle className="text-base font-semibold">Status & Details</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Payment Status</p>
              <StatusBadge status={client.paymentStatus} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {client.paymentStatus === "Paid" ? "Amount Paid" : "Deposit / Balance"}
                </p>
                {!editingDeposit && client.paymentStatus !== "Paid" && (
                  <button onClick={openDepositEdit} className="text-muted-foreground hover:text-foreground transition-colors" title="Edit deposit">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {editingDeposit ? (
                <div className="space-y-2">
                  <Input type="number" min={0} max={client.price} value={depositInput} onChange={e => setDepositInput(e.target.value)} className="h-9 text-sm" placeholder="Enter amount paid" autoFocus />
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-8 text-xs" disabled={updateClient.isPending} onClick={saveDeposit}>{updateClient.isPending ? "Saving…" : "Save"}</Button>
                    <Button size="sm" variant="ghost" className="h-8 px-2" onClick={cancelDepositEdit} disabled={updateClient.isPending}><X className="w-3.5 h-3.5" /></Button>
                  </div>
                  {client.price > 0 && <button className="w-full text-xs text-primary hover:underline text-left" onClick={() => setDepositInput(String(client.price))}>Set to full price (₦{client.price.toLocaleString()})</button>}
                </div>
              ) : (
                <div className="text-sm font-medium text-foreground">
                  ₦{(client.deposit ?? 0).toLocaleString()}
                  {client.paymentStatus !== "Paid" && remaining > 0 && <span className="ml-2 text-xs text-amber-600 font-normal">₦{remaining.toLocaleString()} remaining</span>}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Photo Format</p>
              <StatusBadge status={client.photoFormat} />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Order Status</p>
              <Select defaultValue={client.orderStatus} onValueChange={handleOrderStatusChange}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Editing">Editing</SelectItem>
                  <SelectItem value="Ready">Ready</SelectItem>
                  <SelectItem value="Delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Staff</p>
              <p className="text-sm font-medium text-foreground">{client.staffName}</p>
            </div>
            {client.notes && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</p>
                <p className="text-sm text-foreground leading-relaxed">{client.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/40 shadow-sm lg:col-span-2">
          <CardHeader className="pb-3 border-b border-border/40 bg-slate-50/50 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Photo Gallery</CardTitle>
            {hasPhotos && (
              <Button variant="ghost" size="sm" onClick={copyLink} className="gap-1.5 text-primary hover:text-primary hover:bg-primary/10">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy Link"}
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-5">
            {!hasPhotos ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4"><UploadCloud className="w-8 h-8 text-slate-400" /></div>
                <h3 className="font-semibold text-foreground mb-1">No photos uploaded yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Upload edited photos to generate the client gallery link.</p>
                <Button asChild className="gap-2 shadow-sm"><Link href={`/staff/clients/${client.id}/upload`}><UploadCloud className="w-4 h-4" /> Upload Photos Now</Link></Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{client.photos.length} photos uploaded</span>
                  <Button variant="outline" size="sm" asChild className="gap-1.5 h-8 text-xs"><Link href={`/staff/clients/${client.id}/upload`}><UploadCloud className="w-3.5 h-3.5" /> Add More</Link></Button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {client.photos.slice(0, 8).map((url, i) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden border border-border/40 shadow-sm">
                      <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ))}
                  {client.photos.length > 8 && <div className="aspect-square rounded-xl bg-slate-100 border border-border/40 flex items-center justify-center"><span className="text-sm font-semibold text-slate-500">+{client.photos.length - 8}</span></div>}
                </div>
                <div className="pt-2 flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-border/40 text-sm">
                  <span className="text-muted-foreground truncate flex-1 font-mono text-xs">{typeof window !== "undefined" ? window.location.origin : ""}{client.galleryLink}</span>
                  <Button size="sm" variant="outline" onClick={copyLink} className="shrink-0 h-8 gap-1.5 text-xs bg-white">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                  <Button size="sm" onClick={() => window.open(client.galleryLink, '_blank')} className="shrink-0 h-8 text-xs">View Gallery</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AppLayout><ClientDetailContent id={id} /></AppLayout>;
}
