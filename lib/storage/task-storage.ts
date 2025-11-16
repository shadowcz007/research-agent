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

// Todo type definition with support for nested sub-tasks
export interface Todo {
  content: string;
  status: string;
  id?: string;
  sub_todos?: Todo[];  // 子任务列表，支持嵌套结构
}

// Task type definition
export interface Task {
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  stage: string;
  logs: Array<{ time: string; message: string }>;
  todos?: Todo[];
  files?: Record<string, FileInfo>;
  toolCalls?: Array<{ name: string; timestamp: string; args: any; output?: any }>;
  // 新增：最终状态字段
  finalProgress?: number;
  finalStatus?: "completed" | "failed";
  finalStage?: string;
  // 新增：取消标志
  cancelled?: boolean;
}

// Todo 统计接口
export interface TodoStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
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

// 统计 todos（包括嵌套子任务）
export function countTodos(todos: Todo[]): TodoStats {
  let total = 0;
  let completed = 0;
  let inProgress = 0;
  let pending = 0;
  
  for (const todo of todos) {
    total++;
    if (todo.status === "completed") completed++;
    if (todo.status === "in_progress") inProgress++;
    if (todo.status === "pending") pending++;
    
    // 递归统计子任务
    if (todo.sub_todos && todo.sub_todos.length > 0) {
      const subCounts = countTodos(todo.sub_todos);
      total += subCounts.total;
      completed += subCounts.completed;
      inProgress += subCounts.inProgress;
      pending += subCounts.pending;
    }
  }
  
  return { total, completed, inProgress, pending };
}

// 获取阶段进度（降级方案）
export function getPhaseProgress(stage: string): number {
  const phaseMap: Record<string, number> = {
    "初始化": 5,
    "开始研究": 15,
    "搜索资料": 30,
    "分析数据": 50,
    "撰写报告": 80,
    "提取报告": 90,
    "完成": 100,
  };
  return phaseMap[stage] || 20;
}

// 计算任务进度
export function calculateProgress(task: Task): number {
  const todos = task.todos || [];
  
  if (todos.length === 0) {
    // 无 todos 时使用阶段性进度
    return getPhaseProgress(task.stage);
  }
  
  // 统计各状态的 todos（包括嵌套子任务）
  const { total, completed, inProgress } = countTodos(todos);
  
  if (total === 0) return 0;
  
  // 基础进度：已完成的占比 (0-85%)
  const baseProgress = (completed / total) * 85;
  
  // 进行中的任务贡献部分进度 (+2% per in_progress todo)
  const progressBonus = Math.min(inProgress * 2, 10);
  
  // 如果有报告文件，额外加 10%
  const hasReport = task.stage === "撰写报告" || task.stage === "完成";
  const reportBonus = hasReport ? 10 : 0;
  
  return Math.min(Math.round(baseProgress + progressBonus + reportBonus), 100);
}

