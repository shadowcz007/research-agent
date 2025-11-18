import fs from "fs/promises";
import path from "path";
import { fileStorage } from "./file-storage";

export interface ReportVersion {
  id: string;              // "original" 或 "v{timestamp}"
  name: string;            // "原报告" 或 "版本 {时间}"
  filename: string;        // "final_report.md" 或 "v{timestamp}.md"
  createdAt: string;       // ISO 时间戳
  isOriginal: boolean;     // 是否为原报告
}

interface VersionsMetadata {
  versions: ReportVersion[];
}

const METADATA_FILE = "versions_metadata.json";
const VERSIONS_DIR = "versions";

/**
 * 确保versions目录存在
 */
export async function ensureVersionsDir(reportId: string): Promise<string> {
  const reportDir = await fileStorage.createReportDir(reportId);
  const versionsDir = path.join(reportDir, VERSIONS_DIR);
  
  try {
    await fs.access(versionsDir);
  } catch {
    await fs.mkdir(versionsDir, { recursive: true });
  }
  
  return versionsDir;
}

/**
 * 获取版本元数据
 */
export async function getVersionsMetadata(reportId: string): Promise<VersionsMetadata> {
  const reportDir = await fileStorage.createReportDir(reportId);
  const metadataPath = path.join(reportDir, METADATA_FILE);
  
  try {
    const content = await fs.readFile(metadataPath, "utf-8");
    const metadata = JSON.parse(content) as VersionsMetadata;
    return metadata;
  } catch (error) {
    // 如果元数据文件不存在，初始化并包含原报告
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const metadata = await initializeVersionsMetadata(reportId);
      return metadata;
    }
    throw error;
  }
}

/**
 * 初始化版本元数据（包含原报告）
 */
async function initializeVersionsMetadata(reportId: string): Promise<VersionsMetadata> {
  const reportDir = await fileStorage.createReportDir(reportId);
  const metadataPath = path.join(reportDir, METADATA_FILE);
  
  // 检查原报告是否存在
  const originalReportPath = path.join(reportDir, "final_report.md");
  let originalCreatedAt = new Date().toISOString();
  
  try {
    const stats = await fs.stat(originalReportPath);
    originalCreatedAt = stats.birthtime.toISOString();
  } catch {
    // 原报告不存在，使用当前时间
  }
  
  const metadata: VersionsMetadata = {
    versions: [
      {
        id: "original",
        name: "原报告",
        filename: "final_report.md",
        createdAt: originalCreatedAt,
        isOriginal: true,
      },
    ],
  };
  
  // 保存元数据文件
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
  
  return metadata;
}

/**
 * 保存新版本并更新元数据
 */
export async function saveVersion(reportId: string, content: string): Promise<ReportVersion> {
  // 确保versions目录存在
  const versionsDir = await ensureVersionsDir(reportId);
  
  // 生成版本ID和时间戳
  const timestamp = Date.now();
  const versionId = `v${timestamp}`;
  const filename = `${versionId}.md`;
  const filePath = path.join(versionsDir, filename);
  
  // 保存版本文件
  await fs.writeFile(filePath, content, "utf-8");
  
  // 更新元数据
  const metadata = await getVersionsMetadata(reportId);
  const newVersion: ReportVersion = {
    id: versionId,
    name: `版本 ${new Date(timestamp).toLocaleString("zh-CN")}`,
    filename,
    createdAt: new Date(timestamp).toISOString(),
    isOriginal: false,
  };
  
  // 将新版本添加到列表开头（最新在前）
  metadata.versions.unshift(newVersion);
  
  // 保存元数据
  const reportDir = await fileStorage.createReportDir(reportId);
  const metadataPath = path.join(reportDir, METADATA_FILE);
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
  
  return newVersion;
}

/**
 * 获取指定版本内容
 */
export async function getVersionContent(reportId: string, versionId: string): Promise<string | null> {
  const reportDir = await fileStorage.createReportDir(reportId);
  
  if (versionId === "original") {
    // 原报告
    const originalPath = path.join(reportDir, "final_report.md");
    try {
      return await fs.readFile(originalPath, "utf-8");
    } catch {
      return null;
    }
  } else {
    // 编辑版本
    const versionsDir = path.join(reportDir, VERSIONS_DIR);
    const versionPath = path.join(versionsDir, `${versionId}.md`);
    try {
      return await fs.readFile(versionPath, "utf-8");
    } catch {
      return null;
    }
  }
}

/**
 * 获取所有版本列表（按时间倒序）
 */
export async function getAllVersions(reportId: string): Promise<ReportVersion[]> {
  const metadata = await getVersionsMetadata(reportId);
  
  // 检查每个版本文件是否存在，更新exists状态
  const reportDir = await fileStorage.createReportDir(reportId);
  
  const versionsWithExistence = await Promise.all(
    metadata.versions.map(async (version) => {
      let exists = false;
      
      if (version.isOriginal) {
        const originalPath = path.join(reportDir, version.filename);
        try {
          await fs.access(originalPath);
          exists = true;
        } catch {
          exists = false;
        }
      } else {
        const versionsDir = path.join(reportDir, VERSIONS_DIR);
        const versionPath = path.join(versionsDir, version.filename);
        try {
          await fs.access(versionPath);
          exists = true;
        } catch {
          exists = false;
        }
      }
      
      return { ...version, exists };
    })
  );
  
  // 过滤掉不存在的版本（但保留原报告）
  return versionsWithExistence.filter((v) => v.exists || v.isOriginal);
}

