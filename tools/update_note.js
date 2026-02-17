// tools/update_note.js
const db = require('../db');
const utils = require('./note_utils');

async function execute(args, context) {
  const { note_id, action } = args;
  const userId = context.userId;

  if (!note_id) {
    return { success: false, error: '缺少 note_id 参数' };
  }

  try {
    // 获取当前笔记
    const note = await db.getNoteByNoteId(userId, note_id);
    if (!note) {
      return { success: false, error: `未找到 ID 为 ${note_id} 的笔记` };
    }

    let newCompleted;
    if (action === 'complete') {
      newCompleted = true;
    } else if (action === 'incomplete') {
      newCompleted = false;
    } else {
      newCompleted = !note.completed; // 切换
    }

    if (note.completed !== newCompleted) {
      // 更新当前笔记
      await db.updateNoteCompleted(userId, note_id, newCompleted);

      // 递归更新父任务
      await propagateParentStatus(userId, note.parent_id);
    }

    const statusText = newCompleted ? '已完成' : '未完成';
    return {
      success: true,
      message: `笔记 ${note_id} 已标记为 ${statusText}`
    };
  } catch (err) {
    console.error('❌ 更新笔记失败:', err);
    return { success: false, error: err.message };
  }
}

// 递归更新父任务状态：检查父节点的所有子任务是否都已完成，若是则标记父节点完成，否则标记未完成，并继续向上
async function propagateParentStatus(userId, parentNoteId) {
  if (!parentNoteId) return; // 顶层

  const parent = await db.getNoteByNoteId(userId, parentNoteId);
  if (!parent) return;

  // 检查所有子任务是否都已完成
  const allCompleted = await db.areAllSubtasksCompleted(userId, parentNoteId);

  if (allCompleted && parent.completed !== 1) {
    // 所有子任务完成，父任务应标记为完成
    await db.updateNoteCompleted(userId, parentNoteId, true);
    // 继续向上
    await propagateParentStatus(userId, parent.parent_id);
  } else if (!allCompleted && parent.completed === 1) {
    // 存在未完成子任务，父任务应标记为未完成
    await db.updateNoteCompleted(userId, parentNoteId, false);
    // 继续向上
    await propagateParentStatus(userId, parent.parent_id);
  }
  // 否则父任务状态无需改变
}

module.exports = {
  name: 'update_note',
  description: '更新笔记状态。可指定 action 为 complete 或 incomplete，不指定则切换当前状态。会自动递归更新父任务状态。',
  inputSchema: {
    type: 'object',
    properties: {
      note_id: { type: 'number', description: '笔记 ID' },
      action: { type: 'string', enum: ['complete', 'incomplete'], description: '指定完成或未完成（可选）' }
    },
    required: ['note_id']
  },
  execute
};