import { NextRequest, NextResponse } from "next/server";
import { fileStorage } from "@/lib/storage/file-storage";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const download = searchParams.get("download") === "true";
    const version = searchParams.get("version");

    let content: string | null;
    if (version) {
      content = await fileStorage.getVersionReport(id, version);
    } else {
      content = await fileStorage.getReport(id);
    }

    if (!content) {
      return NextResponse.json({ error: "报告不存在" }, { status: 404 });
    }

    if (download) {
      return new NextResponse(content, {
        headers: {
          "Content-Type": "text/markdown",
          "Content-Disposition": `attachment; filename="report-${id}.md"`,
        },
      });
    }

    const question = await fileStorage.getQuestion(id);
    const versions = await fileStorage.getReportVersions(id);

    return NextResponse.json({
      id,
      question,
      content,
      versions,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取报告失败" },
      { status: 500 }
    );
  }
}


