import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase, Paper, PaperAnalysis } from '@/lib/supabase'
import { PaperCard } from '@/components/PaperCard'

export function PaperDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [paper, setPaper] = useState<Paper | null>(null)
  const [analysis, setAnalysis] = useState<PaperAnalysis | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      loadPaper(id)
    }
  }, [id])

  async function loadPaper(paperId: string) {
    try {
      // 获取文献信息
      const { data: paperData } = await supabase
        .from('papers')
        .select('*')
        .eq('id', paperId)
        .maybeSingle()

      if (!paperData) {
        navigate('/')
        return
      }

      setPaper(paperData)

      // 获取分析数据
      const { data: analysisData } = await supabase
        .from('paper_analysis')
        .select('*')
        .eq('paper_id', paperId)
        .maybeSingle()

      setAnalysis(analysisData)

      // 获取标签
      const { data: paperTagsData } = await supabase
        .from('paper_tags')
        .select('*')
        .eq('paper_id', paperId)

      if (paperTagsData && paperTagsData.length > 0) {
        const tagIds = paperTagsData.map(pt => pt.tag_id)
        const { data: tagsData } = await supabase
          .from('tags')
          .select('*')
          .in('id', tagIds)

        if (tagsData) {
          const tagNames = tagsData.map(tag => tag.name)
          setTags(tagNames)
        }
      }
    } catch (error) {
      console.error('Error loading paper:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-lg text-neutral-600">加载中...</div>
      </div>
    )
  }

  if (!paper) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-lg text-neutral-600">文献不存在</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-neutral-700 hover:text-amber-600 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          返回首页
        </button>

        <PaperCard
          paper={paper}
          analysis={analysis}
          tags={tags}
        />
      </div>
    </div>
  )
}
