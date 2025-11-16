import { NextResponse } from "next/server";
import { fileStorage } from "@/lib/storage/file-storage";

export async function GET() {
  try {
    const reports = await fileStorage.listReports();
    // 过滤掉没有question的报告（双重保险）
    const filteredReports = reports.filter(
      (report) => report.question && report.question.trim() !== "" && report.question !== "未知问题"
    );
    return NextResponse.json({ reports: filteredReports });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取报告列表失败" },
      { status: 500 }
    );
  }
}


