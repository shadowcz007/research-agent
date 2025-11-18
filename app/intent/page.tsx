"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";

interface SmartGoal {
  specific: string;
  measurable: string;
  achievable: string;
  relevant: string;
  timeBound: string;
}

interface ResearchCard {
  goal: string;
  questions: string[];
  scope: string;
  hypothesis: string;
}

interface IntentData {
  initialProblem: string;
  clarifiedIntent: string;
  smartGoal: SmartGoal;
  selectedDimensions: string[];
  hypothesis: string;
  researchCard?: ResearchCard;
}

const STEPS = [
  "初始问题",
  "意图澄清",
  "S.M.A.R.T. 目标",
  "维度选择",
  "假设输入",
  "研究卡片",
];

function IntentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 从URL获取初始问题
  const initialProblem = searchParams.get("problem") || "";

  // 状态管理
  const [intentData, setIntentData] = useState<IntentData>({
    initialProblem,
    clarifiedIntent: "",
    smartGoal: {
      specific: "",
      measurable: "",
      achievable: "",
      relevant: "",
      timeBound: "",
    },
    selectedDimensions: [],
    hypothesis: "",
  });

  // 步骤2：意图澄清相关状态
  const [clarifyQuestions, setClarifyQuestions] = useState<string[]>([]);
  const [selectedIntent, setSelectedIntent] = useState<string>("");
  const [customIntent, setCustomIntent] = useState<string>("");
  const [loadingClarify, setLoadingClarify] = useState(false);

  // 步骤3：S.M.A.R.T. 目标相关状态
  const [loadingSmartGoals, setLoadingSmartGoals] = useState(false);

  // 步骤4：维度相关状态
  const [suggestedDimensions, setSuggestedDimensions] = useState<string[]>([]);
  const [customDimension, setCustomDimension] = useState<string>("");
  const [loadingDimensions, setLoadingDimensions] = useState(false);

  // 步骤6：研究卡片相关状态
  const [loadingResearchCard, setLoadingResearchCard] = useState(false);

  // 步骤1：确认初始问题
  useEffect(() => {
    if (currentStep === 1 && !initialProblem) {
      setError("未提供初始问题，请返回首页重新输入");
    }
  }, [currentStep, initialProblem]);

  // 步骤2：加载意图澄清问题
  useEffect(() => {
    if (currentStep === 2 && clarifyQuestions.length === 0 && !loadingClarify) {
      loadClarifyQuestions();
    }
  }, [currentStep]);

  // 步骤3：加载S.M.A.R.T.目标
  useEffect(() => {
    if (
      currentStep === 3 &&
      intentData.clarifiedIntent &&
      !intentData.smartGoal.specific &&
      !loadingSmartGoals
    ) {
      loadSmartGoals();
    }
  }, [currentStep, intentData.clarifiedIntent]);

  // 步骤4：加载维度建议
  useEffect(() => {
    if (
      currentStep === 4 &&
      intentData.smartGoal.specific &&
      suggestedDimensions.length === 0 &&
      !loadingDimensions
    ) {
      loadDimensions();
    }
  }, [currentStep, intentData.smartGoal]);

  // 步骤6：生成研究卡片
  useEffect(() => {
    if (
      currentStep === 6 &&
      intentData.selectedDimensions.length > 0 &&
      !intentData.researchCard &&
      !loadingResearchCard
    ) {
      generateResearchCard();
    }
  }, [currentStep, intentData.selectedDimensions]);

  const loadClarifyQuestions = async () => {
    setLoadingClarify(true);
    setError(null);
    try {
      const response = await fetch("/api/intent/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem: intentData.initialProblem }),
      });

      if (!response.ok) {
        throw new Error("获取澄清问题失败");
      }

      const data = await response.json();
      setClarifyQuestions(data.questions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取澄清问题失败");
    } finally {
      setLoadingClarify(false);
    }
  };

  const loadSmartGoals = async () => {
    setLoadingSmartGoals(true);
    setError(null);
    try {
      const response = await fetch("/api/intent/smart-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: intentData.initialProblem,
          intent: intentData.clarifiedIntent,
        }),
      });

      if (!response.ok) {
        throw new Error("生成S.M.A.R.T.目标失败");
      }

      const data = await response.json();
      setIntentData((prev) => ({
        ...prev,
        smartGoal: {
          specific: data.specific || "",
          measurable: data.measurable || "",
          achievable: data.achievable || "",
          relevant: data.relevant || "",
          timeBound: data.timeBound || "",
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成S.M.A.R.T.目标失败");
    } finally {
      setLoadingSmartGoals(false);
    }
  };

  const loadDimensions = async () => {
    setLoadingDimensions(true);
    setError(null);
    try {
      const response = await fetch("/api/intent/dimensions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: intentData.initialProblem,
          smartGoal: intentData.smartGoal,
        }),
      });

      if (!response.ok) {
        throw new Error("获取分析维度失败");
      }

      const data = await response.json();
      setSuggestedDimensions(data.dimensions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取分析维度失败");
    } finally {
      setLoadingDimensions(false);
    }
  };

  const generateResearchCard = async () => {
    setLoadingResearchCard(true);
    setError(null);
    try {
      const response = await fetch("/api/intent/research-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initialProblem: intentData.initialProblem,
          clarifiedIntent: intentData.clarifiedIntent,
          smartGoal: intentData.smartGoal,
          selectedDimensions: intentData.selectedDimensions,
          hypothesis: intentData.hypothesis,
        }),
      });

      if (!response.ok) {
        throw new Error("生成研究卡片失败");
      }

      const data = await response.json();
      setIntentData((prev) => ({
        ...prev,
        researchCard: data,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成研究卡片失败");
    } finally {
      setLoadingResearchCard(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 2) {
      // 验证意图选择
      const finalIntent = selectedIntent || customIntent.trim();
      if (!finalIntent) {
        setError("请选择或输入一个意图");
        return;
      }
      setIntentData((prev) => ({ ...prev, clarifiedIntent: finalIntent }));
      setSelectedIntent("");
      setCustomIntent("");
    }
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
      setError(null);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError(null);
    }
  };

  const handleDimensionToggle = (dimension: string) => {
    setIntentData((prev) => {
      const isSelected = prev.selectedDimensions.includes(dimension);
      return {
        ...prev,
        selectedDimensions: isSelected
          ? prev.selectedDimensions.filter((d) => d !== dimension)
          : [...prev.selectedDimensions, dimension],
      };
    });
  };

  const handleAddCustomDimension = () => {
    if (customDimension.trim()) {
      setIntentData((prev) => ({
        ...prev,
        selectedDimensions: [...prev.selectedDimensions, customDimension.trim()],
      }));
      setSuggestedDimensions((prev) => [...prev, customDimension.trim()]);
      setCustomDimension("");
    }
  };

  const handleStartResearch = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: intentData.initialProblem,
          intentData: {
            clarifiedIntent: intentData.clarifiedIntent,
            smartGoal: intentData.smartGoal,
            selectedDimensions: intentData.selectedDimensions,
            hypothesis: intentData.hypothesis,
            researchCard: intentData.researchCard,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("创建研究任务失败");
      }

      const { id } = await response.json();
      router.push(`/research/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建研究任务失败");
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <p className="text-lg text-slate-700">
              {intentData.initialProblem}
            </p>
            <p className="text-sm text-slate-500">
              请确认这是您要研究的问题。确认后点击"下一步"继续。
            </p>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            {loadingClarify ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="ml-2 text-slate-600">正在生成澄清问题...</span>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {clarifyQuestions.map((question, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setSelectedIntent(question);
                        setCustomIntent("");
                      }}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                        selectedIntent === question
                          ? "border-blue-600 bg-blue-50"
                          : "border-slate-200 hover:border-blue-300"
                      }`}
                    >
                      {question}
                    </button>
                  ))}
                </div>
                <div className="pt-4 border-t">
                  <p className="text-sm text-slate-600 mb-2">或输入自定义意图：</p>
                  <Input
                    value={customIntent}
                    onChange={(e) => {
                      setCustomIntent(e.target.value);
                      setSelectedIntent("");
                    }}
                    placeholder="输入您的意图..."
                    className="w-full"
                  />
                </div>
              </>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            {loadingSmartGoals ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="ml-2 text-slate-600">正在生成S.M.A.R.T.目标...</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    具体 (Specific)
                  </label>
                  <Input
                    value={intentData.smartGoal.specific}
                    onChange={(e) =>
                      setIntentData((prev) => ({
                        ...prev,
                        smartGoal: { ...prev.smartGoal, specific: e.target.value },
                      }))
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    可衡量 (Measurable)
                  </label>
                  <Input
                    value={intentData.smartGoal.measurable}
                    onChange={(e) =>
                      setIntentData((prev) => ({
                        ...prev,
                        smartGoal: { ...prev.smartGoal, measurable: e.target.value },
                      }))
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    可实现 (Achievable)
                  </label>
                  <Input
                    value={intentData.smartGoal.achievable}
                    onChange={(e) =>
                      setIntentData((prev) => ({
                        ...prev,
                        smartGoal: { ...prev.smartGoal, achievable: e.target.value },
                      }))
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    相关 (Relevant)
                  </label>
                  <Input
                    value={intentData.smartGoal.relevant}
                    onChange={(e) =>
                      setIntentData((prev) => ({
                        ...prev,
                        smartGoal: { ...prev.smartGoal, relevant: e.target.value },
                      }))
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    有时限 (Time-bound)
                  </label>
                  <Input
                    value={intentData.smartGoal.timeBound}
                    onChange={(e) =>
                      setIntentData((prev) => ({
                        ...prev,
                        smartGoal: { ...prev.smartGoal, timeBound: e.target.value },
                      }))
                    }
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            {loadingDimensions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="ml-2 text-slate-600">正在生成分析维度...</span>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {suggestedDimensions.map((dimension, index) => (
                    <label
                      key={index}
                      className="flex items-center space-x-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={intentData.selectedDimensions.includes(dimension)}
                        onChange={() => handleDimensionToggle(dimension)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="flex-1 text-slate-700">{dimension}</span>
                    </label>
                  ))}
                </div>
                <div className="pt-4 border-t">
                  <p className="text-sm text-slate-600 mb-2">添加自定义维度：</p>
                  <div className="flex gap-2">
                    <Input
                      value={customDimension}
                      onChange={(e) => setCustomDimension(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          handleAddCustomDimension();
                        }
                      }}
                      placeholder="输入维度名称..."
                      className="flex-1"
                    />
                    <Button onClick={handleAddCustomDimension} variant="outline">
                      添加
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 mb-4">
              请输入您的核心业务假设（可选，可直接跳过）：
            </p>
            <textarea
              value={intentData.hypothesis}
              onChange={(e) =>
                setIntentData((prev) => ({ ...prev, hypothesis: e.target.value }))
              }
              placeholder="例如：我怀疑是新定价策略导致了流失"
              className="w-full min-h-[120px] p-3 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            {loadingResearchCard ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="ml-2 text-slate-600">正在生成研究卡片...</span>
              </div>
            ) : intentData.researchCard ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">研究目标</h3>
                  <p className="text-slate-700">{intentData.researchCard.goal}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">关键问题</h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-700">
                    {intentData.researchCard.questions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">研究范围</h3>
                  <p className="text-slate-700">{intentData.researchCard.scope}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">核心假设</h3>
                  <p className="text-slate-700">{intentData.researchCard.hypothesis}</p>
                </div>
              </div>
            ) : null}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl bg-white/95 backdrop-blur-sm shadow-2xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-blue-900 mb-2">
            AI 驱动的研究需求澄清
          </CardTitle>
          <CardDescription className="text-base">
            步骤 {currentStep} / {STEPS.length}: {STEPS[currentStep - 1]}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* 步骤指示器 */}
          <div className="flex items-center justify-between mb-6">
            {STEPS.map((step, index) => (
              <div key={index} className="flex items-center flex-1">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    index + 1 <= currentStep
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-slate-300 text-slate-400"
                  }`}
                >
                  {index + 1 < currentStep ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      index + 1 < currentStep ? "bg-blue-600" : "bg-slate-300"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* 步骤内容 */}
          <div className="min-h-[300px]">{renderStepContent()}</div>

          {/* 导航按钮 */}
          <div className="flex items-center justify-between pt-6 border-t">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              上一步
            </Button>
            {currentStep < STEPS.length ? (
              <Button
                onClick={handleNext}
                disabled={
                  loadingClarify ||
                  loadingSmartGoals ||
                  loadingDimensions ||
                  loadingResearchCard
                }
              >
                下一步
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCurrentStep(1);
                    setIntentData({
                      initialProblem,
                      clarifiedIntent: "",
                      smartGoal: {
                        specific: "",
                        measurable: "",
                        achievable: "",
                        relevant: "",
                        timeBound: "",
                      },
                      selectedDimensions: [],
                      hypothesis: "",
                    });
                    setClarifyQuestions([]);
                    setSuggestedDimensions([]);
                  }}
                >
                  重新开始
                </Button>
                <Button
                  onClick={handleStartResearch}
                  disabled={loading || !intentData.researchCard}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    "确认执行研究"
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function IntentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-4xl bg-white/95 backdrop-blur-sm shadow-2xl">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-3 text-slate-600">加载中...</span>
          </CardContent>
        </Card>
      </div>
    }>
      <IntentPageContent />
    </Suspense>
  );
}

