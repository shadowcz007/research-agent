"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Mic } from "lucide-react";

export default function HomePage() {
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const exampleQuestions = [
    "What are the effects of climate change on coral reefs?",
    "History of artificial intelligence in healthcare",
    "Latest developments in renewable energy technologies?",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) throw new Error("创建研究任务失败");

      const { id } = await response.json();
      router.push(`/research/${id}`);
    } catch (error) {
      console.error("Error:", error);
      alert("创建研究任务失败，请重试");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setQuestion(example);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl bg-white/95 backdrop-blur-sm shadow-2xl">
        <CardHeader className="text-center pb-8">
          <CardTitle className="text-4xl font-bold text-blue-900 mb-2">
            RESEARCH AGENT
          </CardTitle>
          <CardDescription className="text-lg text-slate-600">
            Your AI-powered research assistant
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* Search Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="Enter your research question..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="pl-10 pr-20 h-12 text-lg"
                disabled={isLoading}
              />
              <Mic className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 cursor-pointer hover:text-blue-600" />
            </div>
            <div className="flex items-center gap-4">
              <Button
                type="submit"
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white px-8"
                disabled={isLoading}
              >
                {isLoading ? "提交中..." : "SUBMIT"}
              </Button>
              <Mic className="text-slate-400 w-6 h-6 cursor-pointer hover:text-blue-600" />
            </div>
          </form>

          {/* Tips and Examples */}
          <div className="grid md:grid-cols-2 gap-6 mt-8">
            {/* Tips */}
            <Card className="bg-slate-50">
              <CardHeader>
                <CardTitle className="text-xl text-blue-900">
                  Tips for Effective Queries:
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-slate-700">
                <p>• Be specific: Narrow down on topic.</p>
                <p>• Use keywords: Highlight key terms</p>
                <p>• Contextualize: Add background information</p>
              </CardContent>
            </Card>

            {/* Examples */}
            <Card className="bg-slate-50">
              <CardHeader>
                <CardTitle className="text-xl text-blue-900">
                  Example Questions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {exampleQuestions.map((example, index) => (
                  <button
                    key={index}
                    onClick={() => handleExampleClick(example)}
                    className="block w-full text-left text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center pt-6 border-t border-slate-200">
            <div className="flex gap-6 text-sm text-blue-900">
              <a href="#" className="hover:underline">About</a>
              <a href="#" className="hover:underline">Pricing</a>
              <a href="#" className="hover:underline">FAQ</a>
              <a href="#" className="hover:underline">Contact</a>
            </div>
            <div className="text-sm text-slate-600">
              © 2024 Research Agent
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

