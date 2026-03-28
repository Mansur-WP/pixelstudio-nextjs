"use client";

import { use } from "react";
import { useGallery } from "@/hooks/use-data";
import { getImageUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Camera, Download, DownloadCloud, Heart, Clock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function GalleryContent({ token }: { token: string }) {
  const { data: gallery, isLoading, isError, error } = useGallery(token);
  const { toast } = useToast();

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center"><Camera className="w-8 h-8 text-primary" /></div>
        <p className="text-muted-foreground font-medium">Preparing your beautiful gallery...</p>
      </div>
    </div>
  );

  if (isError || !gallery) {
    const errMsg = error instanceof Error ? error.message : "";
    const isNotReady = errMsg.includes("not ready") || errMsg.includes("being edited");
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4 bg-slate-50 px-4">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${isNotReady ? 'bg-amber-100 text-amber-500' : 'bg-rose-100 text-rose-500'}`}>
          {isNotReady ? <Clock className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
        </div>
        <h1 className="text-3xl font-display font-bold text-center">{isNotReady ? "Gallery Not Ready Yet" : "Gallery Not Found"}</h1>
        <p className="text-muted-foreground text-lg text-center max-w-md">
          {isNotReady ? "Your photos are still being edited. We will notify you as soon as they are ready!" : "This link may be invalid or the gallery has been removed. Please contact the studio."}
        </p>
        {isNotReady && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4 text-center max-w-sm">
            <p className="text-sm text-amber-700 font-medium">Thank you for your patience</p>
            <p className="text-xs text-amber-600 mt-1">Check back soon — your edited photos will appear here automatically.</p>
          </div>
        )}
      </div>
    );
  }

  const handleDownload = (imageUrl: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = getImageUrl(imageUrl); link.download = fileName; link.target = "_blank"; link.rel = "noopener noreferrer"; link.click();
    toast({ title: "Downloading...", description: `Saving ${fileName} to your device.` });
  };

  const handleDownloadAll = () => {
    gallery.photos.forEach((photo, i) => setTimeout(() => handleDownload(photo.imageUrl, photo.fileName), i * 300));
    toast({ title: "Downloading all photos", description: `Saving ${gallery.photos.length} photos to your device.` });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-foreground font-sans">
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-xl border-b border-white/10 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 font-display text-xl font-bold">
            {gallery.studioLogoUrl
              ? <img src={getImageUrl(gallery.studioLogoUrl)} alt={gallery.studioName} className="h-10 w-10 rounded-lg object-cover" />
              : <div className="bg-primary p-2 rounded-lg"><Camera className="w-5 h-5 text-white" /></div>}
            <span>{gallery.studioName}</span>
          </div>
          <Button onClick={handleDownloadAll} className="gap-2 bg-gradient-to-r from-primary to-indigo-500 hover:from-primary/90 hover:to-indigo-500/90 text-white border-0 shadow-lg hover:-translate-y-0.5 transition-all">
            <DownloadCloud className="w-4 h-4" />
            <span className="hidden sm:inline font-semibold">Download All</span>
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-3xl text-center mx-auto mb-20 space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="inline-flex px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-2">Client Gallery</div>
          <h1 className="text-5xl md:text-6xl font-display font-bold tracking-tight text-slate-900">{gallery.clientName}'s Collection</h1>
          <p className="text-xl text-slate-500 leading-relaxed max-w-2xl mx-auto">Your photos are ready! We hope you love them as much as we loved capturing them.</p>
          <div className="flex items-center justify-center gap-4 py-4">
            <div className="h-px w-16 bg-slate-300"></div><Camera className="w-5 h-5 text-slate-300" /><div className="h-px w-16 bg-slate-300"></div>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2 text-base font-medium text-slate-400 flex-wrap">
            <span className="bg-white px-4 py-1.5 rounded-md shadow-sm border border-slate-100">{new Date(gallery.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span>•</span>
            <span className="bg-white px-4 py-1.5 rounded-md shadow-sm border border-slate-100">{gallery.photoCount} High-Res Photo{gallery.photoCount !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {gallery.photos.length === 0 && (
          <div className="text-center py-24 text-muted-foreground">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4"><Camera className="w-10 h-10 text-slate-300" /></div>
            <p className="text-lg font-medium">No photos uploaded yet.</p>
            <p className="text-sm mt-1">Check back soon — your photographer is still working on them!</p>
          </div>
        )}

        <div className="columns-1 sm:columns-2 lg:columns-3 gap-8 space-y-8">
          {gallery.photos.map((photo, i) => (
            <div key={photo.id} className="break-inside-avoid relative group rounded-2xl overflow-hidden shadow-md bg-white border-2 border-transparent hover:border-primary transition-all duration-300 animate-in fade-in zoom-in-95" style={{ animationDelay: `${i * 80}ms` }}>
              <img src={getImageUrl(photo.imageUrl)} alt={photo.fileName} className="w-full h-auto object-cover" loading="lazy" />
              <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white text-xs font-medium px-2.5 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-sm border border-white/10">{i + 1} / {gallery.photos.length}</div>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between p-6">
                <Button variant="secondary" size="icon" className="rounded-full bg-white/20 hover:bg-rose-500 hover:text-white text-white backdrop-blur-md border-0 transition-colors h-10 w-10 shadow-lg"
                  onClick={() => toast({ title: "Favorited!", description: "Added to your favorites list." })}>
                  <Heart className="w-5 h-5" />
                </Button>
                <Button variant="default" className="rounded-full gap-2 font-semibold shadow-lg hover:scale-105 transition-transform" onClick={() => handleDownload(photo.imageUrl, photo.fileName)}>
                  <Download className="w-4 h-4" /> Download
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-32 pb-16 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-50 to-slate-100 text-primary mb-6 shadow-inner border border-white overflow-hidden">
            {gallery.studioLogoUrl ? <img src={getImageUrl(gallery.studioLogoUrl)} alt={gallery.studioName} className="w-full h-full object-cover" /> : <Camera className="w-8 h-8" />}
          </div>
          <p className="font-display font-bold text-2xl mb-2 text-slate-900">{gallery.studioName}</p>
          <p className="text-slate-500 font-medium">Captured with passion by {gallery.photographerName}</p>
        </div>
      </main>
    </div>
  );
}

export default function ClientGalleryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <GalleryContent token={id} />;
}
