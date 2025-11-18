"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Plus, Trash2 } from "lucide-react";

interface AiAction {
  id: string;
  name: string;
  prompt: string;
  icon?: string;
  enabled: boolean;
}

interface Style {
  id: string;
  name: string;
  prompt: string;
  icon?: string;
}

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId?: string; // 可选，因为现在使用全局配置
}

export function SettingsModal({
  open,
  onOpenChange,
  reportId,
}: SettingsModalProps) {
  const [aiActions, setAiActions] = useState<AiAction[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchConfig();
    }
  }, [open]);

  const fetchConfig = async () => {
    try {
      const response = await fetch(`/api/edit-config`);
      if (response.ok) {
        const data = await response.json();
        setAiActions(data.aiActions || []);
        setStyles(data.styles || []);
      } else {
        // 使用默认配置
        setAiActions([
          { id: "1", name: "改进写作", prompt: "改进这段文字的写作质量", enabled: true },
          { id: "2", name: "缩短", prompt: "缩短这段文字", enabled: true },
          { id: "3", name: "扩写", prompt: "扩写这段文字", enabled: true },
          { id: "4", name: "更正式", prompt: "将这段文字改写为更正式的风格", enabled: true },
        ]);
        setStyles([
          { id: "1", name: "专业正式", prompt: "将文档改写为专业正式的风格" },
          { id: "2", name: "风趣幽默", prompt: "将文档改写为风趣幽默的风格" },
          { id: "3", name: "简洁有力", prompt: "将文档改写为简洁有力的风格" },
        ]);
      }
    } catch (error) {
      console.error("Error fetching config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/edit-config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          aiActions,
          styles,
        }),
      });

      if (!response.ok) {
        throw new Error("保存失败");
      }

      alert("配置已保存");
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving config:", error);
      alert("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  const addAiAction = () => {
    setAiActions([
      ...aiActions,
      {
        id: Date.now().toString(),
        name: "",
        prompt: "",
        enabled: true,
      },
    ]);
  };

  const removeAiAction = (id: string) => {
    setAiActions(aiActions.filter((action) => action.id !== id));
  };

  const updateAiAction = (id: string, field: keyof AiAction, value: any) => {
    setAiActions(
      aiActions.map((action) =>
        action.id === id ? { ...action, [field]: value } : action
      )
    );
  };

  const addStyle = () => {
    setStyles([
      ...styles,
      {
        id: Date.now().toString(),
        name: "",
        prompt: "",
      },
    ]);
  };

  const removeStyle = (id: string) => {
    setStyles(styles.filter((style) => style.id !== id));
  };

  const updateStyle = (id: string, field: keyof Style, value: any) => {
    setStyles(
      styles.map((style) =>
        style.id === id ? { ...style, [field]: value } : style
      )
    );
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="p-4">加载中...</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑配置</DialogTitle>
          <DialogDescription>
            配置上下文AI编辑的工具栏选项和全文风格改写的风格选项
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="actions" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="actions">AI 动作</TabsTrigger>
            <TabsTrigger value="styles">文风</TabsTrigger>
          </TabsList>

          <TabsContent value="actions" className="space-y-4">
            <div className="space-y-4">
              {aiActions.map((action) => (
                <div
                  key={action.id}
                  className="p-4 border rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <Input
                      placeholder="动作名称"
                      value={action.name}
                      onChange={(e) =>
                        updateAiAction(action.id, "name", e.target.value)
                      }
                      className="flex-1 mr-2"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAiAction(action.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Prompt"
                    value={action.prompt}
                    onChange={(e) =>
                      updateAiAction(action.id, "prompt", e.target.value)
                    }
                  />
                </div>
              ))}
              <Button
                variant="outline"
                onClick={addAiAction}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                添加动作
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="styles" className="space-y-4">
            <div className="space-y-4">
              {styles.map((style) => (
                <div
                  key={style.id}
                  className="p-4 border rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <Input
                      placeholder="风格名称"
                      value={style.name}
                      onChange={(e) =>
                        updateStyle(style.id, "name", e.target.value)
                      }
                      className="flex-1 mr-2"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStyle(style.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Prompt"
                    value={style.prompt}
                    onChange={(e) =>
                      updateStyle(style.id, "prompt", e.target.value)
                    }
                  />
                </div>
              ))}
              <Button
                variant="outline"
                onClick={addStyle}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                添加风格
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

