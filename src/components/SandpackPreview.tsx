import React from 'react';
import { 
  SandpackProvider, 
  SandpackLayout, 
  SandpackPreview,
} from "@codesandbox/sandpack-react";
import { Monitor, Smartphone, Tablet, Terminal, Wifi, RefreshCw } from 'lucide-react';
import { RealAdbPreview } from './RealAdbPreview';
import { SiAndroid } from 'react-icons/si';

interface SandpackPreviewProps {
  files: Record<string, string>;
  framework?: string;
  projectName?: string;
  activeFile?: string;
  isGenerating?: boolean;
}

export const CodeSandboxPreview: React.FC<SandpackPreviewProps> = ({ files, framework, projectName, activeFile, isGenerating }) => {
  const [viewMode, setViewMode] = React.useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  // Convert flat files block to what Sandpack expects
  const sandpackFiles = React.useMemo(() => {
    const formattedFiles: Record<string, string> = {};
    Object.entries(files).forEach(([key, value]) => {
      // Ensure key starts with /
      const normalizedKey = key.startsWith('/') ? key : `/${key}`;
      formattedFiles[normalizedKey] = value;
    });

    // Determine if it needs package.json tweaks for Tailwind or Lucide, etc
    // For React/Vite, usually sandpack 'react-ts' handles basic things, but we might need dependencies
    
    // Inject package.json if it doesn't exist, to add standard dependencies our AI generates
    if (!formattedFiles['/package.json']) {
      let mainEntry = "/index.tsx";
      if (!formattedFiles['/index.tsx'] && formattedFiles['/src/main.tsx']) {
         mainEntry = "/src/main.tsx";
      } else if (!formattedFiles['/index.tsx'] && formattedFiles['/App.tsx'] && !formattedFiles['/src/main.tsx']) {
         // Create a synthetic index.tsx if it doesn't exist to render App
         formattedFiles['/index.tsx'] = `import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App';\n\nconst root = createRoot(document.getElementById('root')!);\nroot.render(<App />);`;
      } else if (formattedFiles['/index.html'] && !formattedFiles['/index.tsx']) {
         // Vanilla fallback
         if (framework === 'Vanilla' || framework === 'HTML5') {
            mainEntry = "/index.js";
         }
      }

      formattedFiles['/package.json'] = JSON.stringify({
        name: projectName || "my-app",
        main: mainEntry,
        dependencies: {
          "react": "^18.0.0",
          "react-dom": "^18.0.0",
          "lucide-react": "^0.292.0",
          "framer-motion": "^10.16.4",
          "motion": "^10.16.4",
          "clsx": "^2.0.0",
          "tailwind-merge": "^2.0.0",
          "react-router-dom": "^6.20.0",
          "recharts": "^2.10.0"
        }
      }, null, 2);
    }
    
    return formattedFiles;
  }, [files, projectName]);

  const getWidthClass = () => {
    if (viewMode === 'mobile') return 'max-w-[375px]';
    if (viewMode === 'tablet') return 'max-w-[768px]';
    return 'w-full';
  };

  // Select template based on framework
  let template = 'react-ts';
  if (framework === 'Vanilla' || framework === 'HTML5') {
    template = 'vanilla';
  } else if (framework === 'Next.js' || framework === 'Next.js Project') {
    template = 'nextjs';
  } else if (framework === 'Vue') {
    template = 'vue';
  }

  const isAndroid = framework === 'Android';

  return (
    <div className="w-full h-full bg-[#0A0A0C] flex flex-col font-sans">
      <div className="h-10 border-b border-white/5 bg-black/40 backdrop-blur-md flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            {isAndroid ? (
              <>
                <SiAndroid className="w-4 h-4 text-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
                  Android Emulator Preview
                </span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-blue-500/50 animate-pulse" />
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                  CodeSandbox Preview
                </span>
              </>
            )}
          </div>
        </div>

        {!isAndroid && (
          <div className="flex items-center gap-4">
            <div className="flex bg-white/5 p-1 rounded-lg">
              <button 
                onClick={() => setViewMode('desktop')}
                className={`p-1 rounded-md transition-colors ${viewMode === 'desktop' ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white'}`}
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setViewMode('tablet')}
                className={`p-1 rounded-md transition-colors ${viewMode === 'tablet' ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white'}`}
              >
                <Tablet className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setViewMode('mobile')}
                className={`p-1 rounded-md transition-colors ${viewMode === 'mobile' ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white'}`}
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={`flex-1 overflow-hidden bg-[#050507] ${isAndroid || viewMode === 'desktop' ? 'p-0 items-stretch' : 'p-4 py-8 items-start'} flex justify-center relative`}>
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.02]">
            <span className="text-8xl font-black uppercase tracking-tighter">LIVE PREVIEW</span>
        </div>
        
        <div className={`h-full transition-all duration-500 relative z-10 ${isAndroid ? 'w-full' : getWidthClass()} bg-white dark:bg-[#1e1e1e] flex flex-col`}>
          {isAndroid ? (
            <RealAdbPreview files={files} projectName={projectName} />
          ) : Object.keys(files).length === 0 ? (
            <div className="h-full w-full flex flex-col items-center justify-center bg-[#0D0D0F] text-center p-8 border border-white/5 rounded-2xl">
              <div className="w-16 h-16 rounded-3xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 mb-4 animate-pulse">
                <Wifi className="w-8 h-8 text-blue-400" />
              </div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-white">Pratinjau Kosong</h4>
              <p className="text-xs text-white/40 max-w-xs mt-2 leading-relaxed">
                Belum ada file di proyek ini. Silakan buat file baru di panel kiri atau minta AI untuk mulai membuat aplikasi.
              </p>
            </div>
          ) : (
            <SandpackProvider 
              template={template as any}
              files={sandpackFiles}
              theme="dark"
              customSetup={{
                dependencies: {
                  "lucide-react": "^0.292.0",
                  "framer-motion": "^10.16.4",
                  "motion": "^10.16.4",
                  "clsx": "^2.0.0",
                  "tailwind-merge": "^2.0.0",
                  "recharts": "^2.10.0",
                  "react-router-dom": "^6.20.0"
                }
              }}
              options={{
                 externalResources: ["https://cdn.tailwindcss.com"]
              }}
            >
              <SandpackLayout style={{ height: '100%', flex: 1, border: 'none', borderRadius: 0 }}>
                <SandpackPreview 
                  style={{ height: '100%', flex: 1 }} 
                  showOpenInCodeSandbox={false}
                  showRefreshButton={true}
                />
              </SandpackLayout>
            </SandpackProvider>
          )}
        </div>
      </div>
    </div>
  );
};
