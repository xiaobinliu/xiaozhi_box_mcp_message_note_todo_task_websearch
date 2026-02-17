// tools/check_notes.js
const db = require('../db');
const utils = require('./note_utils');

function daysRemaining(dueDate) {
  if (!dueDate) return null;
  const now = new Date();
  const due = new Date(dueDate);
  const diff = due - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatNoteDetail(node) {
  const status = node.completed ? '✅ 已完成' : '⏳ 待办';
  const created = new Date(node.created_at).toLocaleDateString('zh-CN');
  const due = node.due_date ? new Date(node.due_date).toLocaleDateString('zh-CN') : '无截止日期';
  const remaining = node.due_date ? daysRemaining(node.due_date) : null;
  const remainingText = remaining !== null ? (remaining >= 0 ? `剩余 ${remaining} 天` : `已超期 ${-remaining} 天`) : '';

  let detail = `ID: ${node.note_id}\n内容: ${node.content}\n创建日期: ${created}\n截止日期: ${due} ${remainingText}\n状态: ${status}`;

  if (node.subtasks && node.subtasks.length > 0) {
    detail += '\n子任务:';
    node.subtasks.forEach(sub => {
      const subStatus = sub.completed ? '✅' : '⭕';
      detail += `\n  ${subStatus} [${sub.note_id}] ${sub.content}`;
    });
  }
  return detail;
}

async function execute(args, context) {
  const { id, filter } = args;
  const userId = context.userId;
  const deviceName = context.deviceName;

  try {
    // 获取该设备的所有笔记
    const notes = await db.getUserNotes(userId, deviceName);
    if (notes.length === 0) {
      return { success: true, message: '还没有任何笔记', notes: [] };
    }

    // 构建树
    const tree = utils.buildNoteTree(notes);

    if (id) {
      // 查找指定笔记
      const node = utils.findNodeInTree(tree, id);
      if (!node) {
        return { success: false, error: `未找到 ID 为 ${id} 的笔记` };
      }
      return {
        success: true,
        note: formatNoteDetail(node),
        raw_note: node
      };
    }

    if (filter === 'completed') {
      // 收集所有已完成笔记（平铺，不分层）
      const completed = notes.filter(n => n.completed === 1);
      if (completed.length === 0) {
        return { success: true, message: '没有已完成笔记', notes: [] };
      }
      completed.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const summary = completed.map(n => `[${n.note_id}] ${n.content} (完成)`).join('\n');
      const latestId = completed[0].note_id;
      return {
        success: true,
        filter: 'completed',
        count: completed.length,
        latest_id: latestId,
        summary: `已完成笔记共 ${completed.length} 条，最新一条 ID: ${latestId}\n${summary}`,
        notes: completed
      };
    }

    // 默认返回最新一条未完成笔记（从树中找）
    const pending = notes.filter(n => n.completed === 0);
    if (pending.length === 0) {
      return { success: true, message: '没有未完成笔记' };
    }
    pending.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const latestNote = pending[0];
    // 我们需要从树中找到这个节点才能获得子任务列表。可以重新在树中查找
    const node = utils.findNodeInTree(tree, latestNote.note_id);
    return {
      success: true,
      note: formatNoteDetail(node),
      raw_note: node,
      message: '最新一条未完成笔记'
    };
  } catch (err) {
    console.error('❌ 读取笔记失败:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  name: 'check_notes',
  description: '查询笔记。无参数返回最新未完成；带 id 返回该笔记详情；带 filter="completed" 返回已完成列表',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'number', description: '笔记 ID（可选）' },
      filter: { type: 'string', enum: ['completed'], description: '筛选已完成笔记' }
    },
    required: []
  },
  execute
};