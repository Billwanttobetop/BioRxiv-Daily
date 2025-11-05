import { useState } from 'react'
import { Heart, ExternalLink, ChevronDown, ChevronUp, Share2, Tag as TagIcon } from 'lucide-react'
import { Paper, PaperAnalysis, addFavorite, removeFavorite } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

interface PaperCardProps {
  paper: Paper
  analysis?: PaperAnalysis | null
  tags?: string[]
  onAnalyze?: (paperId: string) => void
  onTagClick?: (tag: string) => void
  analyzing?: boolean
  initialIsFavorited?: boolean
}

export function PaperCard({ 
  paper, 
  analysis, 
  tags = [],
  onAnalyze, 
  onTagClick,
  analyzing,
  initialIsFavorited = false
}: PaperCardProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const [abstractExpanded, setAbstractExpanded] = useState(false)
  const [shareSuccess, setShareSuccess] = useState(false)
  const [institutionsExpanded, setInstitutionsExpanded] = useState(false)
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited)
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false)


  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/paper/${paper.id}`
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareSuccess(true)
      setTimeout(() => setShareSuccess(false), 2000)
    } catch (err) {
      // 如果复制失败，使用fallback
      const input = document.createElement('input')
      input.value = shareUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setShareSuccess(true)
      setTimeout(() => setShareSuccess(false), 2000)
    }
  }

  const handleFavorite = async () => {
    if (!user) {
      navigate('/login')
      return
    }

    setIsTogglingFavorite(true)
    try {
      if (isFavorited) {
        await removeFavorite(user.id, paper.id)
      } else {
        await addFavorite(user.id, paper.id)
      }
      setIsFavorited(!isFavorited)
    } catch (error) {
      console.error("Error toggling favorite:", error)
      // Optional: show an error message to the user
    } finally {
      setIsTogglingFavorite(false)
    }
  }






  return (
    <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow mb-4 border border-neutral-100 relative">
      {/* 右上角机构标签 */}
      {analysis?.main_institutions && analysis.main_institutions.length > 0 && (
        <div className="absolute top-2 right-2 z-0 sm:top-3 sm:right-3">
          <div className="flex flex-wrap gap-1 max-w-[80px] sm:max-w-[120px] justify-end">
            {institutionsExpanded 
              ? analysis.main_institutions.slice(0, 2).map((inst, idx) => (
                  <span 
                    key={idx}
                    className="text-[9px] sm:text-[10px] px-1 py-0.5 bg-orange-100 text-orange-700 rounded-full border border-orange-200 text-right"
                    title={inst}
                  >
                    {inst.length > 8 ? inst.substring(0, 8) + '...' : inst}
                  </span>
                ))
              : analysis.main_institutions.slice(0, 1).map((inst, idx) => (
                  <span 
                    key={idx}
                    className="text-[9px] sm:text-[10px] px-1 py-0.5 bg-orange-100 text-orange-700 rounded-full border border-orange-200 text-right"
                    title={inst}
                  >
                    {inst.length > 6 ? inst.substring(0, 6) + '...' : inst}
                  </span>
                ))
            }
            {analysis.main_institutions.length > 1 && (
              <button
                onClick={() => setInstitutionsExpanded(!institutionsExpanded)}
                className="text-[9px] sm:text-[10px] px-1 py-0.5 bg-neutral-100 text-neutral-600 rounded-full border border-neutral-200 hover:bg-neutral-200 transition-colors"
                title={institutionsExpanded ? '收起机构' : '展开机构'}
              >
                {institutionsExpanded ? '收起' : `+${analysis.main_institutions.length - 1}`}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="p-6">
        {/* 标题 */}
        <div className="mb-3 pr-16 sm:pr-80">
          <div className="flex items-start gap-2 group">
            <a 
              href={paper.source_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-base sm:text-lg font-semibold text-neutral-800 hover:text-amber-600 transition-colors flex-1"
            >
              <span className="paper-title block">
                {analysis?.title_cn || paper.title}
              </span>
            </a>
            <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
          </div>
          {analysis?.title_cn && (
            <p className="text-xs sm:text-sm text-neutral-500 mt-1 line-clamp-2 break-words">{paper.title}</p>
          )}
        </div>

        {/* 标签 */}
        {tags && tags.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, idx) => (
                <button
                  key={idx}
                  onClick={() => onTagClick?.(tag)}
                  className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded-full hover:bg-amber-100 transition-colors flex items-center gap-1"
                >
                  <TagIcon className="w-3 h-3" />
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 摘要 */}
        <div className="mb-3">
          <div className="relative">
            <p className={`text-sm text-neutral-600 ${abstractExpanded ? '' : 'line-clamp-3'}`}>
              {analysis?.abstract_cn || paper.abstract || '暂无摘要'}
            </p>
            {(analysis?.abstract_cn || paper.abstract || '').length > 200 && (
              <button
                onClick={() => setAbstractExpanded(!abstractExpanded)}
                className="text-xs text-amber-600 hover:text-amber-700 mt-1 font-medium"
              >
                {abstractExpanded ? '收起摘要' : '展开摘要'}
              </button>
            )}
          </div>
        </div>

        {/* 元信息 */}
        <div className="flex items-center text-xs text-neutral-500 mb-3">
          <div className="flex items-center gap-4">
            <span>{new Date(paper.published_date).toLocaleDateString('zh-CN')}</span>
            <span>{paper.authors.slice(0, 3).join(', ')}{paper.authors.length > 3 ? ' 等' : ''}</span>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="border-t border-neutral-100 pt-3">
          {/* 第一行：主要操作按钮 */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-1 sm:gap-2 flex-wrap">
              {!analysis && onAnalyze && (
                <button
                  onClick={() => onAnalyze(paper.id)}
                  disabled={analyzing}
                  className="text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {analyzing ? '分析中...' : 'AI分析'}
                </button>
              )}
              {analysis && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2 bg-neutral-100 text-neutral-700 rounded-md hover:bg-neutral-200 transition-colors flex items-center gap-1"
                >
                  {expanded ? (
                    <>收起分析 <ChevronUp className="w-3 h-3 sm:w-4 sm:h-4" /></>
                  ) : (
                    <>查看分析 <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4" /></>
                  )}
                </button>
              )}
              <a
                href={paper.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2 bg-neutral-100 text-neutral-700 rounded-md hover:bg-neutral-200 transition-colors"
              >
                PDF
              </a>
            </div>
          </div>
          
          {/* 第二行：分享和收藏按钮 */}
          <div className="flex justify-end items-center gap-2">
            <button
              onClick={handleFavorite}
              disabled={isTogglingFavorite}
              className="text-xs px-2 py-1 sm:px-3 sm:py-1.5 bg-neutral-100 text-neutral-700 rounded-md hover:bg-neutral-200 transition-colors flex items-center gap-1 relative disabled:opacity-50"
              title={isFavorited ? "取消收藏" : "收藏"}
            >
              <Heart className={`w-3 h-3 sm:w-4 sm:h-4 transition-all ${isFavorited ? 'text-red-500 fill-current' : 'text-neutral-600'}`} />
              <span className="hidden sm:inline">{isFavorited ? '已收藏' : '收藏'}</span>
            </button>
            <button
              onClick={handleShare}
              className="text-xs px-2 py-1 sm:px-3 sm:py-1.5 bg-neutral-100 text-neutral-700 rounded-md hover:bg-neutral-200 transition-colors flex items-center gap-1 relative"
            >
              <Share2 className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">分享</span>
              {shareSuccess && (
                <span className="absolute -top-6 right-0 text-xs bg-green-500 text-white px-2 py-0.5 rounded-md">
                  链接已复制
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 第三行：展开的分析内容 */}
        {expanded && analysis && (
          <div className="mt-4 space-y-4 border-t border-neutral-100 pt-4">
            {analysis.insights && (
              <div>
                <h4 className="font-semibold text-neutral-800 mb-2">全文洞察</h4>
                <p className="text-sm text-neutral-600 whitespace-pre-line">{analysis.insights}</p>
              </div>
            )}
            {analysis.solutions && (
              <div>
                <h4 className="font-semibold text-neutral-800 mb-2">解决方案</h4>
                <p className="text-sm text-neutral-600 whitespace-pre-line">{analysis.solutions}</p>
              </div>
            )}
            {analysis.limitations && (
              <div>
                <h4 className="font-semibold text-neutral-800 mb-2">局限性</h4>
                <p className="text-sm text-neutral-600 whitespace-pre-line">{analysis.limitations}</p>
              </div>
            )}
            {analysis.prospects && (
              <div>
                <h4 className="font-semibold text-neutral-800 mb-2">研究展望</h4>
                <p className="text-sm text-neutral-600 whitespace-pre-line">{analysis.prospects}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
