// main.js
const MCPConnection = require('./mcp-core');
const db = require('./db');

// 导入工具
const leaveMessage = require('./tools/leave_message');
const checkMessages = require('./tools/check_messages');
const volcanoWebSearch = require('./tools/volcano_deepseek_search2');
const addNote = require('./tools/add_note');
const updateNote = require('./tools/update_note');
const checkNotes = require('./tools/check_notes');

// 工具处理器映射表
const TOOL_HANDLERS = {
  'leave_message3': leaveMessage,
  'check_messages3': checkMessages,
  'web_search_and_deepseekllm': volcanoWebSearch,
  'add_note_task_todo': addNote,
  'update_note_task_todo': updateNote,
  'check_notes_tasks_todos': checkNotes
};

// 存储所有连接，键为设备ID（数据库中的id）
const connections = {};

console.log('🏠 启动 lxbchat 家庭聊天室');
console.log('================================');

async function start() {
  try {
    const devices = await db.getAllDevices();
    console.log(`📡 从数据库加载到 ${devices.length} 台设备`);

    for (const device of devices) {
      const { id, user_id, device_name, mcp_endpoint } = device;
      console.log(`🔌 正在连接设备 ID ${id} (${device_name})...`);

      // 创建连接实例，传入 deviceId, userId, deviceName
      const conn = new MCPConnection(
        id,
        device_name,
        mcp_endpoint,
        TOOL_HANDLERS,
        connections,
        user_id
      );
      connections[id] = conn;
      conn.connect();
    }

    console.log(`📊 共配置 ${Object.keys(connections).length} 台设备`);
  } catch (err) {
    console.error('❌ 启动失败:', err);
    process.exit(1);
  }
}

start();

process.on('SIGINT', () => {
  console.log('\n👋 收到中断信号，关闭所有连接...');
  for (const id in connections) {
    connections[id].close();
  }
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('❌ 未捕获的异常:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('❌ 未处理的Promise拒绝:', err);
});