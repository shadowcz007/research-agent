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
    const versionsDir = path.join(reportDir, "versions");
    await fs.mkdir(versionsDir, { recursive: true });
    return reportDir;
  }

  async saveQuestion(id: string, question: string): Promise<void> {
    const reportDir = await this.createReportDir(id);
    const questionPath = path.join(reportDir, "question.txt");
    await fs.writeFile(questionPath, question, "utf-8");
  }

  async saveReport(id: string, content: string, version?: string): Promise<void> {
    const reportDir = await this.createReportDir(id);
    if (version) {
      const versionPath = path.join(reportDir, "versions", `v${version}.md`);
      await fs.writeFile(versionPath, content, "utf-8");
      console.log(`[FileStorage] 保存版本报告: ${versionPath} (内容长度: ${content.length} 字符)`);
    }
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

  async getReportVersions(id: string): Promise<Array<{ version: string; date: string }>> {
    try {
      const versionsDir = path.join(this.reportsDir, id, "versions");
      const files = await fs.readdir(versionsDir);
      const versions = await Promise.all(
        files
          .filter((f) => f.endsWith(".md"))
          .map(async (file) => {
            const filePath = path.join(versionsDir, file);
            const stats = await fs.stat(filePath);
            return {
              version: file.replace(".md", ""),
              date: stats.mtime.toISOString(),
            };
          })
      );
      return versions.sort((a, b) => b.date.localeCompare(a.date));
    } catch {
      return [];
    }
  }

  async getVersionReport(id: string, version: string): Promise<string | null> {
    try {
      const versionPath = path.join(this.reportsDir, id, "versions", `${version}.md`);
      return await fs.readFile(versionPath, "utf-8");
    } catch {
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
            question: question || "未知问题",
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
}

export const fileStorage = new FileStorage();

