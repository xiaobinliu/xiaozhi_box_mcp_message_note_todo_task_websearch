// tools/leave_message.js
const db = require('../db');

async function execute(args, context) {
  const { to, content } = args;          // to 是目标设备名
  const fromDevice = context.deviceName; // 发送者设备名
  const fromUserId = context.userId;     // 发送者用户ID

  if (!to || !content) {
    return { success: false, error: '缺少 to 或 content 参数' };
  }

  try {
    // 验证目标设备是否存在且属于当前用户（假设只允许同用户设备间留言）
    const targetDevice = await db.findDeviceByUserAndName(fromUserId, to);
    if (!targetDevice) {
      return { success: false, error: `目标设备 "${to}" 不存在或不属于您` };
    }

    // 保存留言（接收者用户ID为当前用户ID，因为 targetDevice 属于同一用户）
    await db.saveMessage(fromUserId, to, fromUserId, fromDevice, content);
    console.log(`📝 留言已保存: ${fromDevice} → ${to}: ${content.substring(0, 30)}...`);

    return {
      success: true,
      message: `留言已发送给${to}`
    };
  } catch (err) {
    console.error('❌ 留言保存失败:', err);
    return { success: false, error: `留言失败: ${err.message}` };
  }
}

module.exports = {
  name: 'leave_message',
  description: '给家人留言，对方可以稍后收听。接收方为家人姓名，例如“刘小斌”。',
  inputSchema: {
    type: 'object',
    properties: {
      to: {
        type: 'string',
        description: '接收留言的家人姓名（如“刘小斌”）'
      },
      content: {
        type: 'string',
        description: '留言内容'
      }
    },
    required: ['to', 'content']
  },
  execute
};