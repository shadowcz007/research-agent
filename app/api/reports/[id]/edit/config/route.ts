import { NextRequest, NextResponse } from "next/server";
import { fileStorage } from "@/lib/storage/file-storage";
import fs from "fs/promises";
import path from "path";

const CONFIG_FILE = "edit_config.json";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const reportDir = path.join(process.cwd(), "reports", id);
    const configPath = path.join(reportDir, CONFIG_FILE);

    try {
      const content = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(content);
      return NextResponse.json(config);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // 返回默认配置
        return NextResponse.json({
          aiActions: [
            {
              id: "1",
              name: "改进写作",
              prompt: "改进这段文字的写作质量",
              enabled: true,
            },
            {
              id: "2",
              name: "缩短",
              prompt: "缩短这段文字",
              enabled: true,
            },
            {
              id: "3",
              name: "扩写",
              prompt: "扩写这段文字",
              enabled: true,
            },
            {
              id: "4",
              name: "更正式",
              prompt: "将这段文字改写为更正式的风格",
              enabled: true,
            },
          ],
          styles: [
            {
              id: "1",
              name: "专业正式",
              prompt: "将文档改写为专业正式的风格",
            },
            {
              id: "2",
              name: "风趣幽默",
              prompt: "将文档改写为风趣幽默的风格",
            },
            {
              id: "3",
              name: "简洁有力",
              prompt: "将文档改写为简洁有力的风格",
            },
          ],
        });
      }
      throw error;
    }
  } catch (error) {
    console.error("Error fetching config:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取配置失败" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { aiActions, styles } = await request.json();

    const reportDir = await fileStorage.createReportDir(id);
    const configPath = path.join(reportDir, CONFIG_FILE);

    const config = {
      aiActions: aiActions || [],
      styles: styles || [],
    };

    await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving config:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存配置失败" },
      { status: 500 }
    );
  }
}

