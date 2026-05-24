import React, { useState } from 'react';
import { FileText, Send, Sparkles, Loader2, Code } from 'lucide-react';
import { cn } from '../lib/utils';

export default function AsistenCoding() {
  const [isiFile, setIsiFile] = useState('');
  const [namaFile, setNamaFile] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState('');

  // Ganti dengan URL endpoint Firebase Cloud Function Anda
  const FIREBASE_FUNCTION_URL = 'https://<region>-<project-id>.cloudfunctions.net/analisisKodeGPT53';

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setNamaFile(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      setIsiFile(event.target.result);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setOutput('');

    try {
      const fullPrompt = isiFile 
        ? `Berikut adalah kode yang saya miliki:\n\n\`\`\`\n${isiFile}\n\`\`\`\n\nPertanyaan/Instruksi: ${prompt}`
        : prompt;

      const messages = [{ role: 'user', content: fullPrompt }];

      const response = await fetch("/api/generate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages })
      });

      if (!response.ok) {
        throw new Error("Gagal menghubungi layanan AI.");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let content = '';
      let buffer = '';

      if (!reader) throw new Error("Gagal membaca stream.");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              buffer = "";
              break;
            }
            if (!data) continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                throw new Error("STREAM_API_ERROR: " + parsed.error);
              }
              if (parsed.content) {
                content += parsed.content;
                setOutput(content);
              }
            } catch (e) {
              if (e.message && e.message.startsWith("STREAM_API_ERROR: ")) {
                throw new Error(e.message.replace("STREAM_API_ERROR: ", ""));
              }
              console.warn("Parse error", e);
            }
          }
        }
      }

      setLoading(false);
    } catch (error) {
      console.error("Gagal menganalisis kode:", error);
      setOutput(`Error: ${error.message || "Unknown error"}`);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-10 font-sans text-white">
      <div className="flex items-center gap-4 mb-10">
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.1)]">
           <Sparkles className="w-6 h-6 text-black" />
        </div>
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold tracking-tight uppercase italic">AI Code Assistant</h2>
          <span className="text-[10px] font-bold text-blue-400/80 tracking-widest flex items-center gap-1.5 mt-1">
             <Sparkles className="w-2.5 h-2.5" />
             POWERED BY ALIBABA QWEN
          </span>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="md-card space-y-8 bg-white/[0.03] border border-white/10 rounded-[3rem] p-10">
        <div className="space-y-4">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 ml-2">Unggah File Kode (Opsional)</label>
          <div className="relative group">
            <input 
              id="file-upload"
              type="file" 
              accept=".js,.jsx,.ts,.tsx,.py,.html,.css,.json" 
              onChange={handleFileUpload}
              className="hidden"
            />
            <label 
              htmlFor="file-upload"
              className="flex items-center gap-4 px-6 py-4 bg-black border border-white/10 rounded-2xl cursor-pointer hover:border-white/30 transition-all group-hover:bg-white/[0.02]"
            >
              <FileText className="w-5 h-5 text-white/40" />
              <span className="text-sm text-white/60">{namaFile || 'Pilih file dari perangkat...'}</span>
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 ml-2">Instruksi / Pertanyaan</label>
          <textarea 
            id="prompt-input"
            rows={4}
            placeholder="Tulis instruksi untuk AI (contoh: Tolong refactor kode ini menjadi lebih rapi)"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
            className="w-full bg-black border border-white/10 rounded-3xl px-6 py-5 text-sm md:text-base text-white focus:outline-none focus:border-white transition-all min-h-[160px] resize-none placeholder-white/20"
          />
        </div>

        <button 
          type="submit" 
          disabled={loading || !prompt.trim()}
          className={cn(
            "md-button-filled w-full flex items-center justify-center gap-3 !rounded-[2rem] !py-4",
            loading && "opacity-50 cursor-not-allowed"
          )}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Memproses Logika...</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>Mulai Analisis</span>
            </>
          )}
        </button>
      </form>

      {output && (
        <div className="mt-12 space-y-6">
          <div className="flex items-center gap-3 ml-2">
             <Code className="w-4 h-4 text-white/40" />
             <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Hasil Analisis</h3>
          </div>
          <div className="bg-black border border-white/10 p-8 rounded-[3rem] overflow-x-auto shadow-inner">
            <pre className="text-sm font-mono leading-relaxed text-gray-300 whitespace-pre-wrap break-words">
              {output}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
