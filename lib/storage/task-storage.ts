// File info type definition
export interface FileInfo {
  path: string;
  content?: string;
  size: number;
  timestamp?: string;
  modified_at?: string;
  operation?: string;
  lastAccessed?: string;
}

// Task type definition
export interface Task {
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  stage: string;
  logs: Array<{ time: string; message: string }>;
  todos?: Array<{ content: string; status: string; id?: string }>;
  files?: Record<string, FileInfo>;
  toolCalls?: Array<{ name: string; timestamp: string; args: any; output?: any }>;
}

// Progress callback type
export interface ProgressCallback {
  (progress: { stage: string; progress: number; log: string }): void;
}

// Use globalThis to persist data across hot reloads in development
// In production, use Redis or database instead
declare global {
  var __activeTasks: Map<string, Task> | undefined;
  var __progressCallbacks: Map<string, ProgressCallback> | undefined;
  var __currentTaskId: string | null | undefined;
}

// Store active research tasks (persists across hot reloads)
export const activeTasks = globalThis.__activeTasks ?? new Map<string, Task>();
if (!globalThis.__activeTasks) {
  globalThis.__activeTasks = activeTasks;
  console.log('[TaskStorage] 初始化 activeTasks Map');
}

// Store progress callbacks for each task (persists across hot reloads)
export const progressCallbacks = globalThis.__progressCallbacks ?? new Map<string, ProgressCallback>();
if (!globalThis.__progressCallbacks) {
  globalThis.__progressCallbacks = progressCallbacks;
  console.log('[TaskStorage] 初始化 progressCallbacks Map');
}

// Track current executing task ID
let currentTaskId: string | null = globalThis.__currentTaskId ?? null;

// Set current task ID
export function setCurrentTaskId(taskId: string | null): void {
  currentTaskId = taskId;
  globalThis.__currentTaskId = taskId;
}

// Get current task ID
export function getCurrentTaskId(): string | null {
  return currentTaskId ?? globalThis.__currentTaskId ?? null;
}

