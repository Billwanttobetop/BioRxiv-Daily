import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Brain, FileText, AlertCircle, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface DeepAnalysis {
  id: string
  paper_id: string
  motivation: string
  insights: string[]
  methods: any
  experiments: any
  results: any
  technical_novelty_score: number
  practical_impact_score: number
  theoretical_contribution_score: number
  confidence_score: number
  analyzed_at: string
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
  const [activeSection, setActiveSection] = useState<'overview' | 'insights' | 'methods' | 'experiments' | 'results'>('overview')
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

  const renderScore = (score: number, label: string) => (
    <div className="flex flex-col items-center space-y-1">
      <div className="text-2xl font-bold text-primary">{score.toFixed(1)}</div>
      <div className="text-xs text-muted-foreground text-center">{label}</div>
    </div>
  )

  const renderSection = () => {
    if (!analysis) return null

    switch (activeSection) {
      case 'overview':
        return (
          <div className="space-y-6">
            {/* 评分概览 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {renderScore(analysis.technical_novelty_score, '技术新颖性')}
              {renderScore(analysis.practical_impact_score, '实际影响')}
              {renderScore(analysis.theoretical_contribution_score, '理论贡献')}
              {renderScore(analysis.confidence_score, '分析置信度')}
            </div>

            {/* 研究动机 */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                研究动机
              </h3>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm leading-relaxed">{analysis.motivation}</p>
              </div>
            </div>

            {/* 核心洞见 */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                <Brain className="w-5 h-5 mr-2" />
                核心洞见
              </h3>
              <div className="space-y-3">
                {analysis.insights.map((insight, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <Badge variant="secondary" className="mt-1">{index + 1}</Badge>
                    <p className="text-sm leading-relaxed">{insight}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )

      case 'insights':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">深度洞见分析</h3>
            {analysis.insights.map((insight, index) => (
              <Card key={index}>
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <Badge variant="outline" className="text-primary">洞见 {index + 1}</Badge>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm leading-relaxed">{insight}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )

      case 'methods':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">方法概述</h3>
              <p className="text-sm leading-relaxed">{analysis.methods.overview}</p>
            </div>

            <div>
              <h4 className="text-md font-medium mb-2">关键技术</h4>
              <div className="grid gap-2">
                {analysis.methods.key_techniques.map((technique, index) => (
                  <div key={index} className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                    <span className="text-sm">{technique}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-md font-medium mb-2">方法创新</h4>
              <div className="grid gap-2">
                {analysis.methods.innovations.map((innovation, index) => (
                  <div key={index} className="flex items-start space-x-2">
                    <Badge variant="secondary" className="text-xs">创新 {index + 1}</Badge>
                    <span className="text-sm">{innovation}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )

      case 'experiments':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">实验设计</h3>
              <p className="text-sm leading-relaxed">{analysis.experiments.design}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <h4 className="text-md font-medium mb-2">数据集</h4>
                <div className="space-y-1">
                  {analysis.experiments.datasets.map((dataset, index) => (
                    <Badge key={index} variant="outline" className="text-xs">{dataset}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-md font-medium mb-2">评估指标</h4>
                <div className="space-y-1">
                  {analysis.experiments.metrics.map((metric, index) => (
                    <Badge key={index} variant="outline" className="text-xs">{metric}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-md font-medium mb-2">基线方法</h4>
                <div className="space-y-1">
                  {analysis.experiments.baselines.map((baseline, index) => (
                    <Badge key={index} variant="outline" className="text-xs">{baseline}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )

      case 'results':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">主要发现</h3>
              <div className="space-y-3">
                {analysis.results.main_findings.map((finding, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="flex items-start space-x-3">
                        <Badge variant="default" className="text-xs">发现 {index + 1}</Badge>
                        <p className="text-sm leading-relaxed">{finding}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-md font-medium mb-2">性能提升</h4>
              <div className="space-y-2">
                {analysis.results.performance_gains.map((gain, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-sm">{gain}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-md font-medium mb-2">结果意义</h4>
              <p className="text-sm leading-relaxed">{analysis.results.significance}</p>
            </div>

            <div>
              <h4 className="text-md font-medium mb-2">研究局限</h4>
              <div className="space-y-2">
                {analysis.results.limitations.map((limitation, index) => (
                  <div key={index} className="flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5" />
                    <span className="text-sm">{limitation}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
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
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                深度分析已完成，点击下方标签查看结果
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'overview', label: '概览' },
                  { key: 'insights', label: '洞见' },
                  { key: 'methods', label: '方法' },
                  { key: 'experiments', label: '实验' },
                  { key: 'results', label: '结果' }
                ].map(({ key, label }) => (
                  <Button
                    key={key}
                    variant={activeSection === key ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveSection(key as any)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
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
        <Card>
          <CardHeader>
            <CardTitle>深度分析结果</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] w-full">
              {renderSection()}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
