import React, { useEffect, useRef, useState, memo, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppStore, Message, Project } from "../store";
import MonacoEditor from "@monaco-editor/react";
import { v4 as uuidv4 } from "uuid";
import {
  ArrowLeft,
  Paperclip,
  Send,
  Loader2,
  Sparkles,
  Code2,
  Check,
  Plus,
  Trash2,
  Monitor,
  ChevronDown,
  ChevronRight,
  FileCode,
  Search,
  Github,
  Globe,
  Zap,
  X,
  ExternalLink,
  Box,
  ArrowRight,
  FileText,
  Download,
  FolderPlus,
  Edit2,
  Bug,
  Play,
  SkipForward,
  Cpu,
  Settings2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { animate, motion, AnimatePresence } from "motion/react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { cn } from "../lib/utils";
import { ThinkingAnimation } from "../components/ThinkingAnimation";
import { CodeSandboxPreview as Preview } from "../components/SandpackPreview";
import {
  SiJavascript,
  SiTypescript,
  SiReact,
  SiHtml5,
  SiCss,
  SiJson,
  SiMarkdown,
} from "react-icons/si";

import { webLLMService } from "../services/webLLMService";
import { ErrorBoundary } from "../components/ErrorBoundary";

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

// Component to render individual messages with <think> and <action> support
const parseMessageSegments = (content: string) => {
  const segments: any[] = [];

  const tagRegex = /<(think|action)([^>]*)>/gi;
  let lastIndex = 0;
  let match;

  while ((match = tagRegex.exec(content)) !== null) {
    const type = match[1].toLowerCase() as "think" | "action";
    const tagContent = match[0];
    const attributesStr = match[2];

    // Add text segment before this tag
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: content.substring(lastIndex, match.index),
      });
    }

    let isSelfClosing = tagContent.endsWith("/>");
    let actionTypeMatch = null;
    let actionType = undefined;

    if (type === "action") {
      actionTypeMatch = attributesStr.match(/type\s*=\s*"([^"]+)"/i);
      if (actionTypeMatch) {
        actionType = actionTypeMatch[1];
      }
      if (attributesStr.trim().endsWith("/")) isSelfClosing = true;
    }

    let actionAttrs: Record<string, string> = {};
    if (type === "action") {
      const attrRegex = /([a-z]+)="([^"]*)"/gi;
      let m;
      while ((m = attrRegex.exec(attributesStr)) !== null) {
        actionAttrs[m[1]] = m[2];
      }
    }

    if (isSelfClosing) {
      segments.push({
        type,
        content: "",
        actionType,
        file: actionAttrs.file || actionAttrs.name,
        target: actionAttrs.target,
        framework: actionAttrs.framework,
        language: actionAttrs.language,
        isComplete: true,
      });
      lastIndex = tagRegex.lastIndex;
      continue;
    }

    let endTag = type === "think" ? "</think>" : "</action>";
    let endMatch = content.indexOf(endTag, tagRegex.lastIndex);

    if (endMatch !== -1) {
      let inner = content.substring(tagRegex.lastIndex, endMatch);
      segments.push({
        type,
        content: inner,
        actionType,
        file: actionAttrs.file || actionAttrs.name,
        target: actionAttrs.target,
        framework: actionAttrs.framework,
        language: actionAttrs.language,
        isComplete: true,
      });
      lastIndex = endMatch + endTag.length;
      tagRegex.lastIndex = lastIndex;
    } else {
      // incomplete
      let inner = content.substring(tagRegex.lastIndex);
      segments.push({
        type,
        content: inner,
        actionType,
        file: actionAttrs.file || actionAttrs.name,
        target: actionAttrs.target,
        framework: actionAttrs.framework,
        language: actionAttrs.language,
        isComplete: false,
      });
      lastIndex = content.length;
      break;
    }
  }

  if (lastIndex < content.length) {
    segments.push({ type: "text", content: content.substring(lastIndex) });
  }

  return segments;
};

