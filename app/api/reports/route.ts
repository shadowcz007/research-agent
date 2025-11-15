import { NextResponse } from "next/server";
import { fileStorage } from "@/lib/storage/file-storage";

export async function GET() {
  try {
    const reports = await fileStorage.listReports();
    return NextResponse.json({ reports });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取报告列表失败" },
      { status: 500 }
    );
  }
}

