import fs from "fs/promises";
import path from "path";

const REPORTS_DIR = path.join(process.cwd(), "reports");

export interface ReportMetadata {
  id: string;
  question: string;
  createdAt: string;
  updatedAt: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  stage?: string;
}

export class FileStorage {
  private reportsDir: string;

  constructor(reportsDir: string = REPORTS_DIR) {
    this.reportsDir = reportsDir;
    console.log(`[FileStorage] 初始化，报告目录: ${this.reportsDir}`);
    console.log(`[FileStorage] 工作目录 (cwd): ${process.cwd()}`);
  }

  async ensureReportsDir(): Promise<void> {
    try {
      await fs.access(this.reportsDir);
    } catch {
      await fs.mkdir(this.reportsDir, { recursive: true });
    }
  }

  async createReportDir(id: string): Promise<string> {
    await this.ensureReportsDir();
    const reportDir = path.join(this.reportsDir, id);
    await fs.mkdir(reportDir, { recursive: true });
    return reportDir;
  }

  async saveQuestion(id: string, question: string): Promise<void> {
    const reportDir = await this.createReportDir(id);
    const questionPath = path.join(reportDir, "question.txt");
    await fs.writeFile(questionPath, question, "utf-8");
  }

  async saveReport(id: string, content: string): Promise<void> {
    const reportDir = await this.createReportDir(id);
    const reportPath = path.join(reportDir, "final_report.md");
    console.log(`[FileStorage] 保存最终报告:`);
    console.log(`  - Report ID: ${id}`);
    console.log(`  - 完整路径: ${reportPath}`);
    console.log(`  - 报告目录: ${reportDir}`);
    console.log(`  - 内容长度: ${content.length} 字符`);
    console.log(`  - 内容预览 (前200字符): ${content.substring(0, 200)}...`);
    await fs.writeFile(reportPath, content, "utf-8");
    console.log(`[FileStorage] ✅ 报告已成功保存到: ${reportPath}`);
  }

  async getQuestion(id: string): Promise<string | null> {
    try {
      const questionPath = path.join(this.reportsDir, id, "question.txt");
      return await fs.readFile(questionPath, "utf-8");
    } catch {
      return null;
    }
  }

  async getReport(id: string): Promise<string | null> {
    try {
      const reportPath = path.join(this.reportsDir, id, "final_report.md");
      console.log(`[FileStorage] 尝试读取报告: ${reportPath}`);
      const content = await fs.readFile(reportPath, "utf-8");
      console.log(`[FileStorage] ✅ 成功读取报告 (长度: ${content.length} 字符)`);
      return content;
    } catch (error) {
      const reportPath = path.join(this.reportsDir, id, "final_report.md");
      console.log(`[FileStorage] ❌ 读取报告失败: ${reportPath}`, error instanceof Error ? error.message : error);
      return null;
    }
  }


  async listReports(): Promise<ReportMetadata[]> {
    await this.ensureReportsDir();
    try {
      const dirs = await fs.readdir(this.reportsDir);
      const reports: (ReportMetadata | null)[] = await Promise.all(
        dirs.map(async (dir) => {
          const reportDir = path.join(this.reportsDir, dir);
          const stats = await fs.stat(reportDir);
          if (!stats.isDirectory()) return null;

          const question = await this.getQuestion(dir);
          
          // 如果没有question，过滤掉这个报告
          if (!question || question.trim() === "") {
            return null;
          }
          
          const reportPath = path.join(reportDir, "final_report.md");
          let status: ReportMetadata["status"] = "pending";
          let updatedAt = stats.mtime.toISOString();

          try {
            await fs.access(reportPath);
            status = "completed";
            const reportStats = await fs.stat(reportPath);
            updatedAt = reportStats.mtime.toISOString();
          } catch {
            // Report doesn't exist yet
          }

          return {
            id: dir,
            question: question,
            createdAt: stats.birthtime.toISOString(),
            updatedAt,
            status,
          } as ReportMetadata;
        })
      );
      return reports.filter((r): r is ReportMetadata => r !== null);
    } catch {
      return [];
    }
  }

  async updateReportStatus(
    id: string,
    status: ReportMetadata["status"],
    progress?: number,
    stage?: string
  ): Promise<void> {
    // In a real implementation, you might want to store this in a metadata file
    // For now, we'll just ensure the directory exists
    await this.createReportDir(id);
  }

  async saveAgentRawResult(id: string, result: unknown): Promise<void> {
    try {
      const reportDir = await this.createReportDir(id);
      const resultPath = path.join(reportDir, "agent_raw_result.json");
      // 使用 JSON.stringify 序列化，处理可能的循环引用和特殊对象
      const jsonContent = JSON.stringify(result, null, 2);
      await fs.writeFile(resultPath, jsonContent, "utf-8");
      console.log(`[FileStorage] 保存 Agent 原始结果到: ${resultPath}`);
    } catch (error) {
      console.error(`[FileStorage] 保存 Agent 原始结果失败:`, error instanceof Error ? error.message : error);
      // 不抛出错误，因为这只是用于调试的辅助功能
    }
  }

