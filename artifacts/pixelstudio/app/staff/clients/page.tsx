"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useClients, useDeleteClient } from "@/hooks/use-data";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Link as LinkIcon, FileText, UploadCloud, Eye, Users, SlidersHorizontal, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout";

function ClientRecordsContent() {
  const router = useRouter();
  const { data: clients, isLoading } = useClients();
  const deleteClient = useDeleteClient();
  const { toast } = useToast();
  const [search, setSearch]               = useState("");
  const [filterPayment, setFilterPayment] = useState("All");
  const [filterOrder, setFilterOrder]     = useState("All");

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteClient.mutateAsync(id);
      toast({ title: "Client deleted", description: `${name} and all their data have been permanently removed.` });
    } catch {
      toast({ title: "Delete failed", description: "Could not delete client. Please try again.", variant: "destructive" });
    }
  };

  const filtered = clients?.filter(c => {
    const matchesSearch   = c.clientName.toLowerCase().includes(search.toLowerCase()) || c.invoiceId.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search);
    const matchesPayment  = filterPayment === "All" || c.paymentStatus === filterPayment;
    const matchesOrder    = filterOrder === "All" || c.orderStatus === filterOrder;
    return matchesSearch && matchesPayment && matchesOrder;
  });

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(window.location.origin + link);
    toast({ title: "Copied!", description: "Gallery link copied to clipboard." });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-bold tracking-tight">Customers Records</h1>
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-semibold border border-primary/20">{clients?.length ?? 0} Total</span>
          </div>
          <p className="text-muted-foreground mt-1">Manage customers, upload photos, and track order statuses.</p>
        </div>
        <Button onClick={() => router.push("/staff/clients/new")} size="lg" className="shadow-md gap-2">+ New Customer</Button>
      </div>

      <Card className="border-border/60 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-slate-50/50 flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search customer, invoice, phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-white border-border/60 h-9" />
          </div>
          <div className="flex gap-2 items-center text-sm text-muted-foreground ml-0 sm:ml-auto">
            <SlidersHorizontal className="w-4 h-4 shrink-0" />
            <Select value={filterPayment} onValueChange={setFilterPayment}>
              <SelectTrigger className="h-9 w-[140px] bg-white text-sm"><SelectValue placeholder="Payment" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Payments</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterOrder} onValueChange={setFilterOrder}>
              <SelectTrigger className="h-9 w-[140px] bg-white text-sm"><SelectValue placeholder="Order Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Statuses</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Editing">Editing</SelectItem>
                <SelectItem value="Ready">Ready</SelectItem>
                <SelectItem value="Delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50 sticky top-0 z-10 shadow-sm">
              <TableRow className="hover:bg-transparent border-b border-border/40">
                <TableHead className="py-3.5 pl-6 font-semibold">Customer</TableHead>
                <TableHead className="font-semibold">Price</TableHead>
                <TableHead className="font-semibold">Format</TableHead>
                <TableHead className="font-semibold">Payment</TableHead>
                <TableHead className="font-semibold">Order Status</TableHead>
                <TableHead className="font-semibold">Upload</TableHead>
                <TableHead className="font-semibold">Date</TableHead>
                <TableHead className="text-right pr-6 font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/40">
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12"><div className="flex flex-col items-center gap-3 text-muted-foreground"><div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" /><p>Loading records...</p></div></TableCell></TableRow>
              ) : filtered?.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-16"><div className="flex flex-col items-center text-muted-foreground"><div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4"><Users className="w-8 h-8 text-slate-400" /></div><h3 className="text-lg font-semibold text-foreground mb-1">No clients found</h3><p className="text-sm mb-4">Try adjusting your search or filters.</p><Button variant="outline" onClick={() => { setSearch(""); setFilterPayment("All"); setFilterOrder("All"); }} className="bg-white">Clear Filters</Button></div></TableCell></TableRow>
              ) : (
                filtered?.map((client, index) => (
                  <TableRow key={client.id} className={`group hover:bg-slate-50/80 transition-colors cursor-pointer ${index % 2 === 0 ? 'bg-white' : 'bg-muted/20'}`}
                    onClick={() => router.push(`/staff/clients/${client.id}`)}>
                    <TableCell className="pl-6 py-4">
                      <p className="font-semibold text-foreground">{client.clientName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{client.phone} · <span className="font-mono">{client.invoiceId}</span></p>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">₦{client.price.toLocaleString()}</TableCell>
                    <TableCell><StatusBadge status={client.photoFormat} /></TableCell>
                    <TableCell><StatusBadge status={client.paymentStatus} /></TableCell>
                    <TableCell><StatusBadge status={client.orderStatus} /></TableCell>
                    <TableCell>
                      {client.photoCount > 0
                        ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{client.photoCount} photos</span>
                        : <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">No photos</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{new Date(client.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</TableCell>
                    <TableCell className="pr-6" onClick={e => e.stopPropagation()}>
                      <TooltipProvider>
                        <div className="flex justify-end gap-1.5">
                          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-lg" onClick={() => router.push(`/staff/clients/${client.id}`)}><Eye className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>View Client</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-100 rounded-lg" onClick={() => router.push(`/staff/clients/${client.id}/upload`)}><UploadCloud className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Upload Photos</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-violet-600 hover:bg-violet-100 rounded-lg" onClick={() => router.push(`/staff/clients/${client.id}/invoice`)}><FileText className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>View Invoice</TooltipContent></Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-lg ${client.photoCount > 0 ? 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-100' : 'text-slate-300 cursor-not-allowed'}`}
                                disabled={client.photoCount === 0} onClick={() => copyLink(client.galleryLink)}>
                                <LinkIcon className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{client.photoCount > 0 ? "Copy Gallery Link" : "No gallery yet"}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete {client.clientName}?</AlertDialogTitle>
                                    <AlertDialogDescription>This will permanently delete the client record, all {client.photoCount} uploaded photo(s), gallery, invoices, and payment records. This action cannot be undone.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDelete(client.id, client.clientName)}>Delete Permanently</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TooltipTrigger>
                            <TooltipContent>Delete Client</TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ClientRecordsPage() {
  return <AppLayout><ClientRecordsContent /></AppLayout>;
}
