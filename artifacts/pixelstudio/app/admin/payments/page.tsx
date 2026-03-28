"use client";

import { useState } from "react";
import { useClients, useUpdateClient } from "@/hooks/use-data";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DollarSign, CheckCircle2, Clock, Filter, FileDown, CreditCard, CheckCheck, RotateCcw, CalendarIcon, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/stat-card";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { AppLayout } from "@/components/layout";

function AllPaymentsContent() {
  const { data: clients, isLoading: loadingClients } = useClients();
  const updateClient = useUpdateClient();
  const { toast } = useToast();
  const [filter, setFilter]         = useState("All");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [startDate, setStartDate]   = useState<Date | undefined>(undefined);
  const [endDate, setEndDate]       = useState<Date | undefined>(undefined);

  const allClients = clients ?? [];

  const paidClients    = allClients.filter(c => c.paymentStatus === "Paid");
  const pendingClients = allClients.filter(c => c.paymentStatus === "Pending");
  const totalPaid      = paidClients.reduce((sum, c) => sum + c.price, 0);
  const paidCount      = paidClients.length;
  const pendingRevenue = pendingClients.reduce((sum, c) => sum + c.price, 0);

  const filtered = allClients.filter(c => {
    const matchStatus = filter === "All" || c.paymentStatus === filter;
    const date = new Date(c.date);
    const matchStart = !startDate || date >= startDate;
    const matchEnd   = !endDate   || date <= new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59);
    return matchStatus && matchStart && matchEnd;
  });

  const clearDates = () => { setStartDate(undefined); setEndDate(undefined); };

  const togglePaymentStatus = async (clientId: string, currentStatus: "Paid" | "Pending", clientName: string) => {
    const newStatus = currentStatus === "Paid" ? "Pending" : "Paid";
    setTogglingId(clientId);
    try {
      await updateClient.mutateAsync({ id: clientId, paymentStatus: newStatus });
      toast({ title: newStatus === "Paid" ? "Marked as Paid" : "Marked as Pending", description: `${clientName}'s payment status updated to ${newStatus}.` });
    } catch {
      toast({ title: "Error", description: "Failed to update payment status.", variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    const dateLabel = startDate && endDate ? `${format(startDate, "dd MMM yyyy")} – ${format(endDate, "dd MMM yyyy")}` : startDate ? `From ${format(startDate, "dd MMM yyyy")}` : endDate ? `Up to ${format(endDate, "dd MMM yyyy")}` : "All Dates";
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("PixelStudio — Payments Report", 14, 18);
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
    doc.text(`Filter: ${filter === "All" ? "All Statuses" : filter}   |   Period: ${dateLabel}`, 14, 26);
    doc.text(`Generated: ${format(new Date(), "dd MMM yyyy, HH:mm")}`, 14, 32);
    autoTable(doc, {
      startY: 38,
      head: [["Invoice ID", "Client Name", "Staff", "Date", "Amount (₦)", "Status"]],
      body: filtered.map(c => [c.invoiceId || "—", c.clientName, c.staffName || "—", format(new Date(c.date), "dd MMM yyyy"), c.price.toLocaleString(), c.paymentStatus]),
      headStyles: { fillColor: [109, 40, 217], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 246, 255] },
      columnStyles: { 4: { halign: "right" } },
      foot: [["", "", "", "Total", filtered.reduce((s, c) => s + c.price, 0).toLocaleString(), `${filtered.length} record(s)`]],
      footStyles: { fillColor: [240, 240, 240], fontStyle: "bold" },
    });
    const filename = `pixelstudio-payments-${format(new Date(), "yyyy-MM-dd")}.pdf`;
    doc.save(filename);
    toast({ title: "PDF exported", description: `${filtered.length} record(s) saved to ${filename}` });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">Payments & Invoicing</h1>
        <p className="text-muted-foreground mt-1">Track studio revenue and pending client invoices.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Total Paid"          value={loadingClients ? "…" : `₦${totalPaid.toLocaleString()}`}      icon={DollarSign}   colorScheme="emerald" />
        <StatCard title="Paid Invoices"        value={loadingClients ? "…" : paidCount}                              icon={CheckCircle2} colorScheme="violet" />
        <StatCard title="Pending Collection"   value={loadingClients ? "…" : `₦${pendingRevenue.toLocaleString()}`} icon={Clock}        colorScheme="amber" />
      </div>

      <Card className="border-border/60 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border/50 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-white border border-border/60 rounded-md p-1 shadow-sm flex items-center">
              <Filter className="w-4 h-4 text-muted-foreground ml-2 mr-1" />
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[150px] h-8 bg-transparent border-0 shadow-none focus:ring-0 text-sm font-medium">
                  <SelectValue placeholder="Filter Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Invoices</SelectItem>
                  <SelectItem value="Paid">Paid Only</SelectItem>
                  <SelectItem value="Pending">Pending Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 bg-white shadow-sm h-9 text-sm font-medium">
                  <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                  {startDate ? format(startDate, "dd MMM yyyy") : "From date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} disabled={(d) => endDate ? d > endDate : false} initialFocus />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 bg-white shadow-sm h-9 text-sm font-medium">
                  <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                  {endDate ? format(endDate, "dd MMM yyyy") : "To date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} disabled={(d) => startDate ? d < startDate : false} initialFocus />
              </PopoverContent>
            </Popover>

            {(startDate || endDate) && (
              <Button variant="ghost" size="sm" onClick={clearDates} className="gap-1 text-muted-foreground hover:text-foreground h-9">
                <X className="w-3.5 h-3.5" /> Clear dates
              </Button>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={exportPdf} disabled={loadingClients} className="gap-2 bg-white shadow-sm border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-800 font-semibold">
            <FileDown className="w-4 h-4" /> Export PDF
          </Button>
        </div>

        {(startDate || endDate) && (
          <div className="px-5 py-2 bg-violet-50 border-b border-violet-100 text-sm text-violet-700 font-medium flex items-center gap-2">
            <CalendarIcon className="w-3.5 h-3.5" />
            Showing records
            {startDate ? ` from ${format(startDate, "dd MMM yyyy")}` : ""}
            {endDate   ? ` to ${format(endDate, "dd MMM yyyy")}` : ""}
            <span className="text-violet-400">·</span>
            <span>{filtered.length} result(s)</span>
          </div>
        )}

        <CardContent className="p-0">
          <TooltipProvider>
            <Table>
              <TableHeader className="bg-slate-50/50 sticky top-0 z-10 shadow-sm">
                <TableRow className="hover:bg-slate-50/50 border-b border-border/40">
                  <TableHead className="py-4 pl-6 font-semibold">Invoice ID</TableHead>
                  <TableHead className="font-semibold">Client Name</TableHead>
                  <TableHead className="font-semibold">Assigned Staff</TableHead>
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Amount</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="text-right pr-6 font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/40">
                {loadingClients ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground"><div className="flex flex-col items-center justify-center space-y-3"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /><p>Loading payments data...</p></div></TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-16 text-muted-foreground"><div className="flex flex-col items-center justify-center"><div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 shadow-inner"><CreditCard className="w-8 h-8 text-slate-400" /></div><h3 className="text-lg font-medium text-foreground mb-1">No records found</h3><p className="max-w-sm mb-4 text-sm">Try adjusting your filters or date range.</p><Button variant="outline" onClick={() => { setFilter("All"); clearDates(); }} className="bg-white">Clear All Filters</Button></div></TableCell></TableRow>
                ) : (
                  filtered.map((client, index) => {
                    const isToggling = togglingId === client.id;
                    const isPending  = client.paymentStatus === "Pending";
                    return (
                      <TableRow key={client.id} className={`group transition-colors hover:bg-slate-50/80 ${index % 2 === 0 ? "bg-white" : "bg-muted/20"}`}>
                        <TableCell className="pl-6 py-4"><span className="font-mono text-xs font-medium bg-slate-100 px-2.5 py-1 rounded-md text-slate-700 border border-slate-200">{client.invoiceId || "—"}</span></TableCell>
                        <TableCell className="font-semibold text-foreground text-base">{client.clientName}</TableCell>
                        <TableCell className="text-muted-foreground">{client.staffName || "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm font-medium">{new Date(client.date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</TableCell>
                        <TableCell className="font-bold text-foreground text-base">₦{client.price.toLocaleString()}</TableCell>
                        <TableCell><StatusBadge status={client.paymentStatus} /></TableCell>
                        <TableCell className="text-right pr-6">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={isToggling} onClick={() => togglePaymentStatus(client.id, client.paymentStatus, client.clientName)}
                                className={`h-8 w-8 rounded-lg transition-colors ${isPending ? "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50" : "text-slate-500 hover:text-amber-600 hover:bg-amber-50"}`}>
                                {isToggling ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" /> : isPending ? <CheckCheck className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{isPending ? "Mark as Paid" : "Mark as Pending"}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TooltipProvider>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AllPaymentsPage() {
  return <AppLayout><AllPaymentsContent /></AppLayout>;
}
