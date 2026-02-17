// tools/add_note.js
const db = require('../db');
const utils = require('./note_utils');

async function execute(args, context) {
  const { content, due_date, parent_id } = args;
  const userId = context.userId;
  const deviceName = context.deviceName;

  // 参数验证
  if (!content || typeof content !== 'string' || content.trim() === '') {
    return { success: false, error: 'content 参数必须是非空字符串' };
  }

  if (due_date && isNaN(Date.parse(due_date))) {
    return { success: false, error: 'due_date 格式无效，请使用 ISO 格式如 2026-02-20T23:59:59Z' };
  }

  try {
    // 获取下一个笔记ID
    const newNoteId = await utils.getNextNoteId(userId);

    // 使用 db.insertNote 插入笔记
    await db.insertNote(
      userId,
      deviceName,
      newNoteId,
      parent_id || null,
      content.trim(),
      due_date || null
    );

    console.log(`📝 ${deviceName} 添加笔记 ID ${newNoteId}: "${content.substring(0, 30)}..."`);

    // 如果有父笔记，检查父笔记的完成状态并更新
    if (parent_id) {
      const parent = await db.getNoteByNoteId(userId, parent_id);
      if (parent && parent.completed === 1) {
        console.log(`父笔记 ${parent_id} 已完成，添加子任务后自动设为未完成`);
        await db.updateNoteCompleted(userId, parent_id, false);
        // 递归向上更新祖父任务
        await propagateParentStatus(userId, parent.parent_id);
      }
    }

    return {
      success: true,
      message: `笔记已添加，ID: ${newNoteId}`,
      note_id: newNoteId
    };
  } catch (err) {
    console.error('❌ 添加笔记失败:', err);
    return { success: false, error: err.message };
  }
}

// 递归更新父任务状态（与 update_note.js 相同，可考虑提取到 utils）
async function propagateParentStatus(userId, parentNoteId) {
  if (!parentNoteId) return;
  const parent = await db.getNoteByNoteId(userId, parentNoteId);
  if (!parent) return;

  const allCompleted = await db.areAllSubtasksCompleted(userId, parentNoteId);
  if (allCompleted && parent.completed !== 1) {
    await db.updateNoteCompleted(userId, parentNoteId, true);
    await propagateParentStatus(userId, parent.parent_id);
  } else if (!allCompleted && parent.completed === 1) {
    await db.updateNoteCompleted(userId, parentNoteId, false);
    await propagateParentStatus(userId, parent.parent_id);
  }
}

module.exports = {
  name: 'add_note',
  description: '添加一条新笔记或待办事项。如果指定 parent_id，则添加为子任务；如果指定 due_date，则设置截止日期。',
  inputSchema: {
    type: 'object',
    properties: {
      content: { type: 'string', description: '笔记内容' },
      due_date: { type: 'string', description: '截止日期（ISO 格式，可选）' },
      parent_id: { type: 'number', description: '父笔记 ID，不提供则添加为顶层笔记' }
    },
    required: ['content']
  },
  execute
};