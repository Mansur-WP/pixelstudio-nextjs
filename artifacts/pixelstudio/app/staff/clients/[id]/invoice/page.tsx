"use client";

import { useState, use, useEffect } from "react";
import { useClient } from "@/hooks/use-data";
import type { AppClient } from "@/hooks/use-data";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Download, Camera, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GalleryQrCode } from "@/components/gallery-qr-code";
import { AppLayout } from "@/components/layout";
import { getMyStudio, getImageUrl, type StudioInfo } from "@/lib/api";

function useOfflineClient(id: string): AppClient | null {
  const [client] = useState<AppClient | null>(() => {
    if (typeof window === "undefined") return null;
    if (!id.startsWith("local_")) return null;
    const raw = sessionStorage.getItem(`offline-invoice-${id}`);
    if (!raw) return null;
    try { return JSON.parse(raw) as AppClient; } catch { return null; }
  });
  return client;
}

function InvoiceContent({ id }: { id: string }) {
  const isLocalClient = id.startsWith("local_");
  const { data: apiClient, isLoading } = useClient(isLocalClient ? "" : id);
  const offlineClient = useOfflineClient(id);
  const client: AppClient | undefined = isLocalClient ? (offlineClient ?? undefined) : apiClient;
  const { toast } = useToast();

  const [studio, setStudio] = useState<StudioInfo | null>(null);

  useEffect(() => {
    getMyStudio().then(({ studio: s }) => setStudio(s)).catch(() => {});
  }, []);

  const invoiceLabel = isLocalClient ? `DRAFT-${id.replace("local_", "").slice(-6)}` : (client?.invoiceId || "—");

  if (!isLocalClient && isLoading) {
    return <div className="p-12 text-center text-muted-foreground animate-pulse">Loading Receipt…</div>;
  }

  if (!client) {
    return <div className="p-12 text-center font-semibold">Receipt not found.</div>;
  }

  const studioName    = studio?.name    ?? "Photography Studio";
  const studioPhone   = studio?.phone   ?? null;
  const studioAddress = studio?.address ?? null;
  const studioEmail   = studio?.email   ?? null;
  const studioLogo    = studio?.logoUrl ? getImageUrl(studio.logoUrl) : null;

  return (
    <div className="min-h-screen bg-slate-100/80 py-10 px-4 font-sans print:bg-white print:py-0">
      <div className="max-w-3xl mx-auto space-y-5">
        {isLocalClient && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 text-amber-700 text-sm print:hidden">
            <WifiOff className="w-4 h-4 shrink-0" />
            <p><span className="font-bold">Offline draft Receipt.</span>{" "}The Receipt number is temporary and will be replaced once this record syncs.</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 print:hidden gap-3">
          <Button variant="ghost" onClick={() => window.history.back()} className="gap-2 font-semibold text-slate-600">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <div className="flex gap-3">
            {!isLocalClient && (
              <Button variant="outline" onClick={() => toast({ title: "Downloading…", description: "PDF is being generated." })} className="gap-2 bg-white font-semibold">
                <Download className="w-4 h-4" /> Download PDF
              </Button>
            )}
            <Button onClick={() => window.print()} className="gap-2 font-semibold shadow-md">
              <Printer className="w-4 h-4" /> Print Receipt
            </Button>
          </div>
        </div>

        <Card className="border-0 shadow-xl print:shadow-none rounded-none sm:rounded-2xl overflow-hidden bg-white">
          <div className={`h-2.5 w-full print:bg-violet-600 ${isLocalClient ? "bg-gradient-to-r from-amber-500 to-amber-400" : "bg-gradient-to-r from-violet-600 to-indigo-600"}`} />

          <CardContent className="p-10 sm:p-16">
            <div className="flex justify-between items-start border-b-2 border-slate-100 pb-10 mb-10">
              <div>
                <div className="flex items-center gap-2.5 font-display text-2xl font-bold text-slate-900 mb-4">
                  {studioLogo
                    ? <img src={studioLogo} alt={studioName} className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                    : <div className="bg-primary p-2 rounded-lg"><Camera className="w-5 h-5 text-white" /></div>}
                  {studioName}
                </div>
                <div className="space-y-1 text-slate-500 text-sm">
                  {studioAddress && <p>{studioAddress}</p>}
                  {studioEmail   && <p className="font-medium text-slate-400">{studioEmail}</p>}
                  {studioPhone   && <p className="font-semibold text-slate-600">{studioPhone}</p>}
                </div>
              </div>
              <div className="text-right">
                <h1 className="text-5xl font-display font-bold text-slate-200 tracking-widest mb-3">{isLocalClient ? "DRAFT" : "INVOICE"}</h1>
                <p className="font-mono text-sm font-bold text-slate-700">{invoiceLabel}</p>
                <p className="text-slate-500 text-sm mt-1">Issued: {new Date(client.date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>
                {isLocalClient && <p className="text-xs text-amber-600 font-medium mt-1 hidden print:block">⚠ Pending sync — final invoice number to follow</p>}
              </div>
            </div>

            <div className="flex justify-between items-end mb-12 bg-slate-50 rounded-xl p-6 border border-slate-100">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Billed To</p>
                <p className="font-bold text-xl text-slate-900">{client.clientName}</p>
                <p className="text-slate-500 font-medium mt-0.5">{client.phone}</p>
              </div>
              <div className="text-right space-y-1.5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payment Status</p>
                <div className={`font-bold inline-block px-4 py-1.5 rounded-lg text-sm border ${client.paymentStatus === "Paid" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                  {client.paymentStatus.toUpperCase()}
                </div>
              </div>
            </div>

            <table className="w-full mb-10">
              <thead>
                <tr className="border-b-2 border-slate-200 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="text-left py-3 font-bold">Description</th>
                  <th className="text-center py-3 font-bold">Format</th>
                  <th className="text-center py-3 font-bold">Order Status</th>
                  <th className="text-right py-3 font-bold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-6 pr-4">
                    <p className="font-bold text-slate-800 text-base">Photography Services</p>
                    <p className="text-sm text-slate-400 mt-0.5">Photographer: {client.staffName}</p>
                    {client.notes && <p className="text-sm text-slate-500 mt-1 max-w-xs italic">{client.notes}</p>}
                  </td>
                  <td className="py-6 text-center"><span className="inline-block bg-slate-100 text-slate-600 px-3 py-1 rounded-md text-sm font-medium">{client.photoFormat}</span></td>
                  <td className="py-6 text-center">
                    <span className={`inline-block px-3 py-1 rounded-md text-sm font-medium border ${client.orderStatus === "Delivered" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : client.orderStatus === "Ready" ? "bg-violet-50 text-violet-700 border-violet-200" : client.orderStatus === "Editing" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                      {client.orderStatus}
                    </span>
                  </td>
                  <td className="py-6 text-right font-bold text-xl text-slate-900">₦{client.price.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <div className="flex flex-col sm:flex-row justify-between items-start gap-10">
              {isLocalClient
                ? <GalleryQrCode galleryLink="mailto:hello@pixelstudio.ng" size={160} label="Contact Studio" description="Gallery link will be sent once your record syncs to our server." />
                : client.galleryLink ? <GalleryQrCode galleryLink={client.galleryLink} size={160} /> : null}
              <div className="w-full sm:w-72 space-y-3.5 bg-slate-50 p-6 rounded-xl border border-slate-100 ml-auto">
                <div className="flex justify-between text-sm text-slate-500"><span>Subtotal</span><span className="text-slate-700 font-medium">₦{client.price.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm text-slate-500"><span>Tax (0%)</span><span className="text-slate-700 font-medium">₦0.00</span></div>
                <div className="flex justify-between text-xl font-bold border-t-2 border-slate-200 pt-4 text-slate-900"><span>Total Due</span><span>₦{client.price.toLocaleString()}</span></div>
              </div>
            </div>

            {isLocalClient && (
              <div className="hidden print:block mt-8 p-4 border border-dashed border-amber-400 rounded-lg text-center text-amber-700 text-xs">
                DRAFT — Pending server sync. Final invoice number will be issued once connectivity is restored.
              </div>
            )}

            <div className="mt-20 pt-8 border-t-2 border-slate-100 text-center text-slate-500 text-sm space-y-1">
              <p className="font-medium text-slate-600">Thank you for choosing {studioName} for your photography needs.</p>
              {studioEmail && <p>Questions? Contact us at <span className="text-primary font-semibold">{studioEmail}</span></p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function InvoicePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AppLayout><InvoiceContent id={id} /></AppLayout>;
}
