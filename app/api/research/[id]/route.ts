import { NextRequest, NextResponse } from "next/server";
import { activeTasks } from "@/lib/storage/task-storage";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const task = activeTasks.get(id);

  if (!task) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }

  return NextResponse.json(task);
}

