import { useEffect, useState } from 'react'
import Masonry from 'react-masonry-css'
import { supabase, Paper, PaperAnalysis } from '@/lib/supabase'
import { PaperCard } from '@/components/PaperCard'
import { useAuth } from '@/contexts/AuthContext'

interface PaperWithAnalysis {
  paper: Paper
  analysis?: PaperAnalysis | null
}

export function FavoritesPage() {
  const { user } = useAuth()
  const [papers, setPapers] = useState<PaperWithAnalysis[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadFavorites()
    }
  }, [user])

  async function loadFavorites() {
    try {
      // 获取收藏的文献ID
      const { data: favData } = await supabase
        .from('user_favorites')
        .select('paper_id')
        .eq('user_id', user!.id)

      const paperIds = favData?.map(f => f.paper_id) || []

      if (paperIds.length === 0) {
        setPapers([])
        return
      }

      // 获取文献详情
      const { data: papersData } = await supabase
        .from('papers')
        .select('*')
        .in('id', paperIds)
        .order('published_date', { ascending: false })

      // 获取分析数据
      const { data: analysisData } = await supabase
        .from('paper_analysis')
        .select('*')
        .in('paper_id', paperIds)

      const merged = papersData?.map(paper => ({
        paper,
        analysis: analysisData?.find(a => a.paper_id === paper.id) || null
      })) || []

      setPapers(merged)
    } catch (error) {
      console.error('Error loading favorites:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleFavorite(paperId: string) {
    try {
      await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', user!.id)
        .eq('paper_id', paperId)

      setPapers(prev => prev.filter(p => p.paper.id !== paperId))
    } catch (error) {
      console.error('Error removing favorite:', error)
    }
  }

  const breakpointColumns = {
    default: 2,
    1100: 2,
    700: 1
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-lg text-neutral-600">请先登录</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-lg text-neutral-600">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-neutral-800 mb-2">
            我的收藏
          </h2>
          <p className="text-neutral-600">
            共 {papers.length} 篇文献
          </p>
        </div>

        {papers.length > 0 ? (
          <Masonry
            breakpointCols={breakpointColumns}
            className="flex -ml-4 w-auto"
            columnClassName="pl-4 bg-clip-padding"
          >
            {papers.map(({ paper, analysis }) => (
              <PaperCard
                key={paper.id}
                paper={paper}
                analysis={analysis}
                tags={[]}
              />
            ))}
          </Masonry>
        ) : (
          <div className="text-center py-12 text-neutral-500">
            还没有收藏任何文献
          </div>
        )}
      </div>
    </div>
  )
}
