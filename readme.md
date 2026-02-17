const readmeContent = `# lxbchat – 智能家庭中枢 MCP 服务

为小智盒子（[xiaozhi.me](https://xiaozhi.me)）扩展的 MCP 服务，实现家庭语音留言、待办笔记、联网搜索等功能。所有工具通过 WebSocket 连接小智官方的 MCP 端点，以 JSON-RPC 形式提供。

## ✨ 功能

- **语音留言**：\`leave_message\` 给家人留言，\`check_messages\` 收听未读留言。
- **待办笔记**：\`add_note\` 创建笔记/子任务，\`update_note\` 切换完成状态（自动递归更新父任务），\`check_notes\` 查询最新未完成或指定笔记详情。
- **联网搜索**：\`volcano_search\` 通过火山引擎 DeepSeek-R1 获取实时信息（需火山 API Key 和 Bot ID）。
- **多用户支持**：基于 SQLite 数据库，每个用户可注册多个设备，数据完全隔离。
- **Web 管理界面**：配套 PHP + Vue 的前端页面，用于用户注册、登录、设备管理。
- **数据查看器**：独立的 PHP 页面 \`test_view.php\` 可查看所有设备数据，方便调试。

## 📁 技术栈

- **后端**：Node.js + WebSocket + SQLite3
- **前端**：PHP + Vue 3 + Axios
- **协议**：MCP (JSON-RPC over WebSocket)
- **搜索**：火山引擎 DeepSeek-R1 联网插件

## 🚀 部署步骤

### 1. 安装 Node.js 环境 (v18+)
\`\`\`bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo bash -
sudo apt install -y nodejs
\`\`\`

### 2. 安装 SQLite3
\`\`\`bash
sudo apt install sqlite3 php-sqlite3 -y
\`\`\`

### 3. 克隆项目
\`\`\`bash
git clone <你的仓库地址> /root/lxbchat
cd /root/lxbchat
\`\`\`

### 4. 安装 Node 依赖
\`\`\`bash
npm install ws sqlite3
\`\`\`

### 5. 创建数据库并初始化表结构
\`\`\`bash
sqlite3 /root/snv/ls/lxbchat.db <<EOF
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    device_name TEXT NOT NULL,
    mcp_endpoint TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, device_name)
);
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    device_name TEXT NOT NULL,
    from_user_id INTEGER NOT NULL,
    from_device TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    read INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    device_name TEXT NOT NULL,
    note_id INTEGER NOT NULL,
    parent_id INTEGER DEFAULT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_date DATETIME DEFAULT NULL,
    completed INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id),
    UNIQUE(user_id, note_id)
);
CREATE TABLE IF NOT EXISTS user_meta (
    user_id INTEGER PRIMARY KEY,
    next_note_id INTEGER DEFAULT 1,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
EOF
\`\`\`

### 6. 配置火山引擎（如需联网搜索）
在 \`~/.xiaozhi_mcp_config.json\` 中写入：
\`\`\`json
{
  "VOLCANO_API_KEY": "your-api-key",
  "VOLCANO_BOT_ID": "bot-xxxxxx"
}
\`\`\`
> Bot 需在火山引擎控制台创建，并开启「联网内容插件」。

### 7. 启动 MCP 服务
\`\`\`bash
node main.js
\`\`\`
推荐使用 PM2 守护：
\`\`\`bash
npm install -g pm2
pm2 start main.js --name lxbchat
pm2 startup
pm2 save
\`\`\`

### 8. 部署 Web 管理界面
将项目中的 \`index.html\` 和 \`api.php\` 复制到 Web 目录（如 \`/var/www/html/\`），并确保 \`api.php\` 中的数据库路径正确。

### 9. 访问管理界面
浏览器打开 \`http://你的服务器IP/index.html\`，注册用户后即可添加设备。

## 📱 与小智盒子配合

在 [xiaozhi.me](https://xiaozhi.me) 后台，为每台设备配置**同一个** MCP 接入点（即你的服务器地址，如 \`ws://你的IP:端口/\`）。服务启动后会自动连接所有设备。

## 🗣️ 语音命令示例

- **留言**：“留言给刘小斌，晚上回家吃饭”
- **查留言**：“查留言”
- **添加笔记**：“添加笔记 买牛奶 截止日期 2026-02-20”
- **添加子任务**：“添加笔记 看生产日期 给笔记 1”
- **切换完成**：“更新笔记 1”
- **查最新未完成笔记**：“查笔记”
- **查指定笔记**：“查笔记 1”
- **查已完成列表**：“查笔记 已完成”
- **联网搜索**：“搜索 今日金价”

## 📊 数据查看器

访问 \`http://你的服务器IP/test_view.php\` 可查看所有用户、设备、留言和笔记（需先创建该文件，内容见下文）。

## 🔧 文件结构

\`\`\`
lxbchat/
├── main.js                  # 主入口
├── mcp-core.js              # MCP 连接核心类
├── db.js                    # 数据库操作封装
├── config.js                # 保留（可选）
├── tools/                   # 工具模块
│   ├── leave_message.js
│   ├── check_messages.js
│   ├── add_note.js
│   ├── update_note.js
│   ├── check_notes.js
│   ├── note_utils.js
│   └── volcano_deepseek_search2.js
├── messages/                # 旧版文件存储（可忽略）
├── notes/                   # 旧版文件存储（可忽略）
├── index.html               # Vue 前端
├── api.php                  # PHP 后端 API
├── test_view.php            # 测试数据查看器
└── README.md
\`\`\`

## 📝 注意事项

- 确保数据库路径在 \`db.js\`、\`api.php\`、\`test_view.php\` 中一致。
- 留言功能目前仅支持同一用户内的设备互发（家庭场景），如需跨用户请修改 \`leave_message.js\`。
- 笔记 ID 按用户全局递增，可用于语音操作。
- 日志位于启动终端，可配合 \`pm2 logs\` 查看。

## 🛠️ 自定义开发

你可以轻松添加新工具：
1. 在 \`tools/\` 下新建 \`your_tool.js\`，导出 \`name\`, \`description\`, \`inputSchema\`, \`execute\`。
2. 在 \`main.js\` 中导入并加入 \`TOOL_HANDLERS\`。
3. 重启服务即可。

祝使用愉快！如有问题，欢迎反馈。
`;

console.log(readmeContent);