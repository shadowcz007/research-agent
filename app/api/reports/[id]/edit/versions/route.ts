import { NextRequest, NextResponse } from "next/server";
import { getAllVersions, ReportVersion } from "@/lib/storage/version-storage";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 获取所有版本（已按时间倒序排列）
    const versions = await getAllVersions(id);

    // 转换为前端需要的格式（添加exists字段）
    const versionsWithExists: (ReportVersion & { exists: boolean })[] = versions.map((v) => ({
      ...v,
      exists: true, // getAllVersions已经过滤了不存在的版本
    }));

    return NextResponse.json({ versions: versionsWithExists });
  } catch (error) {
    console.error("Error fetching versions:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取版本列表失败" },
      { status: 500 }
    );
  }
}

