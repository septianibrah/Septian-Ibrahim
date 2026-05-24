import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ProjectMetadata {
  language: 'TypeScript' | 'JavaScript' | 'Python' | 'Go' | 'Rust' | 'HTML5' | 'Kotlin' | 'Dart';
  framework: 'React' | 'HTML5' | 'Next.js' | 'Vanilla' | 'Android';
  bundler: 'Vite' | 'None';
  type: 'Web App' | 'Single Page' | 'Next.js Project' | 'Mobile App';
}

export interface Project {
  id: string;
  userId?: string;
  name: string;
  files: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  metadata: ProjectMetadata; // Made metadata required
  planningPhase?: boolean;
}

interface AppState {
  projects: Project[];
  isLoaded: boolean;
  activeProjectId: string | null;
  loadProjects: () => Promise<void>;
  createProject: (name: string, metadata: ProjectMetadata) => Promise<Project>;
  setActiveProject: (id: string | null) => void;
  updateProjectFiles: (id: string, files: Record<string, string>) => Promise<void>;
  addMessage: (id: string, message: Message) => Promise<void>;
  updateLastMessage: (id: string, content: string) => Promise<void>;
  updateProjectMetadata: (id: string, metadata: Partial<ProjectMetadata>) => Promise<void>;
  saveProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  isSetupComplete: boolean;
  setSetupComplete: (complete: boolean) => void;
  isEngineReady: boolean;
  setEngineReady: (ready: boolean) => void;
  terminalLogs: string[];
  addTerminalLog: (log: string) => void;
  aiRequestsToday: number;
  aiLimit: number;
  lastDailyClaim: string | null;
  incrementAiRequests: () => void;
  claimDailyBonus: () => boolean;
  redeemSecretCode: (code: string) => boolean;
  addAiLimit: (amount: number) => void;
  dashscopeKey: string | null;
  setDashscopeKey: (key: string | null) => void;
  dashscopeModel: string;
  setDashscopeModel: (model: string) => void;
  nativeBridgeKey: string | null;
  setNativeBridgeKey: (key: string | null) => void;
}

const STORAGE_KEY = 'ai_build_projects';
const SETUP_KEY = 'ai_build_setup_complete';
const RESOURCE_KEY = 'ai_build_resource_usage';

