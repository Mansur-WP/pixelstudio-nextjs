"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCreateClient, PHOTO_FORMAT_API, ORDER_STATUS_API, PAY_STATUS_API } from "@/hooks/use-data";
import type { AppClient } from "@/hooks/use-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Check, FileText, UploadCloud, Copy, WifiOff, Printer } from "lucide-react";
import { putSyncEntry } from "@/lib/offline-db";
import { useSyncContext } from "@/hooks/use-sync-context";
import { AppLayout } from "@/components/layout";

const clientSchema = z.object({
  clientName:    z.string().min(2, "Name is required"),
  phone:         z.string().min(5, "Phone is required"),
  price:         z.coerce.number().min(1, "Price must be greater than 0"),
  deposit:       z.coerce.number().min(0, "Deposit cannot be negative").default(0),
  photoFormat:   z.enum(["Softcopy", "Hardcopy", "Both"]),
  paymentStatus: z.enum(["Paid", "Pending"]),
  orderStatus:   z.enum(["Pending", "Editing", "Ready", "Delivered"]),
  notes:         z.string().optional(),
}).refine(d => d.deposit <= d.price, { message: "Deposit cannot exceed the agreed price", path: ["deposit"] });

type ClientFormValues = z.infer<typeof clientSchema>;

async function saveOffline(values: ClientFormValues): Promise<AppClient> {
  const localId   = `local_${Date.now()}`;
  const createdAt = new Date().toISOString();
  const payload = {
    clientName:    values.clientName,
    phone:         values.phone,
    price:         values.price,
    deposit:       values.deposit ?? 0,
    photoFormat:   PHOTO_FORMAT_API[values.photoFormat] ?? "SOFTCOPY",
    orderStatus:   ORDER_STATUS_API[values.orderStatus]  ?? "PENDING",
    paymentStatus: PAY_STATUS_API[values.paymentStatus]  ?? "PENDING",
    notes:         values.notes || "",
  };
  const localClient: AppClient = {
    id: localId, clientName: values.clientName, phone: values.phone, price: values.price, deposit: values.deposit ?? 0,
    photoFormat: values.photoFormat, paymentStatus: values.paymentStatus, orderStatus: values.orderStatus,
    notes: values.notes || "", photos: [], photoCount: 0, invoiceId: "", galleryLink: "", date: createdAt,
    staffId: "", staffName: (typeof window !== "undefined" ? localStorage.getItem("user_name") : null) || "Staff Member",
  };
  await putSyncEntry({ id: localId, type: "createClient", payload, localData: localClient as unknown as Record<string, unknown>, status: "pending", createdAt: Date.now() });
  return localClient;
}

