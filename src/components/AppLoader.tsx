import React, { useEffect, useState } from 'react';
import { webLLMService } from '../services/webLLMService';
import { Loader2, Monitor, Cpu, Layers as Box, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AppLoader({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Initializing Core Modules...');

  useEffect(() => {
    const init = async () => {
      const hasVisited = localStorage.getItem('LITE_STUDIO_INITIALIZED') === 'true';

      if (hasVisited) {
        // Fast path for returning users
        setLoadingStep(1);
        setStatusText('Configuring Workspace Resource...');
        
        // Start background loading immediately but only wait a little while
        webLLMService.loadModel();
        
        // Simulating quick checks
        await new Promise(resolve => setTimeout(resolve, 300));
        setProgress(30);
        setStatusText('Allocating Local Memory...');
        await new Promise(resolve => setTimeout(resolve, 400));
        setProgress(70);
        setStatusText('Optimizing IDE Environment...');
        await new Promise(resolve => setTimeout(resolve, 300));
        setProgress(100);
        setStatusText('Resource Ready');
        await new Promise(resolve => setTimeout(resolve, 200));

        setIsReady(true);
      } else {
        // Full initial load for first time
        loadFull();
      }
    };

    const loadFull = async () => {
      try {
        setLoadingStep(1);
        setProgress(0);
        await new Promise(resolve => setTimeout(resolve, 800));

        setLoadingStep(2);
        setStatusText('Configuring Workspace Resource...');
        
        await webLLMService.loadModel((p, text) => {
          setProgress(p * 100);
          if (p < 0.3) setStatusText('Allocating Local Memory...');
          else if (p < 0.6) setStatusText('Connecting Logic Processor...');
          else if (p < 0.9) setStatusText('Optimizing IDE Environment...');
          else setStatusText('Finalizing Workspace Layout...');
        });

        localStorage.setItem('LITE_STUDIO_INITIALIZED', 'true');
        setLoadingStep(3);
        setStatusText('Workspace Ready');
        await new Promise(resolve => setTimeout(resolve, 500));
        setIsReady(true);
      } catch (error) {
        console.error("Initialization Failed:", error);
        setLoadingStep(-1); // Error state
        setStatusText('Network Error: Failed to Load Resources');
      }
    };

    init();
  }, []);

  if (!isReady) {
    const isError = loadingStep === -1;

    return (
      <div className="fixed inset-0 z-[9999] bg-[#000000] flex flex-col items-center justify-center font-sans overflow-hidden">
        {/* Subtle Gradient & Noise */}
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm px-8 flex flex-col items-center"
        >
          <div className="relative mb-12">
            <div className={`relative z-10 w-24 h-24 ${isError ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/10'} border rounded-[2rem] flex items-center justify-center shadow-2xl overflow-hidden`}>
               {!isError && (
                 <motion.div
                   animate={{ 
                      rotate: [0, 90, 180, 270, 360],
                      scale: [1, 1.05, 1]
                   }}
                   transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                   className="absolute inset-0 border-[4px] border-dashed border-white/5 rounded-[2rem]"
                 />
               )}
               <div className="relative">
                  {isError ? (
                    <AlertTriangle className="w-10 h-10 text-red-500" />
                  ) : (
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                       <Monitor className="w-6 h-6 text-black" />
                    </div>
                  )}
               </div>
            </div>
            {!isError && <div className="absolute inset-0 -z-10 animate-pulse opacity-10 bg-white rounded-[2.5rem] blur-3xl" />}
          </div>

          <div className="text-center w-full space-y-8">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-white uppercase italic">LITE STUDIO</h1>
              <p className={`text-[10px] font-medium ${isError ? 'text-red-500' : 'text-white/30'} uppercase tracking-[0.3em]`}>{statusText}</p>
            </div>

            {isError ? (
              <div className="space-y-5">
                <p className="text-[11px] text-white/50 uppercase tracking-tight leading-relaxed max-w-[240px] mx-auto">
                  Gagal membuat lingkungan kerja. Periksa koneksi internet Anda.
                </p>
                <button 
                  onClick={() => window.location.reload()}
                  className="w-full py-3.5 bg-white text-black text-[10px] font-bold uppercase rounded-full transition-all hover:bg-gray-200 active:scale-95"
                >
                  Ulangi Sesi
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
                  <motion.div 
                    className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
                
                <div className="flex justify-between items-center text-[10px] font-mono font-medium tracking-widest text-white/20">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-3 h-3" />
                    <span>V0.9.0-CORE</span>
                  </div>
                  <div className="text-white/40">
                    {Math.round(progress)}%
                  </div>
                </div>
              </div>
            )}

            {!isError && (
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/5">
                 <div className={cn("flex flex-col items-center gap-2 transition-opacity duration-500", loadingStep >= 1 ? "opacity-100" : "opacity-10")}>
                    <Box className="w-4 h-4 text-white" />
                    <span className="text-[8px] font-bold uppercase text-white/50 tracking-tighter">Assets</span>
                 </div>
                 <div className={cn("flex flex-col items-center gap-2 transition-opacity duration-500", loadingStep >= 2 ? "opacity-100" : "opacity-10")}>
                    <Zap className="w-4 h-4 text-white" />
                    <span className="text-[8px] font-bold uppercase text-white/50 tracking-tighter">Logic</span>
                 </div>
                 <div className={cn("flex flex-col items-center gap-2 transition-opacity duration-500", loadingStep >= 3 ? "opacity-100" : "opacity-10")}>
                    <ShieldCheck className="w-4 h-4 text-white" />
                    <span className="text-[8px] font-bold uppercase text-white/50 tracking-tighter">Ready</span>
                 </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Console Footnote */}
        <div className="absolute bottom-10 left-0 right-0 flex justify-center">
           <div className="px-4 py-2 rounded-full border border-white/5 bg-white/[0.03] backdrop-blur-md flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-white opacity-40 animate-pulse" />
              <span className="text-[9px] font-mono text-white/20 uppercase tracking-[0.2em] leading-none">Initializing Workspace Identity</span>
           </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
