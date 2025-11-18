import { NextRequest, NextResponse } from "next/server";
import { getVersionContent } from "@/lib/storage/version-storage";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const versionId = searchParams.get("version") || "original";

    if (!versionId) {
      return NextResponse.json(
        { error: "版本ID是必需的" },
        { status: 400 }
      );
    }

    const content = await getVersionContent(id, versionId);

    if (content === null) {
      return NextResponse.json(
        { error: "版本文件不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Error fetching version:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取版本失败" },
      { status: 500 }
    );
  }
}

