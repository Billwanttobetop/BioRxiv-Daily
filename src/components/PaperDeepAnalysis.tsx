import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Brain, FileText, AlertCircle, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface DeepAnalysis {
  motivation: string
  insights: string[]
  methods: {
    overview: string
    key_techniques: string[]
    innovations: string[]
  }
  experiments: {
    design: string
    datasets: string[]
    metrics: string[]
    baselines: string[]
  }
  results: {
    main_findings: string[]
    significance: string
    limitations: string[]
  }
}

interface PaperAnalysis {
  title_cn?: string
  abstract_cn?: string
  main_institutions?: string[]
  translation_status?: string
  translated_at?: string
}

interface PaperDeepAnalysisProps {
  paperId: string
  title: string
  abstract: string
  sourceUrl?: string | null
  pdfUrl?: string | null
  onAnalysisComplete?: (analysis: DeepAnalysis) => void
}

export function PaperDeepAnalysis({ paperId, title, abstract, sourceUrl, pdfUrl, onAnalysisComplete }: PaperDeepAnalysisProps) {
  const [analysis, setAnalysis] = useState<DeepAnalysis | null>(null)
  const [basicAnalysis, setBasicAnalysis] = useState<PaperAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  // 展示采用分块卡片，无需切换标签
  const [error, setError] = useState<string | null>(null)

  // 检查是否已有基础翻译
  const checkBasicAnalysis = async () => {
    try {
      const { data, error } = await supabase
        .from('paper_analysis')
        .select('*')
        .eq('paper_id', paperId)
        .maybeSingle()

      if (error) throw error
      setBasicAnalysis(data)
    } catch (error) {
      console.error('检查基础分析失败:', error)
    }
  }

  // 检查是否已有深度分析
  const checkDeepAnalysis = async () => {
    try {
      const { data, error } = await supabase
        .from('paper_deep_analysis')
        .select('*')
        .eq('paper_id', paperId)
        .eq('analysis_status', 'completed')
        .maybeSingle()

      if (error) throw error
      if (data) {
        const normalized: DeepAnalysis = (data as any).data ? (data as any).data : (data as any)
        setAnalysis(normalized)
        onAnalysisComplete?.(normalized)
      }
    } catch (error) {
      console.error('检查深度分析失败:', error)
    }
  }

  // 执行深度分析
  const performDeepAnalysis = async () => {
    setAnalyzing(true)
    setError(null)

    try {
      const resp = await fetch('/api/deep-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperId, title, abstract, source_url: sourceUrl, pdf_url: pdfUrl })
      })

      if (!resp.ok) {
        const txt = await resp.text()
        throw new Error(txt || '分析服务不可用')
      }

      const json = await resp.json()
      if (json.success) {
        setAnalysis(json.data)
        onAnalysisComplete?.(json.data)
        try {
          await supabase.from('paper_deep_analysis').upsert({
            paper_id: paperId,
            motivation: json.data.motivation,
            insights: json.data.insights,
            methods: json.data.methods,
            experiments: json.data.experiments,
            results: json.data.results,
            analysis_status: 'completed',
            analyzed_at: new Date().toISOString(),
          }, { onConflict: 'paper_id' })
        } catch (e) {
          // 忽略写库失败，至少前端展示
        }
      } else {
        throw new Error(json.error?.message || '分析失败')
      }
    } catch (error) {
      console.error('深度分析失败:', error)
      setError(error.message)
    } finally {
      setAnalyzing(false)
    }
  }

  useEffect(() => {
    checkBasicAnalysis()
    checkDeepAnalysis()
  }, [paperId])

  const renderSections = () => {
    if (!analysis) return null
    return (
      <div className="space-y-5">
        <section className="bg-white rounded-lg border p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold mb-3">动机</h3>
          <p className="text-[13px] sm:text-sm leading-relaxed">{analysis.motivation}</p>
        </section>

        <section className="bg-white rounded-lg border p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold mb-3">洞见</h3>
          <div className="space-y-2">
            {analysis.insights.map((item, idx) => (
              <div key={idx} className="flex items-start space-x-2">
                <Badge variant="secondary" className="text-xs">{idx + 1}</Badge>
                <span className="text-[13px] sm:text-sm leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-lg border p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold mb-3">方法</h3>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-1">方法概述</h4>
              <p className="text-[13px] sm:text-sm leading-relaxed">{analysis.methods.overview}</p>
            </div>
            <div className="md:grid md:grid-cols-2 md:gap-6 space-y-4 md:space-y-0">
              <div>
                <h4 className="text-sm font-medium mb-1">关键技术</h4>
                <div className="space-y-1">
                  {analysis.methods.key_techniques.map((t, i) => (
                    <div key={i} className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-primary rounded-full mt-1" />
                      <span className="text-[13px] sm:text-sm">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-1">方法创新</h4>
                <div className="space-y-1">
                  {analysis.methods.innovations.map((t, i) => (
                    <div key={i} className="flex items-start space-x-2">
                      <Badge variant="outline" className="text-xs">创新 {i + 1}</Badge>
                      <span className="text-[13px] sm:text-sm">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg border p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold mb-3">实验</h3>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-1">实验设计</h4>
              <p className="text-[13px] sm:text-sm leading-relaxed">{analysis.experiments.design}</p>
            </div>
            <div className="md:grid md:grid-cols-3 md:gap-4 space-y-3 md:space-y-0">
              <div>
                <h4 className="text-sm font-medium mb-1">数据集</h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.experiments.datasets.map((d, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{d}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-1">评估指标</h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.experiments.metrics.map((m, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{m}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-1">基线方法</h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.experiments.baselines.map((b, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{b}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg border p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold mb-3">结果</h3>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-1">主要发现</h4>
              <div className="space-y-2">
                {analysis.results.main_findings.map((f, i) => (
                  <div key={i} className="flex items-start space-x-2">
                    <Badge variant="default" className="text-xs">发现 {i + 1}</Badge>
                    <span className="text-[13px] sm:text-sm leading-relaxed">{f}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-1">结果意义</h4>
              <p className="text-[13px] sm:text-sm leading-relaxed">{analysis.results.significance}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-1">研究局限</h4>
              <div className="space-y-2">
                {analysis.results.limitations.map((l, i) => (
                  <div key={i} className="flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5" />
                    <span className="text-[13px] sm:text-sm">{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 深度分析控制 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Brain className="w-5 h-5 mr-2" />
            AI深度分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analysis ? (
            <div className="text-sm text-muted-foreground">深度分析已完成</div>
          ) : (
            <div className="space-y-4">
              <Button
                onClick={performDeepAnalysis}
                disabled={analyzing}
                className="w-full"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4 mr-2" />
                    开始AI深度分析
                  </>
                )}
              </Button>
              {error && (
                <div className="flex items-center space-x-2 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error.includes('non-2xx') ? '深度分析失败，请稍后重试或联系管理员' : error}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 深度分析结果 */}
      {analysis && (
        <div>{renderSections()}</div>
      )}
    </div>
  )
}