export const useAppStore = create<AppState>((set, get) => ({
  projects: [],
  isLoaded: false,
  activeProjectId: null,
  isSetupComplete: true,
  isEngineReady: true,
  terminalLogs: [],
  aiRequestsToday: 0,
  aiLimit: 20,
  lastDailyClaim: localStorage.getItem('ai_build_last_daily_claim'),
  dashscopeKey: localStorage.getItem('ai_build_dashscope_key'),
  setDashscopeKey: (key) => {
    if (key) localStorage.setItem('ai_build_dashscope_key', key);
    else localStorage.removeItem('ai_build_dashscope_key');
    set({ dashscopeKey: key });
  },
  dashscopeModel: localStorage.getItem('ai_build_dashscope_model') || 'qwen-plus',
  setDashscopeModel: (model) => {
    localStorage.setItem('ai_build_dashscope_model', model);
    set({ dashscopeModel: model });
  },
  nativeBridgeKey: localStorage.getItem('ai_build_nativebridge_key'),
  setNativeBridgeKey: (key) => {
    if (key) localStorage.setItem('ai_build_nativebridge_key', key);
    else localStorage.removeItem('ai_build_nativebridge_key');
    set({ nativeBridgeKey: key });
  },
  claimDailyBonus: () => {
    const today = new Date().toDateString();
    const lastClaim = get().lastDailyClaim;
    if (lastClaim !== today) {
      const newLimit = get().aiLimit + 5;
      set({ aiLimit: newLimit, lastDailyClaim: today });
      localStorage.setItem('ai_build_last_daily_claim', today);
      localStorage.setItem('ai_build_ai_limit', newLimit.toString());
      return true;
    }
    return false;
  },
  redeemSecretCode: (code: string) => {
    // Hidden logic for secret codes
    const validCodes = ['SECRET12', 'LOGIC12'];
    if (validCodes.includes(code.toUpperCase())) {
      const newLimit = get().aiLimit + 12;
      set({ aiLimit: newLimit });
      localStorage.setItem('ai_build_ai_limit', newLimit.toString());
      return true;
    }
    return false;
  },
  addAiLimit: (amount: number) => {
    const newLimit = get().aiLimit + amount;
    set({ aiLimit: newLimit });
    localStorage.setItem('ai_build_ai_limit', newLimit.toString());
  },
  incrementAiRequests: () => {
    const current = get().aiRequestsToday;
    const next = current + 1;
    set({ aiRequestsToday: next });
    localStorage.setItem(RESOURCE_KEY, JSON.stringify({
      count: next,
      lastReset: new Date().toDateString()
    }));
  },
  addTerminalLog: (log) => set((state) => ({ terminalLogs: [...state.terminalLogs, log] })),
  setSetupComplete: (complete) => {
    localStorage.setItem(SETUP_KEY, complete.toString());
    set({ isSetupComplete: complete });
  },
  setEngineReady: (ready) => set({ isEngineReady: ready }),
  
  loadProjects: async () => {
    // Load resource usage first
    const savedUsage = localStorage.getItem(RESOURCE_KEY);
    const savedLimit = localStorage.getItem('ai_build_ai_limit');
    
    if (savedLimit) {
      set({ aiLimit: parseInt(savedLimit) });
    }

    if (savedUsage) {
      try {
        const { count, lastReset } = JSON.parse(savedUsage);
        if (lastReset === new Date().toDateString()) {
          set({ aiRequestsToday: count });
        } else {
          // Reset if it's a new day
          set({ aiRequestsToday: 0 });
          localStorage.setItem(RESOURCE_KEY, JSON.stringify({
            count: 0,
            lastReset: new Date().toDateString()
          }));
        }
      } catch (e) {
        set({ aiRequestsToday: 0 });
      }
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const projects = JSON.parse(raw);
        set({ projects, isLoaded: true });
      } catch (e) {
        console.error('Failed to parse projects', e);
        set({ projects: [], isLoaded: true });
      }
    } else {
      set({ projects: [], isLoaded: true });
    }
  },
  
  createProject: async (name, metadata) => {
    let initialFiles: Record<string, string> = {};



    const newProject: Project = {
      id: uuidv4(),
      userId: 'local',
      name,
      metadata,
      files: initialFiles,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    
    const newProjects = [newProject, ...get().projects];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newProjects));
    set({ projects: newProjects, activeProjectId: newProject.id });
    
    return newProject;
  },
  
  setActiveProject: (id) => set({ activeProjectId: id }),
  
  updateProjectFiles: async (id, files) => {
    const newProjects = get().projects.map(p => {
      if (p.id === id) {
        return { ...p, files, updatedAt: new Date().toISOString() };
      }
      return p;
    });
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newProjects));
    set({ projects: newProjects });
  },
  
  addMessage: async (id, message) => {
    const newProjects = get().projects.map(p => {
      if (p.id === id) {
        return { ...p, messages: [...p.messages, message], updatedAt: new Date().toISOString() };
      }
      return p;
    });
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newProjects));
    set({ projects: newProjects });
  },
  
  updateLastMessage: async (id, content) => {
    const newProjects = get().projects.map(p => {
      if (p.id === id && p.messages.length > 0) {
        const newMessages = [...p.messages];
        newMessages[newMessages.length - 1] = {
          ...newMessages[newMessages.length - 1],
          content
        };
        return { ...p, messages: newMessages, updatedAt: new Date().toISOString() };
      }
      return p;
    });
    set({ projects: newProjects });
  },
  
  updateProjectMetadata: async (id, metadata) => {
    const newProjects = get().projects.map(p => {
      if (p.id === id) {
        return { ...p, metadata: { ...p.metadata, ...metadata } as ProjectMetadata, updatedAt: new Date().toISOString() };
      }
      return p;
    });
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newProjects));
    set({ projects: newProjects });
  },
  
  saveProject: async (id) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(get().projects));
  },
  
  deleteProject: async (id) => {
    const newProjects = get().projects.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newProjects));
    set({ 
      projects: newProjects, 
      activeProjectId: get().activeProjectId === id ? null : get().activeProjectId 
    });
  }
}));
