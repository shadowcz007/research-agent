import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const CONFIG_FILE = "edit_config.json";
const CONFIG_DIR = path.join(process.cwd(), "config");

// 确保配置目录存在
async function ensureConfigDir() {
  try {
    await fs.access(CONFIG_DIR);
  } catch {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  }
}

const getConfigPath = () => path.join(CONFIG_DIR, CONFIG_FILE);

const getDefaultConfig = () => ({
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

export async function GET() {
  try {
    await ensureConfigDir();
    const configPath = getConfigPath();

    try {
      const content = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(content);
      return NextResponse.json(config);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // 配置文件不存在，返回默认配置
        const defaultConfig = getDefaultConfig();
        // 同时创建默认配置文件
        await fs.writeFile(
          configPath,
          JSON.stringify(defaultConfig, null, 2),
          "utf-8"
        );
        return NextResponse.json(defaultConfig);
      }
      throw error;
    }
  } catch (error) {
    console.error("Error fetching config:", error);
    // 出错时返回默认配置
    return NextResponse.json(getDefaultConfig());
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureConfigDir();
    const { aiActions, styles } = await request.json();

    const config = {
      aiActions: aiActions || [],
      styles: styles || [],
    };

    const configPath = getConfigPath();
    await fs.writeFile(
      configPath,
      JSON.stringify(config, null, 2),
      "utf-8"
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving config:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存配置失败" },
      { status: 500 }
    );
  }
}