const SegmentRenderer = memo(
  ({
    segment,
    onTerminalPermission,
  }: {
    segment: any;
    onTerminalPermission?: (command: string) => void;
  }) => {
    const [isOpen, setIsOpen] = useState(false);

    if (segment.type === "text") {
      return (
        <div className="markdown-body prose prose-invert max-w-none text-sm prose-p:leading-relaxed prose-pre:bg-[#111] prose-pre:border prose-pre:border-white/5 prose-pre:p-4 prose-pre:rounded-xl overflow-x-hidden">
          <Markdown remarkPlugins={[remarkGfm]}>{segment.content}</Markdown>
        </div>
      );
    }

    if (segment.type === "think") {
      return (
        <div className="my-4 bg-white/5 border border-white/5 rounded-2xl overflow-hidden shadow-inner">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between p-3.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors bg-white/[0.02]"
          >
            <div className="flex items-center gap-3">
              {segment.isComplete ? (
                <Check className="w-4 h-4 text-white" />
              ) : (
                <Loader2 className="w-4 h-4 text-white animate-spin opacity-50" />
              )}
              <span>
                {segment.isComplete ? "Analysis Complete" : "Thinking..."}
              </span>
            </div>
            {isOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="p-4 pt-2 text-[11px] text-white/40 break-words whitespace-pre-wrap font-mono relative bg-black/20"
              >
                <div className="pl-4 border-l border-white/10 italic">
                  {segment.content}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    if (segment.type === "action") {
      const isWrite =
        segment.actionType === "write_file" ||
        (segment.file && !segment.actionType);
      const isRename = segment.actionType === "rename_file";
      const isDelete = segment.actionType === "delete_file";
      const isSearch = segment.actionType === "search";
      const isShell = segment.actionType === "shell";
      const isMetadata = segment.actionType === "metadata";

      return (
        <div className="border-t border-white/5 first:border-0 hover:bg-white/[0.02] transition-colors">
          <div className="w-full flex items-center justify-between py-3 px-4">
            <div className="flex items-center gap-3 text-xs font-medium text-white/80">
              {isWrite ? (
                <FileCode className="w-4 h-4 text-white" />
              ) : isShell ? (
                <Code2 className="w-4 h-4 text-white" />
              ) : isSearch ? (
                <Search className="w-4 h-4 text-white" />
              ) : isMetadata ? (
                <Zap className="w-4 h-4 text-white" />
              ) : (
                <Code2 className="w-4 h-4 text-white" />
              )}
              <span className="flex items-center flex-wrap gap-1">
                {isWrite
                  ? "Writing: "
                  : isRename
                    ? "Renaming: "
                    : isDelete
                      ? "Deleting: "
                      : isSearch
                        ? "Searching: "
                        : isShell
                          ? "Executing: "
                          : isMetadata
                            ? "Configuring: "
                            : "Task: "}
                <span className="font-mono text-white bg-white/10 px-1.5 rounded">
                  {segment.file || segment.actionType || "System"}
                </span>
                {segment.target && (
                  <span className="font-mono text-white/40">
                    {" "}
                    {"->"} {segment.target}
                  </span>
                )}
                {isMetadata && segment.framework && (
                  <span className="text-white/40"> ({segment.framework})</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {segment.isComplete ? (
                <Check className="w-4 h-4 text-white" />
              ) : (
                <Loader2 className="w-4 h-4 text-white animate-spin opacity-50" />
              )}
            </div>
          </div>
        </div>
      );
    }

    return null;
  },
  (prev, next) => {
    return (
      prev.segment.type === next.segment.type &&
      prev.segment.content === next.segment.content &&
      prev.segment.isComplete === next.segment.isComplete &&
      prev.segment.actionType === next.segment.actionType &&
      prev.segment.file === next.segment.file
    );
  },
);

const MessageRenderer = memo(
  ({
    content,
    onTerminalPermission,
  }: {
    content: string;
    onTerminalPermission?: (command: string) => void;
  }) => {
    const segments = parseMessageSegments(content);

    return (
      <div className="flex flex-col gap-3 w-full overflow-hidden">
        {segments.map((seg, i) => (
          <SegmentRenderer
            key={i}
            segment={seg}
            onTerminalPermission={onTerminalPermission}
          />
        ))}
      </div>
    );
  },
);

const getSystemPrompt = (framework: string) => {
  let frameworkRules = "";
  if (framework === "React") {
    frameworkRules = `
3. KODE REACT: Gunakan React + TypeScript (.tsx). Organisasikan kode ke dalam folder /src/components, /src/lib, dll.
4. STYLING: Gunakan Tailwind CSS. Hindari file CSS eksternal.
5. MODULARITY: Pecah logika besar menjadi komponen kecil yang reusable.
6. ADAPTASI: Jika file sudah ada (seperti App.tsx), EDIT file tersebut untuk mengintegrasikan fitur baru. Jangan hanya membuat file baru secara mentah.`;
  } else if (framework === "Next.js") {
    frameworkRules = `
3. KODE NEXT.JS: Gunakan App Router (folder /app).
4. SERVER & CLIENT: Gunakan 'use client' secara tepat.
5. INTEGRASI: Selalu periksa file layout.tsx atau page.tsx sebelum melakukan perubahan.`;
  } else if (framework === "Android") {
    frameworkRules = `
3. BAHASA & UI: Wajib 100% Kotlin. Gunakan Jetpack Compose untuk UI (deklaratif modern, hindari XML). Gunakan Kotlin Coroutines & Flow untuk Asynchronous & Threading.
4. FORMAT FILE & DISTRIBUSI: Gunakan .aab (Android App Bundle). Format gambar WebP atau Vector Drawable. Komunikasi data gunakan JSON (Moshi / Kotlinx Serialization).
5. ARSITEKTUR: Wajib pakai MVVM / MVI dengan Clean Architecture. Pisahkan UI Layer (Compose), State Holder (ViewModel), dan Data Layer (Repository).
6. PUSTAKA WAJIB:
   - Database Lokal: Room
   - API / Internet: Retrofit atau Ktor Client
   - Dependency Injection: Hilt
   - Gambar: Coil
7. BUILD SYSTEM: Gunakan Gradle dengan Kotlin DSL (build.gradle.kts).
8. INTERAKTIVITAS: Selalu sediakan state interaktif agar Web Emulator kami bisa mengekstrak dan menjalankan aplikasi secara interaktif.`;
  } else {
    frameworkRules = `
3. KODE HTML5: Fokus pada 'index.html' tapi bisa memecah ke file JS terpisah.
4. CDN: Gunakan Tailwind via CDN.`;
  }

  return `Anda adalah Senior Fullstack Engineer. Tugas Anda membantu user membangun aplikasi web berkualitas produksi.

ATURAN UTAMA:
1. GUNAKAN <action type="write_file" file="nama_file">: Semua kode wajib di dalam tag ini.
2. EDITING CERDAS: Prioritaskan MENGEDIT file yang sudah ada agar fitur baru terintegrasi dengan baik.
3. STRUKTUR PROFESIONAL: Gunakan folder yang rapi. 
4. KODE LENGKAP: Tulis kode fungsional dan utuh tanpa placeholder.
${frameworkRules}

ALUR KERJA:
1. Bedah permintaan user dan jelaskan rencana teknis Anda.
2. Tulis kalimat: "sekarang buatkan kode penuh tanpa error dan lengkap sesuai promt"
3. Terapkan perubahan kode menggunakan satu atau lebih tag <action>.

Gunakan Bahasa Indonesia yang profesional. Akhiri dengan [DONE].`;
};

interface FileNode {
  name: string;
  path: string;
  kind: "file" | "directory";
  children?: FileNode[];
}

const buildFileTree = (files: string[]): FileNode[] => {
  const root: FileNode[] = [];
  files.forEach((filePath) => {
    const parts = filePath.split("/");
    let currentLevel = root;
    parts.forEach((part, index) => {
      let node = currentLevel.find((n) => n.name === part);
      const isFile = index === parts.length - 1;
      const currentPath = parts.slice(0, index + 1).join("/");

      if (!node) {
        node = {
          name: part,
          path: currentPath,
          kind: isFile ? "file" : "directory",
          children: isFile ? undefined : [],
        };
        currentLevel.push(node);
      }
      if (node.children) {
        currentLevel = node.children;
      }
    });
  });

  const sortNodes = (nodes: FileNode[]) => {
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => {
      if (node.children) sortNodes(node.children);
    });
  };

  sortNodes(root);
  return root;
};

const getFileIcon = (fileName: string, isSelected: boolean) => {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const iconClass = cn(
    "w-3.5 h-3.5 shrink-0",
    isSelected ? "text-black" : "text-white/60",
  );

  if (fileName.includes("react") || extension === "tsx" || extension === "jsx")
    return (
      <SiReact className={iconClass} color={isSelected ? "black" : "#61DAFB"} />
    );
  if (extension === "ts")
    return (
      <SiTypescript
        className={iconClass}
        color={isSelected ? "black" : "#3178C6"}
      />
    );
  if (extension === "js")
    return (
      <SiJavascript
        className={iconClass}
        color={isSelected ? "black" : "#F7DF1E"}
      />
    );
  if (extension === "html")
    return (
      <SiHtml5 className={iconClass} color={isSelected ? "black" : "#E34F26"} />
    );
  if (extension === "css")
    return (
      <SiCss className={iconClass} color={isSelected ? "black" : "#1572B6"} />
    );
  if (extension === "json")
    return (
      <SiJson className={iconClass} color={isSelected ? "black" : "#CB3837"} />
    );
  if (extension === "md")
    return (
      <SiMarkdown
        className={iconClass}
        color={isSelected ? "black" : "#ffffff"}
      />
    );

  return <FileCode className={iconClass} />;
};

const FileTreeItem = ({
  node,
  activeFile,
  onSelect,
  onRename,
  onDelete,
  originalFiles = {},
  stagedFiles = null,
  depth = 0,
}: {
  node: FileNode;
  activeFile: string;
  onSelect: (path: string) => void;
  onRename: (path: string, e: React.MouseEvent) => void;
  onDelete: (path: string, e: React.MouseEvent) => void;
  originalFiles?: Record<string, string>;
  stagedFiles?: Record<string, string> | null;
  depth?: number;
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const isSelected = activeFile === node.path;

  const isNew = node.kind === "file" && !originalFiles[node.path];
  const isModified =
    node.kind === "file" &&
    originalFiles[node.path] !== undefined &&
    stagedFiles &&
    stagedFiles[node.path] !== originalFiles[node.path];

  if (node.kind === "directory") {
    return (
      <div className="flex flex-col">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 py-1 px-1.5 hover:bg-white/5 rounded text-[10px] font-bold uppercase tracking-widest text-white/40 transition-colors group cursor-pointer"
          style={{ paddingLeft: `${depth * 10 + 6}px` }}
        >
          {isOpen ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          <span className="truncate">{node.name}</span>
        </div>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden flex flex-col"
            >
              {node.children?.map((child) => (
                <FileTreeItem
                  key={child.path}
                  node={child}
                  activeFile={activeFile}
                  onSelect={onSelect}
                  onRename={onRename}
                  onDelete={onDelete}
                  originalFiles={originalFiles}
                  stagedFiles={stagedFiles}
                  depth={depth + 1}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -4 }}
      transition={{ duration: 0.15 }}
      onClick={() => onSelect(node.path)}
      className={cn(
        "flex items-center gap-1.5 py-1 px-1.5 rounded text-[11px] transition-all group relative overflow-hidden w-full cursor-pointer select-none",
        isSelected
          ? "text-black font-bold shadow-md bg-transparent"
          : "hover:bg-white/5 text-white/50",
      )}
      style={{ paddingLeft: `${depth * 10 + 16}px` }}
    >
      {isSelected && (
        <motion.div
          layoutId="activeFileHighlight"
          className="absolute inset-0 bg-white z-0 rounded"
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
        />
      )}

      <span className="relative z-10 flex items-center gap-1.5 w-full">
        {getFileIcon(node.name, isSelected)}
        <span className="truncate flex-1 min-w-0" title={node.name}>
          {node.name}
        </span>

        {isNew && (
          <span className="flex items-center justify-center w-3 h-3 bg-green-500 rounded-full text-[8px] text-white font-black shrink-0 relative z-20">
            +
          </span>
        )}
        {isModified && (
          <span className="w-2 h-2 bg-yellow-500 rounded-full shrink-0 relative z-20" />
        )}

        <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all ml-1 shrink-0 bg-transparent relative z-20">
          <span
            onClick={(e) => {
              e.stopPropagation();
              onRename(node.path, e);
            }}
            className={cn(
              "p-1 rounded transition-colors",
              isSelected
                ? "hover:bg-black/10 text-black/60"
                : "hover:bg-white/10 text-white/60",
            )}
          >
            <Edit2 className="w-2.5 h-2.5" />
          </span>
          <span
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.path, e);
            }}
            className={cn(
              "p-1 rounded transition-colors",
              isSelected
                ? "hover:bg-black/10 text-red-600"
                : "hover:bg-white/10 text-red-400",
            )}
          >
            <Trash2 className="w-2.5 h-2.5" />
          </span>
        </span>
      </span>
    </motion.div>
  );
};

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    projects,
    updateProjectFiles,
    addMessage,
    updateLastMessage,
    loadProjects,
    isLoaded,
    saveProject,
    updateProjectMetadata,
    aiRequestsToday,
    incrementAiRequests,
    aiLimit,
    dashscopeKey,
    setDashscopeKey,
    dashscopeModel,
    setDashscopeModel,
  } = useAppStore();

  const AI_DAILY_LIMIT = aiLimit;
  const AI_THRESHOLD = Math.max(0, aiLimit - 5);

  const project = useMemo(
    () => projects.find((p) => p.id === id),
    [id, projects],
  );
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const isGeneratingRef = useRef(false);
  const [currentIncompleteFile, setCurrentIncompleteFile] =
    useState<string>("");
  const [activeFile, setActiveFile] = useState<string>("");
  const [generationStatus, setGenerationStatus] = useState<string>("");
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [showGithubModal, setShowGithubModal] = useState(false);
  const [showVercelModal, setShowVercelModal] = useState(false);
  const [showDashscopeModal, setShowDashscopeModal] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const [viewMode, setViewMode] = useState<"code" | "preview" | "debug">(
    "code",
  );
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [editorInst, setEditorInst] = useState<any>(null);
  const [mlcProgress, setMlcProgress] = useState<{
    progress: number;
    text: string;
  } | null>(null);
  const [originalFiles, setOriginalFiles] = useState<Record<string, string>>(
    {},
  );

  const [stagedFiles, setStagedFiles] = useState<Record<string, string> | null>(
    null,
  );
  const [currentPlan, setCurrentPlan] = useState<string>("");
  const [showPlan, setShowPlan] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load project on mount if page refreshed
  useEffect(() => {
    if (!isLoaded && projects.length === 0) {
      loadProjects();
    }
  }, [isLoaded, projects.length, loadProjects]);

  useEffect(() => {
    const found = projects.find((p) => p.id === id);
    if (found && !activeFile) {
      const files = getActiveFiles();
      if (found.metadata.framework === "React" && files["App.tsx"]) {
        setActiveFile("App.tsx");
      } else if (
        found.metadata.framework === "Vanilla" &&
        files["index.html"]
      ) {
        setActiveFile("index.html");
      } else {
        const firstFile = Object.keys(files)[0];
        if (firstFile) setActiveFile(firstFile);
      }
    }
  }, [id, projects]); // Removed stagedFiles from dependency to prevent shifts during generation

  useEffect(() => {
    const files = getActiveFiles();
    // Only switch if the currently active file is completely gone from the project
    // and we are NOT in the middle of a generation that might be creating it.
    if (
      activeFile &&
      !files[activeFile] &&
      !isGenerating &&
      Object.keys(files).length > 0
    ) {
      setActiveFile(Object.keys(files)[0]);
    }
  }, [project?.files, stagedFiles, activeFile, isGenerating]);

  const normalizePath = (path: string) => path.replace(/^\//, "");

  const parseAndUpdateCode = async (
    markdown: string,
    isFinal: boolean = false,
  ) => {
    if (!id || !project) return;

    const currentFiles = { ...project.files };
    const segments = parseMessageSegments(markdown);

    let hasChanges = false;
    let incompleteFile = "";
    let currentStatus = "Thinking...";

    segments.forEach((seg) => {
      if (seg.type === "action" && seg.file) {
        const fileName = normalizePath(seg.file);

        if (seg.actionType === "write_file" || !seg.actionType) {
          if (!seg.isComplete) {
            incompleteFile = fileName;
            currentStatus = `Menulis ${fileName}...`;
          } else {
            currentStatus = `Menyelesaikan ${fileName}...`;
          }

          let fileContent = "";
          const match = seg.content.match(
            /```(?:[a-zA-Z0-9\-]+)?\n?([\s\S]*?)(?:```|$)/,
          );
          if (match) {
            fileContent = match[1];
          } else {
            fileContent = seg.content.trim();
          }

          if (currentFiles[fileName] !== fileContent) {
            currentFiles[fileName] = fileContent;
            hasChanges = true;
          }
        } else if (seg.isComplete) {
          if (seg.actionType === "rename_file" && seg.target) {
            const oldName = normalizePath(seg.file);
            const newName = normalizePath(seg.target);
            if (currentFiles[oldName]) {
              currentFiles[newName] = currentFiles[oldName];
              delete currentFiles[oldName];
              hasChanges = true;
            }
          } else if (seg.actionType === "delete_file") {
            const fileName = normalizePath(seg.file);
            if (currentFiles[fileName]) {
              delete currentFiles[fileName];
              hasChanges = true;
            }
          } else if (seg.actionType === "metadata") {
            if (id && (seg.framework || seg.language)) {
              updateProjectMetadata(id, {
                framework: seg.framework as any,
                language: seg.language as any,
              });
            }
          }
        }
      } else if (seg.type === "text" && !incompleteFile) {
        currentStatus = "Menganalisis langkah selanjutnya...";
      }
    });

    if (generationStatus !== currentStatus) {
      setGenerationStatus(currentStatus);
    }

    if (incompleteFile !== currentIncompleteFile) {
      setCurrentIncompleteFile(incompleteFile);
    }

    if (isFinal) {
      setGenerationStatus("");
      if (stagedFiles || hasChanges) {
        await updateProjectFiles(id, currentFiles);
      }
      setStagedFiles(null);
    } else if (hasChanges) {
      setStagedFiles(currentFiles);
    }
  };

  // Auto-trigger AI if there's only one user message (initial instructions)
  useEffect(() => {
    if (
      project &&
      project.messages.length === 1 &&
      project.messages[0].role === "user" &&
      !isGenerating &&
      isLoaded &&
      !isGeneratingRef.current
    ) {
      const timer = setTimeout(() => {
        handleSend("", true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [project?.id, project?.messages.length, isLoaded]);

  const handleSend = async (overrideInput?: string, isAutoTrigger = false) => {
    let fileContents = "";
    if (attachments.length > 0) {
      for (const file of attachments) {
        if (file.type.startsWith("image/")) {
          fileContents += `\n\n[🖼️ Gambar ${file.name} dilampirkan]`;
        } else {
          try {
            const text = await file.text();
            fileContents += `\n\n[📄 Dokumen: ${file.name}]\n${text.substring(0, 50000)}`;
          } catch (e) {
            console.error("Gagal membaca file", e);
          }
        }
      }
    }

    const textToSend = (overrideInput || input) + fileContents;
    if (!isAutoTrigger && !textToSend.trim()) return;
    if (!id || isGenerating) return;

    // Local throttling
    const now = Date.now();
    const lastRequest = localStorage.getItem("last_ai_request_time");
    if (lastRequest && now - parseInt(lastRequest) < 2000) {
      alert(
        "Mohon tunggu sebentar sebelum mengirim pesan berikutnya (Throttling).",
      );
      return;
    }
    localStorage.setItem("last_ai_request_time", now.toString());

    if (aiRequestsToday >= AI_DAILY_LIMIT) {
      addMessage(id, {
        id: uuidv4(),
        role: "assistant",
        content:
          "LIMIT_REACHED_NOTIFICATION_SHINE_ANDA_MELEBIHI_LIMIT_YANG_KAMI_TERAPKAN",
      });
      return;
    }

    if (aiRequestsToday === AI_THRESHOLD) {
      addMessage(id, {
        id: uuidv4(),
        role: "assistant",
        content: `⚠️ Pemberitahuan: Penggunaan resource AI Anda hampir mencapai ambang batas harian. Anda memiliki sisa ${AI_DAILY_LIMIT - AI_THRESHOLD} request lagi untuk hari ini.`,
      });
    }

    incrementAiRequests();

    if (!isAutoTrigger) {
      const userMessage: Message = {
        id: uuidv4(),
        role: "user",
        content: textToSend,
      };
      addMessage(id, userMessage);
    }

    setInput("");
    setAttachments([]);
    setStagedFiles(null); // Clear any stale typewriter files before starting a new request!
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setIsGenerating(true);
    setGenerationStatus("Menghubungkan...");
    let statusStage = 0;
    const stageTimer = setInterval(() => {
      statusStage++;
      if (statusStage === 1) setGenerationStatus("Memuat...");
      else if (statusStage === 2) setGenerationStatus("Menyiapkan Konteks...");
    }, 1500);

    isGeneratingRef.current = true;
    setOriginalFiles(project?.files || {});

    const aiMessage: Message = { id: uuidv4(), role: "assistant", content: "" };
    addMessage(id, aiMessage);

    try {
      const currentProj = useAppStore
        .getState()
        .projects.find((p) => p.id === id);
      const msgs = currentProj?.messages || [];
      const filesContext = Object.entries(currentProj?.files || {})
        .map(([path, content]) => `FILE: ${path}\n\`\`\`\n${content}\n\`\`\``)
        .join("\n\n");

      const history = [
        {
          role: "system" as const,
          content: `BERIKUT ADALAH STRUKTUR FILE SAAT INI:\n\n${filesContext}`,
        },
        ...msgs.slice(0, -1).map((m) => ({
          role: m.role as any,
          content: m.content,
        })),
      ];

      let fullContent = "";
      let lastUIUpdateTime = 0;

      const updateCallback = (content: string) => {
        if (!isGeneratingRef.current) return;
        fullContent = content;
        const now = Date.now();
        if (now - lastUIUpdateTime > 500) {
          const displayContent = fullContent.replace("[DONE]", "").trim();
          if (displayContent) {
            updateLastMessage(id, displayContent);
            parseAndUpdateCode(fullContent);
            setGenerationStatus("Sedang menulis..."); // It is actively writing output
          }
          lastUIUpdateTime = now;
        }
      };

      // WebLLM generateStream will handle loading if needed, but AppLoader already ensures it's loaded
      await webLLMService.generateStream(
        history,
        updateCallback,
        getSystemPrompt(project?.metadata.framework || "HTML5"),
        dashscopeKey,
        dashscopeModel,
      );

      if (!isGeneratingRef.current) return;

      // Update final content
      const cleanContent = fullContent.replace("[DONE]", "").trim();
      if (!cleanContent) {
        throw new Error(
          "Respon API LLM kosong atau terjadi kesalahan parsing.",
        );
      }
      updateLastMessage(id, cleanContent);
      await parseAndUpdateCode(fullContent, true);

      await saveProject(id);
      clearInterval(stageTimer);
      setGenerationStatus("");
      setIsGenerating(false);
      isGeneratingRef.current = false;
    } catch (error: any) {
      console.error("AI Error:", error);
      clearInterval(stageTimer);
      setGenerationStatus("");
      setIsGenerating(false);
      isGeneratingRef.current = false;
      setMlcProgress(null);

      const errorMessage = error.message || "Gagal menghubungi sistem.";
      const finalMessage = errorMessage.includes("token atau limit harian")
        ? errorMessage
        : `Error: ${errorMessage}`;

      updateLastMessage(id, finalMessage);
    }
  };

  const handleStop = () => {
    setIsGenerating(false);
    isGeneratingRef.current = false;
    // Auto-sync current progress on stop to keep it "live"
    if (stagedFiles && id && project) {
      updateProjectFiles(id, stagedFiles);
      setStagedFiles(null);
    }
  };

  const handleCreateFile = () => {
    if (!newFileName.trim() || !project || !id) {
      setIsCreatingFile(false);
      setNewFileName("");
      return;
    }
    const name = normalizePath(newFileName.trim());
    if (project.files[name]) {
      setIsCreatingFile(false);
      setNewFileName("");
      return;
    }
    updateProjectFiles(id, { ...project.files, [name]: "// New file\n" });
    setActiveFile(name);
    setIsCreatingFile(false);
    setNewFileName("");
  };

  const handleRenameFile = () => {
    if (!renamingFile || !renameValue.trim() || !project || !id) {
      setRenamingFile(null);
      setRenameValue("");
      return;
    }
    const newName = normalizePath(renameValue.trim());
    const oldName = normalizePath(renamingFile);
    if (newName === oldName) {
      setRenamingFile(null);
      setRenameValue("");
      return;
    }
    const newFiles = { ...project.files };
    newFiles[newName] = newFiles[oldName];
    delete newFiles[oldName];

    updateProjectFiles(id, newFiles);
    if (activeFile === oldName) {
      setActiveFile(newName);
    }
    setRenamingFile(null);
    setRenameValue("");
  };

  const startRename = (fileName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingFile(fileName);
    setRenameValue(fileName);
  };

  const debouncedUpdate = (val: string) => {
    if (!id || !project) return;

    setIsSaving(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      updateProjectFiles(id, {
        ...project.files,
        [activeFile]: val,
      }).then(() => {
        setIsSaving(false);
      });
    }, 1500);
  };

  const handleDeleteFile = (fileToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const fileName = normalizePath(fileToDelete);
    if (!project || !id) return;
    const newFiles = { ...project.files };
    delete newFiles[fileName];

    // Sync staged files if they exist to avoid the file "reappearing" from stale generation state
    if (stagedFiles) {
      const newStaged = { ...stagedFiles };
      delete newStaged[fileName];
      setStagedFiles(newStaged);
    }

    updateProjectFiles(id, newFiles);

    // Update active file if we deleted the current one
    if (activeFile === fileName) {
      const remainingFiles = Object.keys(newFiles);
      if (remainingFiles.length > 0) {
        setActiveFile(remainingFiles[0]);
      } else {
        setActiveFile("");
      }
    }
  };

  const handleDownload = async () => {
    if (!project) return;
    const zip = new JSZip();
    const activeFiles = getActiveFiles();
    Object.entries(activeFiles).forEach(([path, content]) => {
      zip.file(path, content);
    });
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `${project.name.toLowerCase().replace(/\s+/g, "-")}.zip`);
  };

  const handleRemake = () => {
    if (
      confirm(
        "Apakah Anda yakin ingin buat ulang (reset) proyek ini ke kondisi awal? Semua pesan chat dan file baru akan dihapus.",
      )
    ) {
      const files = {};

      if (id && project) {
        updateProjectFiles(id, files);
        // Clear messages
        const updatedProjects = useAppStore.getState().projects.map((p) => {
          if (p.id === id) return { ...p, messages: [] };
          return p;
        });
        useAppStore.setState({ projects: updatedProjects });
        localStorage.setItem(
          "ai_build_projects",
          JSON.stringify(updatedProjects),
        );

        setStagedFiles(null);
        setActiveFile("");
        window.location.reload();
      }
    }
  };

  const getActiveFiles = () => {
    if (stagedFiles && Object.keys(stagedFiles).length > 0) return stagedFiles;
    return project?.files || {};
  };
  const codeContent = getActiveFiles()[activeFile] || "";

  // Remove auto-scroll to bottom as it can be glitchy for users
  useEffect(() => {
    // Scroll handling moved to manual if needed or omitted for stability
  }, [codeContent, isGenerating, editorInst]);

  const [debouncedFiles, setDebouncedFiles] = useState<Record<string, string>>(
    {},
  );
  const decorationsRef = useRef<string[]>([]);

  useEffect(() => {
    if (isGenerating) {
      const timer = setTimeout(() => {
        setDebouncedFiles(getActiveFiles());
      }, 400);
      return () => clearTimeout(timer);
    } else {
      setDebouncedFiles(getActiveFiles());
    }
  }, [stagedFiles, project?.files, isGenerating]);

  // Handle Monaco Diff Decorations
  useEffect(() => {
    if (!editorInst || !activeFile) return;

    const originalContent = originalFiles[activeFile] || "";
    const currentLines = codeContent.split("\n");
    const originalLines = originalContent.split("\n");

    const newDecorations: any[] = [];

    // Simple line-by-line diff for gutter indicators
    currentLines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const originalLine = originalLines[idx];

      if (idx >= originalLines.length) {
        // New line at the end
        newDecorations.push({
          range: {
            startLineNumber: lineNum,
            startColumn: 1,
            endLineNumber: lineNum,
            endColumn: 1,
          },
          options: {
            isWholeLine: true,
            className: "diff-added-line",
            linesDecorationsClassName: "diff-added-gutter",
            description: "Line added",
          },
        });
      } else if (line !== originalLine) {
        // Line modified or new line inserted elsewhere
        newDecorations.push({
          range: {
            startLineNumber: lineNum,
            startColumn: 1,
            endLineNumber: lineNum,
            endColumn: 1,
          },
          options: {
            isWholeLine: true,
            className: "diff-modified-line",
            linesDecorationsClassName: "diff-modified-gutter",
            description: "Line modified",
          },
        });
      }
    });

    decorationsRef.current = editorInst.deltaDecorations(
      decorationsRef.current,
      newDecorations,
    );
  }, [codeContent, editorInst, activeFile, originalFiles]);

  const sandpackFiles = useMemo(() => {
    return Object.keys(debouncedFiles).length > 0
      ? Object.entries(debouncedFiles).reduce(
          (acc, [k, v]) => {
            acc[`/${k}`] = v;
            return acc;
          },
          {} as Record<string, string>,
        )
      : { "/App.tsx": "// Loading..." };
  }, [debouncedFiles]);

  // sandpackFiles removed

  // Show global loading if project is not yet found and we are still loading projects
  if (!project && !isLoaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0A0A0C] text-[#E0E0E0] gap-3">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        <span className="text-sm font-medium animate-pulse">
          Syncing project data...
        </span>
      </div>
    );
  }

  if (isLoaded && !project) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#0A0A0C] text-[#E0E0E0] gap-4">
        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/50">
          <X className="w-6 h-6 text-red-500" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold">Project Not Found</h2>
          <p className="text-sm text-[#88888E]">
            The project you are looking for does not exist or has been deleted.
          </p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-500 transition-all"
        >
          Back to Home
        </button>
      </div>
    );
  }

  // Memoized file tree to avoid unnecessary re-renders of the entire tree
  const fileTree = useMemo(() => {
    return buildFileTree(Object.keys(getActiveFiles()));
  }, [debouncedFiles]);

  return (
    <div className="flex h-screen bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] overflow-hidden font-sans">
      <PanelGroup direction="horizontal">
        {/* LEFT: Chat Area */}
        <Panel defaultSize={20} minSize={15}>
          <section className="h-full flex flex-col border-r border-white/5 bg-[var(--md-sys-color-surface)]">
            <div className="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-black/20 shrink-0">
              <button
                onClick={() => navigate("/")}
                className="text-white/40 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex flex-col items-end">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
                  Chat Engine
                </h2>
                <span className="text-[8px] font-bold text-blue-500/40 uppercase tracking-widest mt-0.5">
                  Sisa Limit: {AI_DAILY_LIMIT - aiRequestsToday}
                </span>
              </div>
            </div>

            <div className="flex-1 p-6 flex flex-col gap-8 overflow-y-auto custom-scrollbar">
              {project?.messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-4 py-10 opacity-40">
                  <Sparkles className="w-10 h-10 mb-4 text-white" />
                  <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-widest">
                    Editor Siap
                  </h3>
                  <p className="text-[11px] text-white/60">
                    Tulis permintaan Anda di bawah untuk mulai membangun.
                  </p>
                </div>
              )}

              {mlcProgress && (
                <div className="my-2 p-3 bg-blue-600/10 border border-blue-500/30 rounded-lg shrink-0">
                  <div className="flex items-center justify-between text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">
                    <span>Configuring Workspace...</span>
                    <span>{Math.round(mlcProgress.progress)}%</span>
                  </div>
                  <div className="h-1 bg-[#1A1A1E] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${mlcProgress.progress}%` }}
                    />
                  </div>
                </div>
              )}
              {project?.messages.map((msg) => (
                <div key={msg.id} className="flex flex-col gap-2">
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-widest",
                      msg.role === "user" ? "text-white/20" : "text-white/60",
                    )}
                  >
                    {msg.role === "user" ? "ANDA" : "AI ASSISTANT"}
                  </span>
                  <div
                    className={cn(
                      "text-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-white shadow-inner"
                        : "text-[#E0E0E0] py-2",
                    )}
                  >
                    {msg.role === "assistant" ? (
                      msg.content ===
                      "LIMIT_REACHED_NOTIFICATION_SHINE_ANDA_MELEBIHI_LIMIT_YANG_KAMI_TERAPKAN" ? (
                        <div className="p-8 rounded-3xl border border-red-500/20 bg-red-500/5 text-center font-bold text-white relative overflow-hidden group">
                          <ShieldAlert className="w-8 h-8 mx-auto mb-3 text-red-500/60" />
                          <p className="text-sm uppercase tracking-wider mb-1">
                            Limit Harian Tercapai
                          </p>
                          <p className="text-[10px] font-medium text-white/40 mb-6">
                            Anda telah mencapai batas {aiLimit} request. Silakan
                            tambahkan limit untuk melanjutkan.
                          </p>
                          <button
                            onClick={() => navigate("/add-limit")}
                            className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-xs font-black italic uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:scale-105 transition-all"
                          >
                            Upgraded
                          </button>
                        </div>
                      ) : msg.content ? (
                        <div className="relative group">
                          <MessageRenderer content={msg.content} />
                          {msg.role === "assistant" &&
                            !msg.content.includes("LIMIT_REACHED") && (
                              <div className="mt-4 flex justify-end">
                                <button
                                  onClick={() => navigate("/add-limit")}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[9px] font-bold text-blue-400 uppercase tracking-widest hover:bg-blue-500/20"
                                >
                                  <Plus className="w-3 h-3" />
                                  Upgraded
                                </button>
                              </div>
                            )}
                        </div>
                      ) : (
                        <ThinkingAnimation />
                      )
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {isGenerating &&
              generationStatus &&
              generationStatus !== "Sedang menulis..." && (
                <div className="mx-6 mb-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
                  <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                    {generationStatus}
                  </span>
                  <div className="flex-1 h-px bg-blue-500/10" />
                  <div className="flex gap-1">
                    <div className="w-1 h-1 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1 h-1 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" />
                  </div>
                </div>
              )}

            <div className="p-6 border-t border-white/5 shrink-0 bg-black/20 backdrop-blur-xl">
              {stagedFiles && !isGenerating && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-4 bg-white/[0.03] border border-white/10 rounded-2xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                      {Object.keys(stagedFiles).length} files ready
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (stagedFiles && id && project) {
                          updateProjectFiles(id, stagedFiles);
                          setOriginalFiles(stagedFiles);
                          setStagedFiles(null);
                        }
                      }}
                      className="px-4 py-1.5 bg-white text-black text-[9px] font-bold uppercase rounded-full hover:shadow-lg transition-all"
                    >
                      Sync Changes
                    </button>
                    <button
                      onClick={() => setStagedFiles(null)}
                      className="px-4 py-1.5 bg-white/5 text-white/40 text-[9px] font-bold uppercase rounded-full hover:bg-white/10 transition-all"
                    >
                      Discard
                    </button>
                  </div>
                </motion.div>
              )}
              <div className="relative group flex flex-col gap-2 bg-white/[0.03] border border-white/10 rounded-[1.5rem] p-2 pl-4 focus-within:border-white/20 transition-all">
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {attachments.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full text-xs text-white/80"
                      >
                        <span className="truncate max-w-[150px]">
                          {file.name}
                        </span>
                        <button
                          onClick={() =>
                            setAttachments((prev) =>
                              prev.filter((_, i) => i !== idx),
                            )
                          }
                          className="hover:text-red-400 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-3 w-full">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 text-white/40 hover:text-white transition-colors shrink-0"
                    title="Upload File"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    hidden
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        setAttachments((prev) => [
                          ...prev,
                          ...Array.from(e.target.files!),
                        ]);
                      }
                      e.target.value = "";
                    }}
                  />
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    disabled={isGenerating}
                    placeholder="Apa yang ingin Anda bangun?"
                    className="flex-1 bg-transparent border-none py-3 text-sm focus:outline-none min-h-[44px] max-h-[40vh] placeholder-white/20 text-white leading-relaxed resize-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    rows={1}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = "auto";
                      target.style.height = `${target.scrollHeight}px`;
                    }}
                  ></textarea>
                  <div className="flex items-center gap-2 pb-1 pr-1">
                    {aiRequestsToday >= AI_THRESHOLD && !isGenerating && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-400/10 rounded-full mr-2">
                        <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                        <span className="text-[10px] font-bold text-red-500">
                          {AI_DAILY_LIMIT - aiRequestsToday} limit sisa
                        </span>
                      </div>
                    )}
                    {isGenerating ? (
                      <button
                        onClick={handleStop}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-bold rounded-full transition-all border border-red-500/20"
                      >
                        <X className="w-4 h-4" />
                        STOP
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSend()}
                        disabled={!input.trim()}
                        className={cn(
                          "p-3 rounded-full transition-all",
                          input.trim()
                            ? "bg-white text-black hover:scale-105 shadow-[0_8px_20px_rgba(255,255,255,0.1)]"
                            : "bg-white/5 text-white/10 cursor-not-allowed opacity-20",
                        )}
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </Panel>

        <PanelResizeHandle className="w-[1px] bg-white/5 hover:bg-white transition-colors cursor-col-resize" />

        {/* MIDDLE: File Explorer Panel */}
        <Panel defaultSize={15} minSize={6}>
          <section className="h-full flex flex-col border-r border-white/5 bg-[var(--md-sys-color-surface)]">
            <div className="h-16 px-4 flex items-center justify-between border-b border-white/5 bg-black/20 shrink-0">
              <h2 className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/30">
                Root
              </h2>
              <button
                onClick={() => setIsCreatingFile(true)}
                className="p-1.5 text-white/30 hover:text-white transition-colors rounded-full hover:bg-white/5"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 p-2 overflow-y-auto custom-scrollbar space-y-0.5">
              {fileTree.map((node) => (
                <FileTreeItem
                  key={node.path}
                  node={node}
                  activeFile={activeFile}
                  onSelect={setActiveFile}
                  onRename={startRename}
                  onDelete={handleDeleteFile}
                  originalFiles={originalFiles}
                  stagedFiles={stagedFiles}
                />
              ))}

              {isCreatingFile && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-2 p-3 bg-black border border-white/10 rounded-xl space-y-2"
                >
                  <input
                    autoFocus
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateFile()}
                    placeholder="path/name.tsx"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white outline-none focus:border-white/30"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleCreateFile}
                      className="md-button-filled flex-1 !py-1 !text-[8px]"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setIsCreatingFile(false)}
                      className="md-button-tonal !px-2 !py-1 !text-[8px]"
                    >
                      X
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </section>
        </Panel>

        <PanelResizeHandle className="w-[1px] bg-white/5 hover:bg-white transition-colors cursor-col-resize" />

        <Panel defaultSize={65} minSize={30}>
          {/* RIGHT: Monaco Editor Pane */}
          <section className="h-full flex flex-col bg-[#050505] overflow-hidden">
            <div className="h-16 border-b border-white/5 flex items-center justify-between bg-black/40 px-6 shrink-0">
              <div className="flex items-center h-full gap-4">
                <div className="flex items-center gap-3 px-1 py-1 rounded-2xl bg-white/5 border border-white/10">
                  <div className="bg-white text-black px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest">
                    Editor
                  </div>
                  <div className="text-white/40 px-3 py-1.5 text-[10px] font-mono truncate max-w-[200px]">
                    {activeFile}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 border-x border-white/5 px-4 h-8">
                  <button
                    title="Download Project ZIP"
                    onClick={handleDownload}
                    className="p-2 text-white/40 hover:text-white transition-colors rounded-full hover:bg-white/5"
                  >
                    <Download className="w-4.5 h-4.5" />
                  </button>
                  <button
                    title="Workspace Config"
                    onClick={() => setShowDashscopeModal(true)}
                    className="p-2 text-white/40 hover:text-white transition-colors rounded-full hover:bg-white/5"
                  >
                    <Settings2 className="w-4.5 h-4.5" />
                  </button>
                </div>

                <div className="flex items-center bg-white/5 p-1 rounded-full border border-white/10">
                  <button
                    onClick={() => setViewMode("code")}
                    className={cn(
                      "p-2 rounded-full transition-all",
                      viewMode === "code"
                        ? "bg-white text-black shadow-lg"
                        : "text-white/40 hover:text-white",
                    )}
                    title="Kode"
                  >
                    <Code2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("preview")}
                    className={cn(
                      "p-2 rounded-full transition-all",
                      viewMode === "preview"
                        ? "bg-white text-black shadow-lg"
                        : "text-white/40 hover:text-white",
                    )}
                    title="Preview"
                  >
                    <Monitor className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => window.location.reload()}
                  title="Refresh Editor"
                  className="p-2 text-white/40 hover:text-white transition-colors rounded-full hover:bg-white/5"
                >
                  <Loader2 className="w-4.5 h-4.5" />
                </button>

                <button
                  onClick={handleRemake}
                  title="Buat Ulang Proyek (Reset)"
                  className="p-2 text-red-400 hover:text-red-300 transition-colors rounded-full hover:bg-red-500/10"
                >
                  <SkipForward className="w-4.5 h-4.5" />
                </button>

                <button
                  onClick={handleDownload}
                  title="Download ZIP"
                  className="p-2 text-white/40 hover:text-white transition-colors rounded-full hover:bg-white/5"
                >
                  <Download className="w-4.5 h-4.5" />
                </button>

                <button className="md-button-filled !px-4 !py-2 !text-[10px] !uppercase !font-bold !tracking-[0.2em] flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  Publish
                </button>
              </div>
            </div>

            <div className="flex-1 relative overflow-hidden">
              {!activeFile && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#09090b] text-center p-8 border border-white/5">
                  <div className="w-16 h-16 rounded-3xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 mb-6">
                    <Sparkles className="w-8 h-8 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-black uppercase tracking-widest text-white mb-2">
                    Editor Kosong
                  </h3>
                  <p className="text-white/40 text-xs max-w-sm leading-relaxed mb-6">
                    Silakan buat file baru menggunakan ikon{" "}
                    <span className="text-white font-bold inline-flex items-center">
                      +
                    </span>{" "}
                    di samping header <b>Root</b> (File Explorer) atau gunakan
                    AI Coding Asisten di panel kiri untuk mulai menulis kode.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsCreatingFile(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-white text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-white/90 transition-all active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Buat File Baru
                    </button>
                  </div>
                </div>
              )}

              <div
                className={cn(
                  "absolute inset-0 z-20 bg-[#000000] transition-opacity duration-300",
                  viewMode === "code"
                    ? "opacity-100 pointer-events-auto"
                    : "opacity-0 pointer-events-none",
                )}
              >
                <MonacoEditor
                  height="100%"
                  width="100%"
                  language={
                    activeFile.endsWith(".html")
                      ? "html"
                      : activeFile.endsWith(".js") ||
                          activeFile.endsWith(".jsx")
                        ? "javascript"
                        : activeFile.endsWith(".ts") ||
                            activeFile.endsWith(".tsx")
                          ? "typescript"
                          : activeFile.endsWith(".css")
                            ? "css"
                            : activeFile.endsWith(".md")
                              ? "markdown"
                              : activeFile.endsWith(".json")
                                ? "json"
                                : "html"
                  }
                  theme="vs-dark"
                  value={codeContent}
                  onMount={(editor) => setEditorInst(editor)}
                  options={{
                    minimap: { enabled: true },
                    fontSize: 14,
                    lineHeight: 22,
                    padding: { top: 12, bottom: 12 },
                    wordWrap: "on",
                    smoothScrolling: true,
                    cursorBlinking: "blink",
                    readOnly:
                      isGenerating && activeFile === currentIncompleteFile,
                    scrollbar: {
                      vertical: "visible",
                      horizontal: "visible",
                      useShadows: false,
                      verticalScrollbarSize: 10,
                      horizontalScrollbarSize: 10,
                    },
                    renderLineHighlight: "all",
                    folding: true,
                    automaticLayout: true,
                    tabSize: 2,
                  }}
                  onChange={(val) => {
                    if (val !== undefined) {
                      debouncedUpdate(val);
                    }
                  }}
                />
                {isSaving && (
                  <div className="absolute bottom-6 right-6 flex items-center gap-2 px-3 py-1.5 bg-black/40 border border-white/10 rounded-full backdrop-blur-md z-30 transition-all">
                    <Loader2 className="w-3 h-3 text-white/40 animate-spin" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">
                      Saving Changes...
                    </span>
                  </div>
                )}
              </div>

              <div
                className={cn(
                  "absolute inset-0 z-10 bg-[#1E1E22] transition-opacity duration-200",
                  viewMode === "preview" || viewMode === "debug"
                    ? "opacity-100 pointer-events-auto"
                    : "opacity-0 pointer-events-none",
                )}
              >
                <div className="w-full h-full relative">
                  <div
                    className={cn(
                      "w-full h-full",
                      viewMode === "preview" ? "block" : "hidden",
                    )}
                  >
                    <Preview
                      files={debouncedFiles}
                      activeFile={activeFile}
                      framework={project?.metadata.framework}
                      projectName={project?.name}
                      isGenerating={isGenerating}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </Panel>
      </PanelGroup>

      <AnimatePresence>
        {showGithubModal && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[var(--md-sys-color-surface-variant)] border border-white/10 rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden relative"
            >
              <button
                onClick={() => setShowGithubModal(false)}
                className="absolute top-6 right-6 p-2 text-white/40 hover:text-white transition-colors rounded-full hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-10">
                <div className="flex flex-col items-center text-center mb-8">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-white flex items-center justify-center mb-4">
                    <Github className="w-8 h-8 text-black" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white uppercase italic tracking-tight">
                      Sync GitHub
                    </h3>
                    <p className="text-xs text-white/40 mt-1">
                      Export your code to a secure repository.
                    </p>
                  </div>
                </div>

                {!isFinishing ? (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/20 ml-2">
                        Repo Name
                      </label>
                      <input
                        type="text"
                        defaultValue={project?.name
                          .toLowerCase()
                          .replace(/\s+/g, "-")}
                        className="w-full bg-black border border-white/5 rounded-2xl px-5 py-3 text-sm text-white focus:border-white/20 outline-none transition-colors"
                      />
                    </div>

                    <div className="p-5 bg-white/[0.02] rounded-2xl border border-white/5 border-dashed">
                      <p className="text-[11px] text-white/30 leading-relaxed text-center">
                        Proses ini akan membuat repository publik baru dan
                        mengunggah seluruh struktur proyek Anda.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setIsFinishing(true);
                        const steps = 5;
                        let current = 0;
                        const interval = setInterval(() => {
                          current++;
                          setActiveStep(current);
                          if (current === steps) clearInterval(interval);
                        }, 1200);
                      }}
                      className="md-button-filled w-full !rounded-2xl flex items-center justify-center gap-2"
                    >
                      Create & Push Repo
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6 py-4">
                    <div className="space-y-4">
                      {[
                        "Authenticating Session...",
                        "Generating Repository...",
                        "Bundling Manifest...",
                        "Finalizing Remote Push...",
                        "Success! Workspace Merged.",
                      ].map((step, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{
                            opacity: idx <= activeStep ? 1 : 0.2,
                            x: 0,
                          }}
                          className="flex items-center gap-4"
                        >
                          {idx < activeStep ? (
                            <div className="w-6 h-6 rounded-full bg-white text-black flex items-center justify-center">
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          ) : idx === activeStep ? (
                            <div className="w-6 h-6 flex items-center justify-center">
                              <Loader2 className="w-5 h-5 text-white animate-spin opacity-50" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full border border-white/10" />
                          )}
                          <span
                            className={cn(
                              "text-xs font-medium uppercase tracking-tight",
                              idx <= activeStep
                                ? "text-white"
                                : "text-white/20",
                            )}
                          >
                            {step}
                          </span>
                        </motion.div>
                      ))}
                    </div>

                    {activeStep >= 4 && (
                      <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => setShowGithubModal(false)}
                        className="md-button-tonal w-full !rounded-2xl mt-4 flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Buka di GitHub
                      </motion.button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* VERCEL MODAL */}
      <AnimatePresence>
        {showVercelModal && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[var(--md-sys-color-surface-variant)] border border-white/10 rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden relative"
            >
              <button
                onClick={() => setShowVercelModal(false)}
                className="absolute top-6 right-6 p-2 text-white/40 hover:text-white transition-colors rounded-full hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-10">
                <div className="flex flex-col items-center text-center mb-8">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-black border border-white/10 flex items-center justify-center mb-4">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white uppercase italic tracking-tight">
                      Deploy Vercel
                    </h3>
                    <p className="text-xs text-white/40 mt-1">
                      Ship your application to production.
                    </p>
                  </div>
                </div>

                {!isFinishing ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-2xl border border-white/5">
                      <div className="flex items-center gap-4">
                        <Box className="w-6 h-6 text-white" />
                        <div>
                          <p className="text-xs font-bold text-white uppercase tracking-tight">
                            Identity
                          </p>
                          <p className="text-[10px] text-white/40 font-mono italic">
                            {project?.name.toLowerCase().replace(/\s+/g, "-")}
                            .vercel.app
                          </p>
                        </div>
                      </div>
                      <Sparkles className="w-4 h-4 text-white opacity-20" />
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-[10px] text-white/20 font-bold uppercase tracking-widest ml-1">
                        <ArrowRight className="w-3 h-3" /> Runtime Options
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-[10px] font-bold uppercase">
                        <div className="p-3 rounded-xl bg-black border border-white/5 text-center">
                          <span className="text-white/20">Framework:</span>{" "}
                          <span className="text-white ml-1">React</span>
                        </div>
                        <div className="p-3 rounded-xl bg-black border border-white/5 text-center">
                          <span className="text-white/20">Node:</span>{" "}
                          <span className="text-white ml-1">20.x</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setIsFinishing(true);
                        const steps = 6;
                        let current = 0;
                        const interval = setInterval(() => {
                          current++;
                          setActiveStep(current);
                          if (current === steps) clearInterval(interval);
                        }, 900);
                      }}
                      className="md-button-filled w-full !rounded-2xl shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                    >
                      Deploy Now
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6 py-2">
                    <div className="relative">
                      {activeStep < 5 && (
                        <div className="absolute top-0 right-0">
                          <Loader2 className="w-5 h-5 text-white animate-spin opacity-40" />
                        </div>
                      )}
                      <div className="space-y-4">
                        {[
                          "Bundling project assets...",
                          "Uploading files (Edge)...",
                          "Running build command...",
                          "Optimizing images...",
                          "Finalizing deployment...",
                          "Deployment is live!",
                        ].map(
                          (step, idx) =>
                            idx <= activeStep && (
                              <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-4"
                              >
                                {idx < 5 ? (
                                  <div
                                    className={cn(
                                      "w-1 h-8 rounded-full transition-colors duration-500",
                                      idx < activeStep
                                        ? "bg-white"
                                        : "bg-white/20 animate-pulse",
                                    )}
                                  />
                                ) : (
                                  <div className="w-1.5 h-10 rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.4)]" />
                                )}
                                <div className="flex flex-col">
                                  <span
                                    className={cn(
                                      "text-xs font-bold uppercase tracking-tight",
                                      idx === 5
                                        ? "text-white"
                                        : "text-white/40",
                                    )}
                                  >
                                    {step}
                                  </span>
                                  <span className="text-[9px] text-white/10 font-mono uppercase tracking-widest">
                                    Logic-Worker-{idx}
                                  </span>
                                </div>
                              </motion.div>
                            ),
                        )}
                      </div>
                    </div>

                    {activeStep >= 5 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="pt-4"
                      >
                        <button
                          onClick={() => setShowVercelModal(false)}
                          className="md-button-tonal w-full !rounded-2xl flex items-center justify-center gap-3"
                        >
                          Visit Live Site
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DASHSCOPE CONFIG MODAL */}
      <AnimatePresence>
        {showDashscopeModal && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[var(--md-sys-color-surface-variant)] border border-white/10 rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden relative"
            >
              <button
                onClick={() => setShowDashscopeModal(false)}
                className="absolute top-8 right-8 p-2 text-white/40 hover:text-white transition-colors rounded-full hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-10">
                <div className="flex flex-col items-center text-center mb-8">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-black border border-white/10 flex items-center justify-center mb-4">
                    <ShieldCheck className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white uppercase italic tracking-tight">
                      AI Configuration
                    </h3>
                    <p className="text-xs text-white/40 mt-1">
                      Configure your Alibaba DashScope credentials.
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/20 ml-1">
                      API Key (DashScope)
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        value={dashscopeKey || ""}
                        onChange={(e) => setDashscopeKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-white/30 transition-all font-mono"
                      />
                    </div>
                    <p className="text-[9px] text-white/20 leading-relaxed px-1">
                      Kunci API Anda akan disimpan secara lokal di browser Anda.
                      Kunci ini diperlukan untuk memanggil model Qwen lewat
                      Logic Studio backend.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/20 ml-1">
                      PILIH MODEL QWEN
                    </label>
                    <div className="relative">
                      <select
                        value={dashscopeModel}
                        onChange={(e) => setDashscopeModel(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-white/30 transition-all cursor-pointer appearance-none font-sans"
                      >
                        <option value="qwen-plus">
                          Qwen Plus (Rekomendasi Utama - Seimbang & Cerdas)
                        </option>
                        <option value="qwen-max">
                          Qwen Max (Sangat Cerdas & Kreatif)
                        </option>
                        <option value="qwen-turbo">
                          Qwen Turbo (Sangat Cepat)
                        </option>
                      </select>
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-white/40">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-[9px] text-white/20 leading-relaxed px-1">
                      Model **Qwen** dioptimalkan secara mendalam untuk
                      reasoning tingkat tinggi, instruksi kompleks, dan
                      pemrograman kreatif berstandar industri.
                    </p>
                  </div>

                  <button
                    onClick={() => setShowDashscopeModal(false)}
                    className="md-button-filled w-full !rounded-2xl shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                  >
                    Simpan Konfigurasi
                  </button>

                  <div className="pt-4 border-t border-white/5">
                    <p className="text-[10px] text-center text-white/40">
                      Butuh API Key?{" "}
                      <a
                        href="https://dashscope.console.aliyun.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-white hover:underline underline-offset-4"
                      >
                        Daftar di Alibaba Cloud
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
