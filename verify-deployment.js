// 验证脚本：测试fetch-biorxiv-papers Edge Function的完整流程
// 这个脚本模拟前端调用，验证部署是否成功

const SUPABASE_URL = 'https://scqsayezaiiqfwqbrsef.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcXNheWV6YWlpcWZ3cWJyc2VmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwNDEzNjAsImV4cCI6MjA3NzYxNzM2MH0.0Ot6l8PL3hAtFhrfaiLysDIBVD9ErUx2yjs-wrcJDXU';

async function testEdgeFunction() {
  console.log('🧪 开始测试fetch-biorxiv-papers Edge Function...\n');
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/fetch-biorxiv-papers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        limit: 3,
        timestamp: Date.now()
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP错误! 状态: ${response.status}`);
    }

    const data = await response.json();
    
    console.log('✅ Edge Function调用成功！');
    console.log('📊 响应数据:', JSON.stringify(data, null, 2));
    
    // 验证响应结构
    if (data.success && data.data) {
      console.log(`\n📈 获取结果:`);
      console.log(`   - 总获取论文数: ${data.data.total_fetched}`);
      console.log(`   - 新增论文数: ${data.data.new_papers}`);
      console.log(`   - 错误数: ${data.data.errors.length}`);
      
      if (data.data.errors.length > 0) {
        console.log(`   - 错误详情:`, data.data.errors);
      }
      
      console.log(`\n🎉 部署验证成功！Edge Function正常工作。`);
      console.log(`📄 消息: ${data.message}`);
      
    } else {
      console.log(`\n❌ 响应格式异常:`, data);
    }
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('请检查:');
    console.error('1. Edge Function是否已正确部署');
    console.error('2. Supabase配置是否正确');
    console.error('3. 网络连接是否正常');
  }
}

// 运行测试
testEdgeFunction();