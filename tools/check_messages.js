// tools/check_messages.js
const db = require('../db');

async function execute(args, context) {
  const deviceName = context.deviceName;
  const userId = context.userId;

  try {
    const unreadMessages = await db.getUnreadMessages(userId, deviceName);

    if (unreadMessages.length === 0) {
      return {
        success: true,
        hasNew: false,
        totalUnread: 0,
        latest: null
      };
    }

    // 按时间顺序，取最早的一条（先进先出）
    const latest = unreadMessages[0];
    await db.markMessageAsRead(latest.id);

    const remainingUnread = unreadMessages.length - 1;

    return {
      success: true,
      hasNew: true,
      totalUnread: remainingUnread,
      latest: {
        from: latest.from_device,
        content: latest.content,
        timestamp: latest.timestamp
      }
    };
  } catch (err) {
    console.error('❌ 查询留言失败:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  name: 'check_messages',
  description: '查看自己的未读留言，返回最新一条及剩余条数',
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  },
  execute
};