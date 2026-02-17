// tools/note_utils.js
const db = require('../db');

// 获取下一个笔记ID（用户范围内）
async function getNextNoteId(userId) {
  return db.getNextNoteId(userId);
}

// 递归构建笔记树（从平铺列表）
function buildNoteTree(notes) {
  const map = {};
  const roots = [];
  notes.forEach(note => {
    map[note.note_id] = { ...note, subtasks: [] };
  });
  notes.forEach(note => {
    if (note.parent_id === null) {
      roots.push(map[note.note_id]);
    } else {
      if (map[note.parent_id]) {
        map[note.parent_id].subtasks.push(map[note.note_id]);
      }
    }
  });
  return roots;
}

// 查找节点（在树中递归查找）
function findNodeInTree(tree, targetNoteId) {
  for (const node of tree) {
    if (node.note_id === targetNoteId) return node;
    if (node.subtasks && node.subtasks.length > 0) {
      const found = findNodeInTree(node.subtasks, targetNoteId);
      if (found) return found;
    }
  }
  return null;
}

// 检查所有子任务是否完成（给定节点）
function allSubtasksCompleted(node) {
  return node.subtasks.every(sub => sub.completed === 1);
}

module.exports = {
  getNextNoteId,
  buildNoteTree,
  findNodeInTree,
  allSubtasksCompleted
};