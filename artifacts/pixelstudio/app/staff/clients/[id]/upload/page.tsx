"use client";

import { useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useClient, useUploadPhotos } from "@/hooks/use-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDropzone } from "react-dropzone";
import { ArrowLeft, UploadCloud, X, Check, Copy, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { AppLayout } from "@/components/layout";

function UploadPhotosContent({ id }: { id: string }) {
  const router = useRouter();
  const { data: client, isLoading } = useClient(id);
  const uploadPhotos = useUploadPhotos();
  const { toast } = useToast();

  const [files, setFiles]       = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploaded, setUploaded] = useState(false);
  const [copied, setCopied]     = useState(false);

  const onDrop = useCallback((accepted: File[]) => {
    setFiles(prev => [...prev, ...accepted]);
    const urls = accepted.map(f => URL.createObjectURL(f));
    setPreviews(prev => [...prev, ...urls]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    multiple: true,
  });

  const removeFile = (i: number) => {
    URL.revokeObjectURL(previews[i]);
    setFiles(files.filter((_, idx) => idx !== i));
    setPreviews(previews.filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    if (files.length === 0) { toast({ title: "No photos selected", description: "Please add at least one photo.", variant: "destructive" }); return; }
    try {
      await uploadPhotos.mutateAsync({ id: client!.id, files });
      setUploaded(true);
      toast({ title: "Photos uploaded!", description: "Gallery is now live for your client." });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Upload failed. Please try again.", variant: "destructive" });
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.origin + client!.galleryLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied!", description: "Gallery link copied." });
  };

  if (isLoading) {
    return <div className="animate-pulse max-w-3xl mx-auto space-y-4">{[1, 2].map(i => <div key={i} className="h-40 bg-slate-100 rounded-2xl" />)}</div>;
  }

  if (!client) {
    return <div className="text-center py-20"><p className="text-muted-foreground">Client not found.</p></div>;
  }

  if (uploaded) {
    return (
      <div className="max-w-xl mx-auto mt-12 animate-in zoom-in-95 duration-500">
        <Card className="border-0 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-br from-violet-500 to-indigo-600 p-10 text-white flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-4 border border-white/20">
              <ImageIcon className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-display font-bold">Gallery Live!</h2>
            <p className="text-indigo-100 mt-2">{files.length} photos uploaded for {client.clientName}</p>
          </div>
          <CardContent className="p-7 space-y-5 bg-white">
            <p className="text-sm font-semibold text-slate-700">Share this link with your client:</p>
            <div className="flex gap-2">
              <Input readOnly value={window.location.origin + client.galleryLink} className="bg-slate-50 font-mono text-xs border-slate-200" />
              <Button variant="secondary" onClick={copyLink} className="shrink-0 gap-2 w-28">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 bg-white" asChild><Link href="/staff/clients">All Clients</Link></Button>
              <Button className="flex-1 gap-2" onClick={() => window.open(client.galleryLink, '_blank')}>View Gallery</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/staff/clients/${client.id}`)} className="rounded-full border border-border/50">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Upload Photos</h1>
          <p className="text-muted-foreground text-sm">For <span className="font-semibold text-foreground">{client.clientName}</span> — {client.invoiceId}</p>
        </div>
      </div>

      {client.photos.length > 0 && (
        <Card className="border-border/40 shadow-sm bg-amber-50/50 border-amber-200">
          <CardContent className="p-4 flex items-center gap-3">
            <ImageIcon className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">This client already has <span className="font-bold">{client.photos.length} photos</span> uploaded. Adding new photos will replace the existing gallery.</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b border-border/40">
          <CardTitle className="font-display">Photo Upload</CardTitle>
          <CardDescription>Drag and drop edited images to create the client gallery.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-12 transition-all cursor-pointer min-h-[280px] ${isDragActive ? 'border-primary bg-primary/5 scale-[0.99]' : 'border-slate-300 bg-slate-50 hover:bg-slate-100/80 hover:border-slate-400'}`}
          >
            <input {...getInputProps()} />
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors shadow-sm ${isDragActive ? 'bg-primary text-white' : 'bg-white text-primary border border-slate-200'}`}>
              <UploadCloud className="w-8 h-8" />
            </div>
            <p className="font-semibold text-lg text-slate-700">{isDragActive ? "Drop photos here" : "Drag & drop photos here"}</p>
            <p className="text-sm text-slate-500 mt-1">JPG, PNG, WEBP supported</p>
            <Button type="button" variant="secondary" className="mt-5 bg-white border border-slate-200 shadow-sm font-semibold">Browse Files</Button>
          </div>

          {previews.length > 0 && (
            <div className="animate-in fade-in duration-300">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-700">{previews.length} photo{previews.length !== 1 ? 's' : ''} selected</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setFiles([]); setPreviews([]); }} className="h-8 text-rose-500 hover:bg-rose-50">Clear All</Button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {previews.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden group shadow-sm border border-slate-200">
                    <img src={src} alt="Preview" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button type="button" onClick={() => removeFile(i)} className="bg-rose-500 text-white p-1.5 rounded-full hover:bg-rose-600 shadow-lg">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="ghost" className="h-11 px-6" onClick={() => router.push(`/staff/clients/${client.id}`)}>Cancel</Button>
        <Button size="lg" className="h-11 px-8 font-bold shadow-md gap-2" onClick={handleSave} disabled={uploadPhotos.isPending || files.length === 0}>
          <UploadCloud className="w-4 h-4" />
          {uploadPhotos.isPending ? "Uploading..." : "Save & Generate Gallery"}
        </Button>
      </div>
    </div>
  );
}

export default function UploadPhotosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AppLayout><UploadPhotosContent id={id} /></AppLayout>;
}
