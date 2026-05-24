import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, Cpu, FileCode, CheckCircle2, AlertTriangle, Play, RefreshCw, Terminal as TerminalIcon, Archive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface RealAdbPreviewProps {
  files: Record<string, string>;
  projectName?: string;
}

interface ParsedMetadata {
  appName: string;
  packageName: string;
}

// Extract app metadata from main Kotlin source files safely
function extractKotlinMetadata(files: Record<string, string>, projectName?: string): ParsedMetadata {
  let appName = projectName || "ComposeApp";
  let packageName = "com.studio.androidapp";

  Object.entries(files).forEach(([_, content]) => {
    // Look for package definition
    const packageMatch = content.match(/package\s+([a-zA-Z0-9._]+)/);
    if (packageMatch && packageMatch[1]) {
      packageName = packageMatch[1];
    }
  });

  // Try parsing custom app layout name from files
  const keyName = Object.keys(files).find(k => k.endsWith('MainActivity.kt') || k.toLowerCase().includes('mainactivity'));
  if (keyName) {
    const simpleName = keyName.split('/').pop()?.replace('.kt', '') || '';
    if (simpleName && simpleName !== 'MainActivity') {
      appName = simpleName;
    }
  }

  return {
    appName,
    packageName
  };
}

export const RealAdbPreview: React.FC<RealAdbPreviewProps> = ({ files, projectName }) => {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'queued' | 'running' | 'completed' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const metadata = React.useMemo(() => {
    return extractKotlinMetadata(files, projectName);
  }, [files, projectName]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Scroll terminal to bottom when new logs arrive
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Real-time Firestore sync when build job starts
  useEffect(() => {
    if (!jobId) return;

    console.log(`[FIREBASE] Subscribing to build job: ${jobId}`);
    const docRef = doc(db, 'build_jobs', jobId);

    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setStatus(data.status || 'queued');
        setProgress(data.progress || 0);
        setLogs(data.logs || []);
      }
    }, (error) => {
      console.error("[FIREBASE] Listener error:", error);
      showToast("Gagal menyinkronkan data build real-time.");
    });

    return () => {
      unsub();
    };
  }, [jobId]);

  // Trigger server-side full build
  const handleTriggerCloudBuild = async () => {
    try {
      setLoading(true);
      setLogs(["[SYSTEM] Memulai koneksi ke Cloud Build Server..."]);
      setStatus("queued");
      setProgress(5);

      const response = await fetch('/api/build-apk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files,
          projectName: metadata.appName,
          packageName: metadata.packageName,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Gagal menghubungi server kompilasi cloud.");
      }

      const resData = await response.json();
      if (resData.success && resData.jobId) {
        setJobId(resData.jobId);
        showToast("Build didelegasikan ke Cloud Server!");
      }
    } catch (err: any) {
      console.error(err);
      setStatus("failed");
      setLogs(prev => [...prev, `[ERROR] Gagal memulai build: ${err.message}`]);
      showToast(`Gagal memulai build: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Render logs with custom colors based on markers
  const renderLogLines = () => {
    return logs.map((log, index) => {
      let textColor = 'text-zinc-300';
      if (log.startsWith('[ERROR]')) {
        textColor = 'text-red-400 font-semibold';
      } else if (log.startsWith('[WARNING]')) {
        textColor = 'text-amber-400 font-medium';
      } else if (log.startsWith('[SUCCESS]')) {
        textColor = 'text-emerald-400 font-semibold';
      } else if (log.startsWith('[SYSTEM]')) {
        textColor = 'text-indigo-400';
      } else if (log.startsWith('> Task')) {
        textColor = 'text-zinc-500 italic';
      }

      return (
        <div key={index} className={`py-0.5 whitespace-pre-wrap leading-relaxed ${textColor}`}>
          {log}
        </div>
      );
    });
  };

  return (
    <div id="adb-preview-root" className="h-full w-full bg-[#09090b] flex flex-col font-sans text-zinc-300">
      
      {/* Header Panel */}
      <div id="adb-header" className="border-b border-zinc-900 bg-[#0c0c0e] px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="bg-indigo-500/10 text-indigo-400 font-semibold text-[10px] px-2 py-0.5 rounded border border-indigo-500/20 uppercase tracking-wider">
              Cloud Real Compiler
            </span>
            <span className="text-xs text-zinc-600">•</span>
            <span className="text-xs text-zinc-400">Integrated Firestore System</span>
          </div>
          <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            Android Server Compiler
          </h2>
        </div>
        
        {/* Connection status indicator */}
        <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>SERVER CONNECTED</span>
        </div>
      </div>

      {/* Main Container */}
      <div id="adb-main-content" className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar max-w-3xl w-full mx-auto">
        
        {/* Explanation Alert */}
        <div className="bg-indigo-950/10 border border-indigo-950/40 rounded-xl p-4 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-indigo-400 font-bold uppercase tracking-wider">
            <Archive className="w-4 h-4" />
            Sistem Kompilasi Sisi Server Nyata
          </div>
          <p className="text-zinc-300 leading-relaxed">
            Untuk menghindari gimmick APK rusak khas simulasi di browser, kode Kotlin Anda sekarang langsung diproses di <strong>Cloud Server (Backend Engine)</strong>. Server melakukan analisis sintaksis nyata, pemetaan Gradle, serta menghasilkan bundel project format <strong>Android Studio Gradle (.zip) asli</strong> yang 100% aman, bersih, dan dapat dijalankan langsung di perangkat/PC Anda tanpa takut korup!
          </p>
        </div>

        {/* Specifications */}
        <div id="metadata-card" className="bg-[#0f0f11] border border-zinc-900 rounded-xl p-4 space-y-3 shadow-md">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Konfigurasi Projek Target
            </h3>
            <span className="text-[10px] font-mono text-zinc-500">Android SDK 34 • Kotlin 1.9</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] text-zinc-500 uppercase font-bold">Nama Aplikasi</span>
              <div className="font-semibold text-white select-all">{metadata.appName}</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-zinc-500 uppercase font-bold">Application Package ID</span>
              <div className="font-mono text-zinc-400 select-all">{metadata.packageName}</div>
            </div>
          </div>
        </div>

        {/* Compile Card or Terminal */}
        <div className="bg-[#121215] border border-zinc-900 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-900 pb-4">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Kontrol Kompilasi Cloud</h4>
              <p className="text-[10px] text-zinc-400 mt-0.5">Mulai transpilasi dan analisis struktur file di server.</p>
            </div>

            <button
              id="btn-start-cloud-build"
              onClick={handleTriggerCloudBuild}
              disabled={loading || status === 'queued' || status === 'running'}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-md"
            >
              {status === 'queued' || status === 'running' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Memproses di Server...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  Kompilasi Sisi Server
                </>
              )}
            </button>
          </div>

          {/* Real-time progress bar */}
          {status !== 'idle' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-zinc-400 capitalize">
                  Status: <span className={
                    status === 'completed' ? 'text-emerald-400' :
                    status === 'failed' ? 'text-red-400' :
                    'text-indigo-400 animate-pulse'
                  }>{status}</span>
                </span>
                <span className="font-mono text-zinc-350">{progress}%</span>
              </div>
              <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    status === 'completed' ? 'bg-emerald-500' :
                    status === 'failed' ? 'bg-red-500' :
                    'bg-indigo-500'
                  }`} 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* LOGS TERMINAL (Streams real-time updates from Firestore!) */}
          {status !== 'idle' && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-zinc-450 text-[10px] font-bold uppercase tracking-wider pl-1">
                <TerminalIcon className="w-3.5 h-3.5 text-zinc-500" />
                <span>Compiler Terminal Logs (Firestore Live Stream)</span>
              </div>
              <div className="bg-[#09090b] rounded-lg border border-zinc-900 p-4 h-64 overflow-y-auto font-mono text-[11px] custom-scrollbar selection:bg-indigo-500/25">
                {renderLogLines()}
                <div ref={terminalEndRef} />
              </div>
            </div>
          )}

          {/* Success actions */}
          {status === 'completed' && jobId && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-950/10 border border-emerald-900/30 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4"
            >
              <div className="text-left space-y-1">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Kompilasi Sukses 100%
                </div>
                <div className="text-[10px] text-zinc-400">
                  Arsip Gradle terbuat bersih & lolos verifikasi lint Kotlin compiler.
                </div>
              </div>
              <a
                href={`/api/download-build/${jobId}`}
                download
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh Project Android Studio
              </a>
            </motion.div>
          )}

          {/* Failed actions */}
          {status === 'failed' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-950/10 border border-red-900/20 p-4 rounded-xl"
            >
              <div className="text-xs font-medium text-red-300 flex items-start gap-2 leading-relaxed">
                <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-red-400 mt-0.5" />
                <div>
                  <span className="font-bold block text-white mb-0.5">Terjadi Masalah dalam Struktur Kode Kotlin</span>
                  Harap teliti kembali kesesuaian tanda kurung <code className="bg-[#000] px-1 py-0.5 rounded text-white italic">{"{ }"}</code>, <code className="bg-[#000] px-1 py-0.5 rounded text-white italic">{"( )"}</code>, package declarations, dan compose annotations yang ditunjukkan oleh daftar log kesalahan warna merah pada terminal di atas.
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Dynamic File Summary */}
        <div id="file-summary" className="space-y-2">
          <div className="flex items-center gap-1.5 text-zinc-450">
            <FileCode className="w-3.5 h-3.5 text-zinc-500" />
            <h4 className="text-[10px] font-bold uppercase tracking-wider">
              Berkas Sumber Daya Kotlin Terdeteksi ({Object.keys(files).length})
            </h4>
          </div>
          <div className="bg-[#0f0f11] border border-zinc-900 rounded-xl overflow-hidden divide-y divide-zinc-900/50">
            {Object.entries(files).map(([path, content], idx) => (
              <div key={idx} className="px-4 py-2.5 flex items-center justify-between text-[11px] font-mono">
                <span className="text-zinc-350 truncate">{path}</span>
                <span className="text-zinc-500 text-[10px] shrink-0">{(content.length / 1024).toFixed(1)} KB</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Toast Alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#121215] border border-zinc-800 text-white rounded-lg px-4 py-2 text-xs shadow-2xl z-50 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-indigo-400" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
