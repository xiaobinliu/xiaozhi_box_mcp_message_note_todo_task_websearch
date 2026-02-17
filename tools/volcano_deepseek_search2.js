// tools/volcano_deepseek_search2.js
const https = require('https');
const db = require('../db');   // 引入数据库模块
const fs = require('fs');
const path = require('path');
const CONFIG_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.xiaozhi_mcp_config.json');
// 不再需要 MESSAGES_DIR

// 加载配置（保持不变）
function loadConfig() {
  try {
    const data = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(data);
  } catch {
    return { VOLCANO_API_KEY: "火山引擎的API_KEY", VOLCANO_BOT_ID: "BOT_ID" };
  }
}

// 简化回答内容（不变）
function simplifyAnswer(answer, maxLength = 150) {
  if (answer.length <= maxLength) return answer;
  return answer.substring(0, maxLength) + '……';
}

async function execute(args, context) {
  const { query } = args;
  const deviceName = context.deviceName;
  const userId = context.userId;

  console.log(`🔍 火山引擎联网搜索: "${query}" (由 ${deviceName} 发起)`);

  const immediateResponse = {
    success: true,
    message: '正在联网搜索，结果将以留言形式发送给您，请稍后查看留言。'
  };

  (async () => {
    try {
      const config = loadConfig();
      const apiKey = config.VOLCANO_API_KEY;
      const botId = config.VOLCANO_BOT_ID;

      if (!apiKey || !botId) {
        throw new Error('火山引擎配置缺失');
      }

      const requestBody = {
        model: botId,
        messages: [
          { 
            role: 'system', 
            content: '你是一个可以联网搜索的助手。请用非常简洁的几句话回答用户问题，直接给出核心信息，不要输出表格、来源列表、详细分析。总字数控制在150字以内。' 
          },
          { role: 'user', content: query }
        ],
        max_tokens: 200,
        temperature: 0.3,
        stream: false
      };

      const data = JSON.stringify(requestBody);
      const options = {
        hostname: 'ark.cn-beijing.volces.com',
        path: '/api/v3/bots/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const result = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let responseData = '';
          res.on('data', chunk => responseData += chunk);
          res.on('end', () => {
            if (res.statusCode !== 200) {
              reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
              return;
            }
            resolve(JSON.parse(responseData));
          });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      let answer = result.choices?.[0]?.message?.content || '';
      if (!answer) answer = '未找到相关结果。';

      const simplified = simplifyAnswer(answer, 150);

      // 保存留言到数据库，发送者是“系统”，接收者是当前用户和当前设备
      await db.saveMessage(userId, deviceName, userId, '系统', `🔍 您搜索的“${query}”结果：\n${simplified}`);
      console.log(`✅ 搜索结果已保存为 ${deviceName} 的留言（精简版）`);
    } catch (err) {
      console.error('❌ 火山引擎搜索失败:', err);
      await db.saveMessage(userId, deviceName, userId, '系统', `搜索“${query}”失败：${err.message}`);
    }
  })();

  return immediateResponse;
}

module.exports = {
  name: 'volcano_search',
  description: '使用火山引擎DeepSeek进行联网搜索，结果将通过留言发送',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '搜索内容' }
    },
    required: ['query']
  },
  execute
};