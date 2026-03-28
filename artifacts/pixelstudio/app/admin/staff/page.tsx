"use client";

import { useState } from "react";
import {
  useStaff, useCreateStaff, useUpdateStaff,
  useDeleteStaff, useSetStaffPassword,
  type AppStaff,
} from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Plus, Trash2, Edit2, Users, Phone, KeyRound, Eye, EyeOff, UserCheck, UserX, ShieldAlert } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AppLayout } from "@/components/layout";

const createSchema = z.object({
  name:     z.string().min(2, "Full name must be at least 2 characters"),
  email:    z.string().email("Please enter a valid email address"),
  phone:    z.string().min(7, "Phone number is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirm:  z.string().min(1, "Please confirm the password"),
}).refine(d => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

const editSchema = z.object({
  name:  z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(7, "Phone number is required"),
});

const passwordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirm:     z.string().min(1, "Please confirm the password"),
}).refine(d => d.newPassword === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

type CreateForm   = z.infer<typeof createSchema>;
type EditForm     = z.infer<typeof editSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

function ManageStaffContent() {
  const { data: staff, isLoading }    = useStaff();
  const createStaff                   = useCreateStaff();
  const updateStaff                   = useUpdateStaff();
  const deleteStaff                   = useDeleteStaff();
  const setStaffPassword              = useSetStaffPassword();
  const { toast }                     = useToast();

  const [search, setSearch]               = useState("");
  const [modalMode, setModalMode]         = useState<"none" | "create" | "edit" | "password">("none");
  const [selectedStaff, setSelectedStaff] = useState<AppStaff | null>(null);
  const [deleteTarget, setDeleteTarget]   = useState<AppStaff | null>(null);
  const [showPw, setShowPw]               = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);

  const createForm   = useForm<CreateForm>({   resolver: zodResolver(createSchema),   defaultValues: { name: "", email: "", phone: "", password: "", confirm: "" } });
  const editForm     = useForm<EditForm>({     resolver: zodResolver(editSchema),     defaultValues: { name: "", email: "", phone: "" } });
  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema), defaultValues: { newPassword: "", confirm: "" } });

  const filtered = staff?.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    createForm.reset({ name: "", email: "", phone: "", password: "", confirm: "" });
    setShowPw(false); setShowConfirm(false);
    setModalMode("create");
  };

  const openEdit = (member: AppStaff) => {
    setSelectedStaff(member);
    editForm.reset({ name: member.name, email: member.email, phone: member.phone });
    setModalMode("edit");
  };

  const openPassword = (member: AppStaff) => {
    setSelectedStaff(member);
    passwordForm.reset({ newPassword: "", confirm: "" });
    setShowPw(false); setShowConfirm(false);
    setModalMode("password");
  };

  const closeModal = () => { setModalMode("none"); setSelectedStaff(null); };

  const onCreateSubmit = async (values: CreateForm) => {
    try {
      await createStaff.mutateAsync({ name: values.name, email: values.email, phone: values.phone, password: values.password, status: "Active" });
      toast({ title: "Staff added", description: `${values.name} can now log in with their email.` });
      closeModal();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to add staff", variant: "destructive" });
    }
  };

  const onEditSubmit = async (values: EditForm) => {
    if (!selectedStaff) return;
    try {
      await updateStaff.mutateAsync({ id: selectedStaff.id, ...values });
      toast({ title: "Updated", description: `${values.name}'s details have been saved.` });
      closeModal();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to update staff", variant: "destructive" });
    }
  };

  const onPasswordSubmit = async (values: PasswordForm) => {
    if (!selectedStaff) return;
    try {
      await setStaffPassword.mutateAsync({ id: selectedStaff.id, newPassword: values.newPassword });
      toast({ title: "Password changed", description: `New password set for ${selectedStaff.name}.` });
      closeModal();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to change password", variant: "destructive" });
    }
  };

  const toggleStatus = async (member: AppStaff) => {
    const next = member.status === "Active" ? "Inactive" : "Active";
    try {
      await updateStaff.mutateAsync({ id: member.id, status: next });
      toast({ title: `Account ${next === "Active" ? "activated" : "deactivated"}`, description: `${member.name} is now ${next.toLowerCase()}.` });
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to update status", variant: "destructive" });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteStaff.mutateAsync(deleteTarget.id);
      toast({ title: "Removed", description: `${deleteTarget.name} has been removed.` });
    } catch (e: unknown) {
      toast({ title: "Cannot Delete", description: e instanceof Error ? e.message : "Failed to remove staff", variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-bold tracking-tight">Manage Staff</h1>
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-semibold border border-primary/20">{staff?.length ?? 0} Members</span>
          </div>
          <p className="text-muted-foreground mt-1">Add, edit, reset passwords, and control staff account access.</p>
        </div>
        <Button onClick={openCreate} className="gap-2 shadow-md" size="lg"><Plus className="w-4 h-4" /> Add Staff Member</Button>
      </div>

      <Card className="border-border/60 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-slate-50/50">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-white border-border/60" />
          </div>
        </div>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50 sticky top-0 z-10 shadow-sm">
              <TableRow className="hover:bg-transparent border-b border-border/40">
                <TableHead className="py-3.5 pl-6 font-semibold">Staff Member</TableHead>
                <TableHead className="font-semibold">Phone</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Date Added</TableHead>
                <TableHead className="text-right pr-6 font-semibold">Admin Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/40">
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground"><div className="flex flex-col items-center gap-3"><div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" /><p>Loading staff directory...</p></div></TableCell></TableRow>
              ) : filtered?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-16"><div className="flex flex-col items-center text-muted-foreground"><div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4"><Users className="w-8 h-8 text-slate-400" /></div><h3 className="text-lg font-semibold text-foreground mb-1">{search ? "No staff match your search" : "No staff members yet"}</h3>{search && <Button variant="outline" onClick={() => setSearch("")} className="mt-3 bg-white">Clear Search</Button>}</div></TableCell></TableRow>
              ) : (
                filtered?.map((member, index) => (
                  <TableRow key={member.id} className={`hover:bg-slate-50/80 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-muted/20'}`}>
                    <TableCell className="pl-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm border shrink-0 ${member.status === 'Active' ? 'bg-gradient-to-br from-indigo-100 to-violet-100 text-primary border-primary/10' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>{member.name.charAt(0)}</div>
                        <div><p className="font-semibold text-foreground">{member.name}</p><p className="text-xs text-muted-foreground mt-0.5 font-mono">{member.email}</p></div>
                      </div>
                    </TableCell>
                    <TableCell><div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Phone className="w-3.5 h-3.5 shrink-0" />{member.phone}</div></TableCell>
                    <TableCell><StatusBadge status={member.status} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{new Date(member.dateAdded).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</TableCell>
                    <TableCell className="text-right pr-6">
                      <TooltipProvider>
                        <div className="flex justify-end gap-1">
                          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => openEdit(member)} className="h-8 w-8 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-lg"><Edit2 className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Edit Details</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => openPassword(member)} className="h-8 w-8 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><KeyRound className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Reset Password</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => toggleStatus(member)} className={`h-8 w-8 rounded-lg ${member.status === 'Active' ? 'text-slate-500 hover:text-orange-600 hover:bg-orange-50' : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'}`}>{member.status === 'Active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}</Button></TooltipTrigger><TooltipContent>{member.status === 'Active' ? 'Deactivate Account' : 'Activate Account'}</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => setDeleteTarget(member)} className="h-8 w-8 text-slate-500 hover:text-destructive hover:bg-destructive/10 rounded-lg"><Trash2 className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Remove Staff</TooltipContent></Tooltip>
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

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Remove ${deleteTarget?.name}?`}
        description="This will permanently delete the staff member and their login access."
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={confirmDelete}
      />

      <Dialog open={modalMode === "create"} onOpenChange={open => !open && closeModal()}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle className="text-xl font-display flex items-center gap-2"><Plus className="w-5 h-5 text-primary" /> Add New Staff Member</DialogTitle><DialogDescription>Create an account for a new studio team member. They will log in with their email and password.</DialogDescription></DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 pt-2">
              <FormField control={createForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="Adaeze Nwosu" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={createForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" placeholder="adaeze@pixelstudio.ng" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={createForm.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="08011223344" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="border-t border-border/40 pt-4 space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5" /> Login Credentials</p>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={createForm.control} name="password" render={({ field }) => (<FormItem><FormLabel>Password</FormLabel><div className="relative"><FormControl><Input type={showPw ? "text" : "password"} placeholder="••••••••" className="pr-10" {...field} /></FormControl><button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div><FormMessage /></FormItem>)} />
                  <FormField control={createForm.control} name="confirm" render={({ field }) => (<FormItem><FormLabel>Confirm</FormLabel><div className="relative"><FormControl><Input type={showConfirm ? "text" : "password"} placeholder="••••••••" className="pr-10" {...field} /></FormControl><button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div><FormMessage /></FormItem>)} />
                </div>
              </div>
              <DialogFooter className="pt-4 border-t"><Button type="button" variant="outline" onClick={closeModal}>Cancel</Button><Button type="submit" disabled={createStaff.isPending} className="gap-2">{createStaff.isPending ? "Saving..." : <><Plus className="w-4 h-4" /> Add Staff</>}</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={modalMode === "edit"} onOpenChange={open => !open && closeModal()}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader><DialogTitle className="text-xl font-display flex items-center gap-2"><Edit2 className="w-5 h-5 text-primary" /> Edit Staff Details</DialogTitle><DialogDescription>Update {selectedStaff?.name}'s profile information.</DialogDescription></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 pt-2">
              <FormField control={editForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={editForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={editForm.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter className="pt-4 border-t"><Button type="button" variant="outline" onClick={closeModal}>Cancel</Button><Button type="submit" disabled={updateStaff.isPending}>{updateStaff.isPending ? "Saving..." : "Save Changes"}</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={modalMode === "password"} onOpenChange={open => !open && closeModal()}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle className="text-xl font-display flex items-center gap-2"><KeyRound className="w-5 h-5 text-amber-500" /> Reset Password</DialogTitle><DialogDescription>Set a new password for <span className="font-semibold text-foreground">{selectedStaff?.name}</span>. They will need to use it on their next login.</DialogDescription></DialogHeader>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4 pt-2">
              <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (<FormItem><FormLabel>New Password</FormLabel><div className="relative"><FormControl><Input type={showPw ? "text" : "password"} placeholder="Min 6 characters" className="pr-10" {...field} /></FormControl><button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div><FormMessage /></FormItem>)} />
              <FormField control={passwordForm.control} name="confirm" render={({ field }) => (<FormItem><FormLabel>Confirm Password</FormLabel><div className="relative"><FormControl><Input type={showConfirm ? "text" : "password"} placeholder="Repeat password" className="pr-10" {...field} /></FormControl><button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div><FormMessage /></FormItem>)} />
              <DialogFooter className="pt-4 border-t"><Button type="button" variant="outline" onClick={closeModal}>Cancel</Button><Button type="submit" disabled={setStaffPassword.isPending} className="bg-amber-500 hover:bg-amber-600 text-white">{setStaffPassword.isPending ? "Saving..." : "Set New Password"}</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ManageStaffPage() {
  return <AppLayout><ManageStaffContent /></AppLayout>;
}