function NewClientContent() {
  const router = useRouter();
  const createClient = useCreateClient();
  const { toast }    = useToast();
  const { isOnline, refreshPendingCount } = useSyncContext();

  const [successData, setSuccessData]     = useState<AppClient | null>(null);
  const [isOfflineSave, setIsOfflineSave] = useState(false);
  const [copied, setCopied]               = useState(false);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: { clientName: "", phone: "", price: 0, deposit: 0, photoFormat: "Softcopy", paymentStatus: "Pending", orderStatus: "Pending", notes: "" },
  });

  const watchedPrice   = useWatch({ control: form.control, name: "price" });
  const watchedDeposit = useWatch({ control: form.control, name: "deposit" });
  const remaining = Math.max(0, (watchedPrice || 0) - (watchedDeposit || 0));

  const { setValue } = form;
  useEffect(() => {
    const price = watchedPrice || 0;
    const deposit = watchedDeposit || 0;
    setValue("paymentStatus", price > 0 && deposit >= price ? "Paid" : "Pending");
  }, [watchedPrice, watchedDeposit, setValue]);

  const onSubmit = async (values: ClientFormValues) => {
    if (!isOnline) {
      const localClient = await saveOffline(values);
      await refreshPendingCount();
      setIsOfflineSave(true);
      setSuccessData(localClient);
      toast({ title: "Saved offline", description: "This customer will sync automatically when you're back online." });
      return;
    }
    try {
      const result = await createClient.mutateAsync({ ...values, deposit: values.deposit ?? 0, notes: values.notes || "" });
      setIsOfflineSave(false);
      setSuccessData(result);
      toast({ title: "Customer record created!", description: "You can now upload photos for this customer." });
    } catch (err: unknown) {
      const isNetworkError = !navigator.onLine || (err instanceof TypeError && /fetch|network|failed/i.test(err.message)) || (err instanceof Error && /network|offline|ECONNREFUSED|ERR_NETWORK/i.test(err.message));
      if (isNetworkError) {
        const localClient = await saveOffline(values);
        await refreshPendingCount();
        setIsOfflineSave(true);
        setSuccessData(localClient);
        toast({ title: "Saved offline", description: "Connection unavailable. Record queued — will sync automatically." });
      } else {
        toast({ title: "Error", description: "Failed to create customer. Please try again.", variant: "destructive" });
      }
    }
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(window.location.origin + link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied!", description: "Gallery link copied to clipboard." });
  };

  const openOfflineInvoice = (client: AppClient) => {
    sessionStorage.setItem(`offline-invoice-${client.id}`, JSON.stringify(client));
    router.push(`/staff/clients/${client.id}/invoice`);
  };

  if (successData) {
    return (
      <div className="max-w-2xl mx-auto mt-10 animate-in zoom-in-95 duration-500">
        <Card className="border-0 shadow-xl overflow-hidden">
          <div className={`p-10 text-white flex flex-col items-center ${isOfflineSave ? "bg-gradient-to-br from-amber-400 to-amber-600" : "bg-gradient-to-br from-emerald-400 to-emerald-600"}`}>
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-5 border border-white/20">
              {isOfflineSave ? <WifiOff className="w-10 h-10" /> : <Check className="w-10 h-10" />}
            </div>
            <h2 className="text-3xl font-display font-bold">{isOfflineSave ? "Saved Offline" : "Customer Created!"}</h2>
            <p className={isOfflineSave ? "text-amber-50 mt-2 text-center" : "text-emerald-50 mt-2"}>
              {isOfflineSave ? "Record saved locally. It will sync to the server automatically when you reconnect." : "Record saved. Upload photos to activate the gallery."}
            </p>
          </div>
          <CardContent className="p-8 space-y-6 bg-white">
            <div className="grid grid-cols-2 gap-4 p-5 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Customer</p>
                <p className="font-bold text-xl text-slate-900">{successData.clientName}</p>
                <p className="text-sm text-slate-500 mt-0.5">{successData.phone}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Invoice ID</p>
                {isOfflineSave
                  ? <p className="text-sm text-amber-600 font-medium mt-1">⏳ Assigned after sync</p>
                  : <><p className="font-mono font-bold text-xl text-slate-900">{successData.invoiceId}</p><p className="text-sm text-slate-500 mt-0.5">₦{successData.price.toLocaleString()}</p></>}
              </div>
            </div>
            {isOfflineSave ? (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
                <WifiOff className="w-5 h-5 shrink-0" />
                <p>You are currently offline. This record is queued and will be uploaded automatically when your connection is restored.</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Gallery Link (available after upload)</p>
                <div className="flex gap-2">
                  <Input readOnly value={window.location.origin + successData.galleryLink} className="bg-slate-50 font-mono text-sm border-slate-200" />
                  <Button variant="secondary" onClick={() => copyLink(successData.galleryLink)} className="shrink-0 gap-2 w-28">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="bg-slate-50 border-t p-5 flex gap-3 flex-wrap">
            <Button variant="outline" className="flex-1 bg-white" asChild><Link href="/staff/clients">View All Customers</Link></Button>
            {isOfflineSave ? (
              <Button className="flex-1 gap-2 shadow-md bg-amber-600 hover:bg-amber-700" onClick={() => openOfflineInvoice(successData)}>
                <Printer className="w-4 h-4" /> Print Invoice
              </Button>
            ) : (
              <>
                <Button className="flex-1 gap-2 shadow-md" onClick={() => router.push(`/staff/clients/${successData.id}/upload`)}>
                  <UploadCloud className="w-4 h-4" /> Upload Photos Now
                </Button>
                <Button variant="ghost" className="gap-2" onClick={() => router.push(`/staff/clients/${successData.id}/invoice`)}>
                  <FileText className="w-4 h-4" /> Invoice
                </Button>
              </>
            )}
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">New Customer Record</h1>
        <p className="text-muted-foreground mt-1">Create a customer record first. Upload photos separately after the shoot is edited.</p>
        {!isOnline && (
          <div className="mt-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
            <WifiOff className="w-4 h-4 shrink-0" />
            You are offline. Records you create will be saved locally and synced when you reconnect.
          </div>
        )}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-border/40">
              <CardTitle className="font-display">Customer Information</CardTitle>
              <CardDescription>Basic contact and billing details.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField control={form.control} name="clientName" render={({ field }) => (<FormItem><FormLabel>Customer Full Name</FormLabel><FormControl><Input placeholder="Mansur Abdul" className="h-11" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="08023456789" className="h-11" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="price" render={({ field }) => (<FormItem><FormLabel>Agreed Price (₦)</FormLabel><FormControl><Input type="number" placeholder="1500" className="h-11" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="deposit" render={({ field }) => (
                <FormItem>
                  <FormLabel>Deposit Paid (₦) <span className="text-muted-foreground font-normal text-xs ml-1">optional</span></FormLabel>
                  <FormControl><Input type="number" placeholder="0" className="h-11" {...field} /></FormControl>
                  <FormMessage />
                  {(watchedPrice || 0) > 0 && (
                    <div className={`flex items-center justify-between rounded-md px-3 py-2 text-sm mt-1 ${remaining === 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                      <span className="font-medium">Remaining Balance</span>
                      <span className="font-bold">₦{remaining.toLocaleString()}</span>
                    </div>
                  )}
                </FormItem>
              )} />
              <FormField control={form.control} name="photoFormat" render={({ field }) => (
                <FormItem><FormLabel>Photo Format</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value="Softcopy">Softcopy (Digital)</SelectItem><SelectItem value="Hardcopy">Hardcopy (Print)</SelectItem><SelectItem value="Both">Both (Digital + Print)</SelectItem></SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="paymentStatus" render={({ field }) => (
                <FormItem><FormLabel>Payment Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Paid">Paid in Full</SelectItem></SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="orderStatus" render={({ field }) => (
                <FormItem><FormLabel>Order Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Editing">Editing</SelectItem><SelectItem value="Ready">Ready</SelectItem><SelectItem value="Delivered">Delivered</SelectItem></SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <div className="md:col-span-2">
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem><FormLabel>Notes (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="Enter your Img Number (It can be more than one)." className="resize-none min-h-[90px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" className="h-11 px-6" onClick={() => router.push("/staff/clients")}>Cancel</Button>
            <Button type="submit" size="lg" disabled={createClient.isPending} className="h-11 px-8 font-bold shadow-md">
              {createClient.isPending ? "Saving..." : isOnline ? "Save Customer Record" : "Save Offline"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

export default function NewClientPage() {
  return <AppLayout><NewClientContent /></AppLayout>;
}
