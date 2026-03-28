"use client";

import Link from "next/link";
import { Camera, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-6">
      <div className="text-center max-w-md animate-in fade-in zoom-in-95 duration-500">
        <div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-primary/20 shadow-inner">
          <Camera className="w-12 h-12 text-primary" />
        </div>
        <div className="mb-4 font-mono text-8xl font-bold text-slate-200 select-none">404</div>
        <h1 className="text-3xl font-display font-bold text-slate-900 mb-3">Page Not Found</h1>
        <p className="text-slate-500 text-lg leading-relaxed mb-8">
          The page you're looking for doesn't exist or may have been moved. Let's get you back on track.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg" className="gap-2 shadow-md">
            <Link href="/"><Home className="w-4 h-4" /> Go Home</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2 bg-white">
            <Link href="javascript:history.back()"><ArrowLeft className="w-4 h-4" /> Go Back</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