  async getAgentRawResult(id: string): Promise<any | null> {
    try {
      const resultPath = path.join(this.reportsDir, id, "agent_raw_result.json");
      const content = await fs.readFile(resultPath, "utf-8");
      const result = JSON.parse(content);
      console.log(`[FileStorage] ✅ 成功读取 Agent 原始结果 (${resultPath})`);
      return result;
    } catch (error) {
      console.log(`[FileStorage] ❌ 读取 Agent 原始结果失败:`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  async deleteReport(id: string): Promise<void> {
    const reportPath = path.join(this.reportsDir, id, "final_report.md");
    try {
      await fs.unlink(reportPath);
      console.log(`[FileStorage] ✅ 已删除最终报告: ${reportPath}`);
    } catch (error) {
      // 如果文件不存在，不抛出错误
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`[FileStorage] ❌ 删除最终报告失败:`, error instanceof Error ? error.message : error);
        throw error;
      } else {
        console.log(`[FileStorage] 最终报告不存在，无需删除: ${reportPath}`);
      }
    }
  }

  async deleteAgentRawResult(id: string): Promise<void> {
    const resultPath = path.join(this.reportsDir, id, "agent_raw_result.json");
    try {
      await fs.unlink(resultPath);
      console.log(`[FileStorage] ✅ 已删除 Agent 原始结果: ${resultPath}`);
    } catch (error) {
      // 如果文件不存在，不抛出错误
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`[FileStorage] ❌ 删除 Agent 原始结果失败:`, error instanceof Error ? error.message : error);
        throw error;
      } else {
        console.log(`[FileStorage] Agent 原始结果不存在，无需删除: ${resultPath}`);
      }
    }
  }

  async appendProgressLog(id: string, logEntry: { timestamp: string; payload: any; rawData?: any }): Promise<void> {
    try {
      const reportDir = await this.createReportDir(id);
      const logPath = path.join(reportDir, "progress_log.json");
      
      // 读取现有日志（如果存在）
      let logs: Array<{ timestamp: string; payload: any; rawData?: any }> = [];
      try {
        const existingContent = await fs.readFile(logPath, "utf-8");
        logs = JSON.parse(existingContent);
        if (!Array.isArray(logs)) {
          logs = [];
        }
      } catch {
        // 文件不存在或解析失败，使用空数组
        logs = [];
      }
      
      // 追加新条目
      logs.push(logEntry);
      
      // 原子性写入文件
      const jsonContent = JSON.stringify(logs, null, 2);
      await fs.writeFile(logPath, jsonContent, "utf-8");
      console.log(`[FileStorage] ✅ 已追加进度日志条目到: ${logPath}`);
    } catch (error) {
      console.error(`[FileStorage] ❌ 追加进度日志失败:`, error instanceof Error ? error.message : error);
      throw error;
    }
  }

  async getProgressLog(id: string): Promise<Array<{ timestamp: string; payload: any; rawData?: any }>> {
    try {
      const logPath = path.join(this.reportsDir, id, "progress_log.json");
      const content = await fs.readFile(logPath, "utf-8");
      const logs = JSON.parse(content);
      if (!Array.isArray(logs)) {
        console.warn(`[FileStorage] ⚠️ progress_log.json 格式无效，返回空数组`);
        return [];
      }
      console.log(`[FileStorage] ✅ 成功读取进度日志 (${logs.length} 条)`);
      return logs;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log(`[FileStorage] progress_log.json 不存在: ${id}`);
        throw error; // 不提供向后兼容，抛出错误
      }
      console.error(`[FileStorage] ❌ 读取进度日志失败:`, error instanceof Error ? error.message : error);
      throw error;
    }
  }

  async clearProgressLog(id: string): Promise<void> {
    try {
      const reportDir = await this.createReportDir(id);
      const logPath = path.join(reportDir, "progress_log.json");
      
      // 写入空数组
      const jsonContent = JSON.stringify([], null, 2);
      await fs.writeFile(logPath, jsonContent, "utf-8");
      console.log(`[FileStorage] ✅ 已清空进度日志: ${logPath}`);
    } catch (error) {
      console.error(`[FileStorage] ❌ 清空进度日志失败:`, error instanceof Error ? error.message : error);
      throw error;
    }
  }

  async saveIntentData(id: string, intentData: any): Promise<void> {
    try {
      const reportDir = await this.createReportDir(id);
      const intentPath = path.join(reportDir, "intent_data.json");
      const jsonContent = JSON.stringify(intentData, null, 2);
      await fs.writeFile(intentPath, jsonContent, "utf-8");
      console.log(`[FileStorage] ✅ 已保存意图澄清数据到: ${intentPath}`);
    } catch (error) {
      console.error(`[FileStorage] ❌ 保存意图澄清数据失败:`, error instanceof Error ? error.message : error);
      throw error;
    }
  }

  async getIntentData(id: string): Promise<any | null> {
    try {
      const intentPath = path.join(this.reportsDir, id, "intent_data.json");
      const content = await fs.readFile(intentPath, "utf-8");
      const intentData = JSON.parse(content);
      console.log(`[FileStorage] ✅ 成功读取意图澄清数据 (${intentPath})`);
      return intentData;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log(`[FileStorage] intent_data.json 不存在: ${id}`);
        return null;
      }
      console.error(`[FileStorage] ❌ 读取意图澄清数据失败:`, error instanceof Error ? error.message : error);
      return null;
    }
  }
}

export const fileStorage = new FileStorage();

