import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { PlusCircle, Search, Trash2, Calendar, Code, LayoutTemplate, LogIn, LogOut, Monitor, Smartphone, Globe, Box, TerminalSquare, FileJson, Cpu, Download, X, Layers, Settings2, ShieldCheck, ChevronRight, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { SiHtml5, SiReact, SiNextdotjs, SiAndroid } from 'react-icons/si';

export default function Home() {
  const navigate = useNavigate();
  const { projects, loadProjects, createProject, deleteProject, updateProjectFiles } = useAppStore();
  const [search, setSearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [draftName, setDraftName] = useState('Untitled Draft');
  const [draftInstructions, setDraftInstructions] = useState('');
  const [projectType, setProjectType] = useState<'HTML' | 'React' | 'Next.js' | 'Android'>('React');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreateSubmit = async () => {
    try {
      setIsCreating(true);
      
      const metadataMap = {
        'React': {
          language: 'TypeScript' as const,
          framework: 'React' as const,
          bundler: 'Vite' as const,
          type: 'Web App' as const
        },
        'HTML': {
          language: 'HTML5' as const,
          framework: 'Vanilla' as const,
          bundler: 'None' as const,
          type: 'Single Page' as const
        },
        'Next.js': {
          language: 'TypeScript' as const,
          framework: 'Next.js' as const,
          bundler: 'None' as const,
          type: 'Next.js Project' as const
        },
        'Android': {
          language: 'Kotlin' as const,
          framework: 'Android' as const,
          bundler: 'None' as const,
          type: 'Mobile App' as const
        }
      };

      const proj = await createProject(draftName, metadataMap[projectType]);
      
      if (draftInstructions) {
         await useAppStore.getState().addMessage(proj.id, {
           id: uuidv4(),
           role: 'user',
           content: `Instruksi awal pembangunan proyek:\n\n${draftInstructions}`
         });
      }
      
      setIsModalOpen(false);
      navigate(`/editor/${proj.id}`);
    } catch (error) {
      console.error("Failed to create project:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleImportProject = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCreating(true);
    const zip = new JSZip();
    try {
        const contents = await zip.loadAsync(file);
        const files: Record<string, string> = {};
        for (const [path, zipEntry] of Object.entries(contents.files)) {
            if (!zipEntry.dir) {
                const text = await zipEntry.async('string');
                files[path] = text;
            }
        }
        
        let title = file.name;
        if (title.endsWith('.zip')) title = title.substring(0, title.length - 4);
        
        const proj = await createProject(title, {} as any);
        
        await updateProjectFiles(proj.id, files);
        
        setIsCreating(false);
        navigate(`/editor/${proj.id}`);
    } catch (e) {
        console.error("Failed to import zip:", e);
        setIsCreating(false);
    }
  };

  const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-[#0F1115] text-white font-sans flex flex-col overflow-x-hidden selection:bg-blue-500/30">
      <header className="h-16 px-8 flex items-center justify-between sticky top-0 z-50 shrink-0 bg-[#0F1115]/80 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
             <LayoutTemplate className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold tracking-tight text-white/90">Lite Studio</span>
        </div>
        
        <div className="flex gap-6 items-center">
          <div className="hidden lg:flex bg-white/5 items-center rounded-full px-4 py-1.5 w-64 border border-white/10 focus-within:border-white/30 transition-all">
            <Search className="w-4 h-4 text-white/40 mr-2" />
            <input 
              type="text" 
              placeholder="Cari workspace..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-white/20"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              disabled={isCreating}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Import</span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              accept=".zip" 
              className="hidden" 
              onChange={handleImportProject} 
            />
          </div>

          <div className="w-px h-6 bg-white/10 mx-2" />
        </div>
      </header>
      
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-12 flex flex-col">
        {/* HERO SECTION */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-blue-900/20 via-[#0F1115] to-purple-900/20 border border-white/5 p-8 md:p-12 mb-16 flex flex-col md:flex-row items-center gap-12">
           <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
           <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
           
           <div className="flex-1 space-y-6 relative z-10 w-full">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-widest mb-4">
                  <Zap className="w-3 h-3" />
                  AI Native IDE
                </span>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 mb-4 leading-tight">
                  Buat Aplikasi & Website <br/>Secepat Kilat
                </h1>
                <p className="text-white/60 leading-relaxed max-w-lg text-sm md:text-base">
                  Tidak perlu setup manual. Cukup minta kepada AI menggunakan bahasa natural, dan saksikan kodenya ditulis serta dirender seketika dalam satu layar yang sama.
                </p>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-wrap gap-4 pt-4">
                 <button 
                   onClick={() => setIsModalOpen(true)}
                   className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-bold text-sm hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                 >
                   <PlusCircle className="w-4 h-4" />
                   Mulai Proyek Baru
                 </button>
              </motion.div>
           </div>
           
           {/* Visual Showcase */}
           <motion.div 
             initial={{ opacity: 0, scale: 0.95 }} 
             animate={{ opacity: 1, scale: 1 }} 
             transition={{ delay: 0.2 }}
             className="flex-1 w-full relative z-10 hidden md:block"
           >
              <div className="bg-black/50 border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-sm flex flex-col gap-3">
                 <div className="flex items-center gap-2 px-2 pb-2 border-b border-white/5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                 </div>
                 <div className="bg-[#1e1e1e] rounded-lg p-4 font-mono text-xs text-blue-300 leading-relaxed max-h-[160px] overflow-hidden relative">
                    <span className="text-purple-400">import</span> React <span className="text-purple-400">from</span> <span className="text-green-300">'react'</span>;<br/><br/>
                    <span className="text-purple-400">export default function</span> <span className="text-blue-400">Hero</span>() {'{'}<br/>
                    &nbsp;&nbsp;<span className="text-purple-400">return</span> (<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;&lt;<span className="text-red-400">div</span> className=<span className="text-green-300">"flex flex-col..."</span>&gt;<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;<span className="text-red-400">h1</span>&gt;Hello World!&lt;/<span className="text-red-400">h1</span>&gt;<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;&lt;/<span className="text-red-400">div</span>&gt;<br/>
                    &nbsp;&nbsp;);<br/>
                    {'}'}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1e1e1e] to-transparent top-1/2 pointer-events-none" />
                 </div>
              </div>
           </motion.div>
        </div>

        <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
           <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
             <Layers className="w-5 h-5 text-blue-400" />
             Workspace Anda
           </h2>
           <span className="text-xs font-bold text-white/30 uppercase tracking-widest">{filtered.length} Proyek</span>
        </div>

        <AnimatePresence mode="wait">
          {filtered.length === 0 ? (
            <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               className="text-center py-20 rounded-3xl bg-white/[0.02] border border-white/5 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.02)_0%,transparent_70%)] pointer-events-none" />
              <Code className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">Belum ada proyek</h3>
              <p className="text-sm text-white/40 mb-6 max-w-sm mx-auto">
                  Klik tombol <strong>Mulai Proyek Baru</strong> untuk membuat aplikasi React menggunakan AI.
              </p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((proj, idx) => (
                <motion.div 
                  key={proj.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => navigate(`/editor/${proj.id}`)}
                  className="group cursor-pointer bg-white/[0.02] border border-white/5 hover:border-white/20 hover:bg-white/[0.04] rounded-2xl p-5 transition-all relative overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-10 h-10 bg-black/40 rounded-xl border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                       <LayoutTemplate className="w-5 h-5 text-blue-400" />
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProject(proj.id);
                      }}
                      className="text-white/20 hover:text-red-400 p-2 rounded-full hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <h3 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors">
                      {proj.name}
                    </h3>
                    <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-white/40">
                       <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {(() => {
                              try {
                                const date = new Date(proj.updatedAt || proj.createdAt);
                                return isNaN(date.getTime()) ? 'Recently' : formatDistanceToNow(date, { addSuffix: true });
                              } catch (e) {
                                return 'Recently';
                              }
                            })()}
                          </span>
                       </div>
                       <div className="flex items-center gap-1.5">
                          <Code className="w-3 h-3" />
                          <span>{Object.keys(proj.files).length} Files</span>
                       </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#16181D] border border-white/10 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col"
            >
              <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-blue-400" />
                  Mulai Proyek Baru
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-white/40 hover:text-white transition-colors rounded-full hover:bg-white/10">
                   <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-white/70">Nama Proyek</label>
                  <input 
                    type="text" 
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="Contoh: Todo App Modern"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-white/70">Tipe Proyek</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(['HTML', 'React', 'Next.js', 'Android'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setProjectType(type)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all",
                          projectType === type 
                            ? "bg-blue-500/10 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]" 
                            : "bg-black/50 border-white/5 text-white/40 hover:border-white/20"
                        )}
                      >
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                          {type === 'HTML' && <SiHtml5 className="w-4 h-4 text-orange-500" />}
                          {type === 'React' && <SiReact className="w-4 h-4 text-blue-400" />}
                          {type === 'Next.js' && <SiNextdotjs className="w-4 h-4 text-white" />}
                          {type === 'Android' && <SiAndroid className="w-4 h-4 text-green-500" />}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest">{type}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-white/70">Instruksi Awal untuk AI (Opsional)</label>
                  <textarea 
                    value={draftInstructions}
                    onChange={(e) => setDraftInstructions(e.target.value)}
                    placeholder="Beritahu AI apa yang ingin Anda bangun pertama kali..."
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors min-h-[100px] resize-none"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-white/5 flex gap-3 bg-black/20 justify-end">
                 <button 
                   onClick={() => setIsModalOpen(false)}
                   className="px-5 py-2.5 rounded-full text-sm font-semibold text-white/70 hover:text-white hover:bg-white/5 transition-all"
                 >
                   Batal
                 </button>
                 <button 
                   onClick={handleCreateSubmit}
                   disabled={isCreating}
                   className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm font-bold transition-all disabled:opacity-50 inline-flex items-center gap-2"
                 >
                   {isCreating ? (
                     <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Mulai</>
                   ) : 'Buka Editor'}
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

