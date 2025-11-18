import { NextRequest, NextResponse } from "next/server";
import { saveVersion } from "@/lib/storage/version-storage";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { content, currentVersionId } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: "content 是必需的" },
        { status: 400 }
      );
    }

    // 禁止保存到原报告
    if (currentVersionId === "original") {
      // 自动创建新版本而不是拒绝
      // 这样可以保护原报告不被修改
    }

    // 每次保存都创建新版本
    const newVersion = await saveVersion(id, content);

    return NextResponse.json({ 
      success: true,
      version: newVersion
    });
  } catch (error) {
    console.error("Error saving edited report:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存失败" },
      { status: 500 }
    );
  }
}

