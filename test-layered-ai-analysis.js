// 测试分层AI分析系统
// 测试自动翻译和深度分析的分离

const SUPABASE_URL = 'https://scqsayezaiiqfwqbrsef.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcXNheWV6YWlpcWZ3cWJyc2VmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwNDEzNjAsImV4cCI6MjA3NzYxNzM2MH0.0Ot6l8PL3hAtFhrfaiLysDIBVD9ErUx2yjs-wrcJDXU'

// 测试论文数据（模拟真实论文）
const testPapers = [
  {
    title: "Optimal Function Moment Estimation under Covariate Shift",
    abstract: "In real-world machine learning tasks, covariate shift is a common but underexplored problem. This paper studies how to calibrate optimal function estimators from source distribution to maintain their optimality for function moment estimation under target distribution with covariate shift. The core problem is how to use source distribution data to accurately estimate function moments under target distribution, especially when both source and target distributions are unknown.",
    authors: ["John Smith", "Alice Johnson", "Bob Chen"]
  },
  {
    title: "Deep Learning Approaches for Biomedical Image Analysis",
    abstract: "Recent advances in deep learning have revolutionized biomedical image analysis. This study presents a comprehensive framework combining convolutional neural networks with attention mechanisms for improved diagnostic accuracy. We demonstrate significant improvements in segmentation tasks across multiple biomedical imaging modalities.",
    authors: ["Maria Garcia", "David Lee", "Sarah Wilson"]
  }
]

// 测试自动翻译功能
async function testAutomaticTranslation() {
  console.log('🧪 测试自动翻译功能...')
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/translate-paper`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        paper_id: 'test-paper-1',
        title: testPapers[0].title,
        abstract: testPapers[0].abstract,
        priority: 1
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP错误! 状态: ${response.status}`)
    }

    const data = await response.json()
    console.log('✅ 自动翻译测试结果:')
    console.log('翻译标题:', data.data.title_cn)
    console.log('翻译摘要:', data.data.abstract_cn?.substring(0, 200) + '...')
    console.log('成本: $', data.data.translation_cost)
    console.log('Token数量:', data.data.token_count)
    
    return data
  } catch (error) {
    console.error('❌ 自动翻译测试失败:', error.message)
    return null
  }
}

// 测试深度分析功能
async function testDeepAnalysis() {
  console.log('\n🧠 测试深度分析功能...')
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze-paper-deep`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        paper_id: 'test-paper-1',
        analysis_type: 'comprehensive'
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP错误! 状态: ${response.status}`)
    }

    const data = await response.json()
    console.log('✅ 深度分析测试结果:')
    console.log('研究动机:', data.data.motivation?.substring(0, 150) + '...')
    console.log('核心洞见数量:', data.data.insights?.length || 0)
    console.log('技术新颖性评分:', data.data.technical_novelty_score)
    console.log('实际影响评分:', data.data.practical_impact_score)
    console.log('理论贡献评分:', data.data.theoretical_contribution_score)
    console.log('置信度评分:', data.data.confidence_score)
    console.log('处理时间:', data.data.processing_time, '秒')
    
    return data
  } catch (error) {
    console.error('❌ 深度分析测试失败:', error.message)
    return null
  }
}

// 测试翻译队列处理
async function testTranslationQueue() {
  console.log('\n⚙️ 测试翻译队列处理...')
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/process-translation-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP错误! 状态: ${response.status}`)
    }

    const data = await response.json()
    console.log('✅ 翻译队列处理结果:')
    console.log('处理任务数量:', data.data.processed)
    console.log('成功数量:', data.data.successful)
    console.log('失败数量:', data.data.failed)
    
    return data
  } catch (error) {
    console.error('❌ 翻译队列测试失败:', error.message)
    return null
  }
}

// 测试成本计算
function testCostCalculation() {
  console.log('\n💰 测试成本计算...')
  
  // 模拟不同长度的文本
  const testCases = [
    { title: "Short Paper Title", abstract: "This is a short abstract." },
    { title: "Medium Length Paper Title About Some Research", abstract: "This is a medium length abstract that contains more details about the research methodology and findings. It should be representative of a typical academic paper abstract." },
    { title: "A Very Long and Detailed Paper Title That Describes Complex Research in Biomedical Engineering with Multiple Methodologies", abstract: "This is a very long abstract that contains extensive details about the research background, methodology, experimental design, results, and implications. It represents a comprehensive summary of a complex research study with multiple components and significant findings that would require detailed analysis and translation." }
  ]

  testCases.forEach((testCase, index) => {
    const totalText = testCase.title + ' ' + testCase.abstract
    const estimatedTokens = Math.ceil(totalText.length * 0.5) // 粗略估算
    const inputCost = (estimatedTokens / 1000000) * 0.14 // DeepSeek输入成本
    const outputCost = (estimatedTokens * 1.5 / 1000000) * 0.28 // 假设输出是输入的1.5倍
    const totalCost = inputCost + outputCost

    console.log(`测试用例 ${index + 1}:`)
    console.log(`  文本长度: ${totalText.length} 字符`)
    console.log(`  估算Token: ${estimatedTokens}`)
    console.log(`  翻译成本: $${totalCost.toFixed(6)}`)
  })
}

// 主测试函数
async function runAllTests() {
  console.log('🚀 开始分层AI分析系统测试\n')
  console.log('='.repeat(60))
  
  // 测试成本计算
  testCostCalculation()
  
  // 测试自动翻译
  await testAutomaticTranslation()
  
  // 测试翻译队列
  await testTranslationQueue()
  
  // 测试深度分析
  await testDeepAnalysis()
  
  console.log('\n' + '='.repeat(60))
  console.log('✅ 分层AI分析系统测试完成！')
  console.log('\n📊 系统特点:')
  console.log('• 自动翻译：低成本，批量处理')
  console.log('• 深度分析：用户触发，结构化输出')
  console.log('• 成本控制：按需分析，避免浪费')
  console.log('• 队列管理：智能调度，高可靠性')
}

// 运行测试
runAllTests().catch(console.error)