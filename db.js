// db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库文件路径（与 PHP 前端共用，请根据实际情况修改）
const DB_PATH = '/root/mcp2/lxbchat.db';

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ 数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('✅ 已连接到 SQLite 数据库');
});

// 初始化数据库表（如果不存在）
db.serialize(() => {
  // 用户表（由 PHP 前端维护，这里只做查询）
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 设备表（由 PHP 前端维护）
  db.run(`CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    device_name TEXT NOT NULL,
    mcp_endpoint TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, device_name)
  )`);

  // 留言表
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,          -- 接收者用户ID
    device_name TEXT NOT NULL,         -- 接收者设备名
    from_user_id INTEGER NOT NULL,     -- 发送者用户ID
    from_device TEXT NOT NULL,         -- 发送者设备名
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    read INTEGER DEFAULT 0,            -- 0未读 1已读
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // 笔记表
  db.run(`CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    device_name TEXT NOT NULL,
    note_id INTEGER NOT NULL,           -- 用户范围内唯一的笔记ID（用于语音操作）
    parent_id INTEGER DEFAULT NULL,     -- 父笔记的 note_id（同一用户内）
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_date DATETIME DEFAULT NULL,
    completed INTEGER DEFAULT 0,        -- 0未完成 1已完成
    FOREIGN KEY(user_id) REFERENCES users(id),
    UNIQUE(user_id, note_id)
  )`);

  // 用户笔记元数据表（用于生成下一个 note_id）
  db.run(`CREATE TABLE IF NOT EXISTS user_meta (
    user_id INTEGER PRIMARY KEY,
    next_note_id INTEGER DEFAULT 1,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
});

// 工具函数：获取所有设备（用于启动时加载）
function getAllDevices() {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, user_id, device_name, mcp_endpoint FROM devices', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// 工具函数：获取下一个笔记ID（针对某个用户）
function getNextNoteId(userId) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('INSERT OR IGNORE INTO user_meta (user_id, next_note_id) VALUES (?, 1)', [userId], (err) => {
        if (err) return reject(err);
        db.get('SELECT next_note_id FROM user_meta WHERE user_id = ?', [userId], (err, row) => {
          if (err) return reject(err);
          const nextId = row.next_note_id;
          db.run('UPDATE user_meta SET next_note_id = next_note_id + 1 WHERE user_id = ?', [userId], (err) => {
            if (err) return reject(err);
            resolve(nextId);
          });
        });
      });
    });
  });
}

// 工具函数：保存留言
function saveMessage(toUserId, toDevice, fromUserId, fromDevice, content) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO messages (user_id, device_name, from_user_id, from_device, content, read)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [toUserId, toDevice, fromUserId, fromDevice, content],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

// 工具函数：获取用户的未读留言（按设备名）
function getUnreadMessages(userId, deviceName) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT id, from_device, content, timestamp FROM messages
       WHERE user_id = ? AND device_name = ? AND read = 0
       ORDER BY timestamp ASC`,
      [userId, deviceName],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

// 工具函数：标记留言为已读
function markMessageAsRead(messageId) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE messages SET read = 1 WHERE id = ?', [messageId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// 工具函数：获取用户的所有笔记（按设备名）
function getUserNotes(userId, deviceName) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT note_id, parent_id, content, created_at, due_date, completed FROM notes
       WHERE user_id = ? AND device_name = ?
       ORDER BY created_at ASC`,
      [userId, deviceName],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

// 工具函数：获取单个笔记（用于更新）
function getNoteByNoteId(userId, noteId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT note_id, parent_id, completed FROM notes
       WHERE user_id = ? AND note_id = ?`,
      [userId, noteId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

// 工具函数：更新笔记完成状态
function updateNoteCompleted(userId, noteId, completed) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE notes SET completed = ? WHERE user_id = ? AND note_id = ?',
      [completed ? 1 : 0, userId, noteId],
      function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
}


// db.js 中添加以下函数

// 根据用户ID和设备名查询设备是否存在，返回设备信息或 null
function findDeviceByUserAndName(userId, deviceName) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT id, user_id, device_name FROM devices WHERE user_id = ? AND device_name = ?',
      [userId, deviceName],
      (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      }
    );
  });
}

// db.js 中新增：插入笔记
function insertNote(userId, deviceName, noteId, parentId, content, dueDate) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO notes (user_id, device_name, note_id, parent_id, content, due_date, completed)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [userId, deviceName, noteId, parentId || null, content, dueDate || null],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID); // 返回插入的 notes.id（自增主键，不是 note_id）
      }
    );
  });
}

// 工具函数：获取所有子笔记的完成状态（用于判断父节点是否应完成）
async function areAllSubtasksCompleted(userId, parentNoteId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT completed FROM notes WHERE user_id = ? AND parent_id = ?`,
      [userId, parentNoteId],
      (err, rows) => {
        if (err) reject(err);
        else {
          const allCompleted = rows.every(row => row.completed === 1);
          resolve(allCompleted);
        }
      }
    );
  });
}

module.exports = {
  getAllDevices,
  getNextNoteId,
  saveMessage,
  getUnreadMessages,
  markMessageAsRead,
  getUserNotes,
  getNoteByNoteId,
  updateNoteCompleted,
 findDeviceByUserAndName,
insertNote,
  areAllSubtasksCompleted
};