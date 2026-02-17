<?php
// test_view.php - 显示所有设备、留言和笔记（用于测试）

// 数据库路径（请根据实际修改）
$dbPath = '/root/mcp2/lxbchat.db';

try {
    $pdo = new PDO("sqlite:$dbPath");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die("数据库连接失败: " . $e->getMessage());
}

// 获取所有用户
$users = $pdo->query("SELECT id, username FROM users ORDER BY id")->fetchAll(PDO::FETCH_ASSOC);

// 获取所有设备（带用户信息）
$devices = $pdo->query("
    SELECT d.id, d.user_id, u.username, d.device_name, d.mcp_endpoint, d.created_at
    FROM devices d
    JOIN users u ON d.user_id = u.id
    ORDER BY d.user_id, d.device_name
")->fetchAll(PDO::FETCH_ASSOC);

// 获取所有留言（按时间倒序）
$messages = $pdo->query("
    SELECT m.id, m.user_id, m.device_name, u.username as receiver_name,
           m.from_user_id, fu.username as sender_name,
           m.from_device, m.content, m.timestamp, m.read
    FROM messages m
    JOIN users u ON m.user_id = u.id
    JOIN users fu ON m.from_user_id = fu.id
    ORDER BY m.timestamp DESC
")->fetchAll(PDO::FETCH_ASSOC);

// 获取所有笔记（按时间倒序）
$notes = $pdo->query("
    SELECT n.id, n.user_id, u.username, n.device_name, n.note_id, n.parent_id,
           n.content, n.created_at, n.due_date, n.completed
    FROM notes n
    JOIN users u ON n.user_id = u.id
    ORDER BY n.user_id, n.device_name, n.note_id
")->fetchAll(PDO::FETCH_ASSOC);

// 按设备分组留言和笔记
$messagesByDevice = [];
foreach ($messages as $msg) {
    $key = $msg['user_id'] . '|' . $msg['device_name'];
    $messagesByDevice[$key][] = $msg;
}

$notesByDevice = [];
foreach ($notes as $note) {
    $key = $note['user_id'] . '|' . $note['device_name'];
    $notesByDevice[$key][] = $note;
}
?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>测试视图 - 所有设备数据</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        h1 { color: #333; }
        .section { background: white; border-radius: 8px; padding: 15px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .device { border-left: 4px solid #3b82f6; margin: 15px 0; padding: 10px; background: #f8fafc; border-radius: 4px; }
        .device h3 { margin: 0 0 10px 0; color: #0f172a; }
        .device-info { font-size: 0.9em; color: #64748b; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        th { background: #f1f5f9; }
        .unread { background: #fff3cd; }
        .completed { text-decoration: line-through; color: #94a3b8; }
        .note-tree { font-family: monospace; }
        .indent { margin-left: 20px; }
        .badge { background: #3b82f6; color: white; padding: 2px 6px; border-radius: 12px; font-size: 12px; }
    </style>
</head>
<body>
    <h1>📊 数据库测试视图</h1>

    <!-- 用户列表 -->
    <div class="section">
        <h2>👥 用户列表</h2>
        <?php if (count($users) > 0): ?>
            <table>
                <thead><tr><th>ID</th><th>用户名</th></tr></thead>
                <tbody>
                <?php foreach ($users as $user): ?>
                    <tr><td><?= $user['id'] ?></td><td><?= htmlspecialchars($user['username']) ?></td></tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        <?php else: ?>
            <p>暂无用户。</p>
        <?php endif; ?>
    </div>

    <!-- 设备列表 -->
    <div class="section">
        <h2>📱 设备列表</h2>
        <?php if (count($devices) > 0): ?>
            <table>
                <thead><tr><th>ID</th><th>用户</th><th>设备名</th><th>MCP 端点</th><th>创建时间</th></tr></thead>
                <tbody>
                <?php foreach ($devices as $d): ?>
                    <tr>
                        <td><?= $d['id'] ?></td>
                        <td><?= htmlspecialchars($d['username']) ?> (ID:<?= $d['user_id'] ?>)</td>
                        <td><?= htmlspecialchars($d['device_name']) ?></td>
                        <td style="max-width:300px; overflow-x:auto;"><?= htmlspecialchars($d['mcp_endpoint']) ?></td>
                        <td><?= $d['created_at'] ?></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        <?php else: ?>
            <p>暂无设备。</p>
        <?php endif; ?>
    </div>

    <!-- 按设备显示留言和笔记 -->
    <div class="section">
        <h2>💬 留言与笔记（按设备）</h2>
        <?php if (count($devices) === 0): ?>
            <p>暂无设备。</p>
        <?php else: ?>
            <?php foreach ($devices as $device): ?>
                <?php $key = $device['user_id'] . '|' . $device['device_name']; ?>
                <div class="device">
                    <h3><?= htmlspecialchars($device['username']) ?> → <?= htmlspecialchars($device['device_name']) ?></h3>
                    <div class="device-info">设备ID: <?= $device['id'] ?>, 用户ID: <?= $device['user_id'] ?></div>

                    <!-- 留言 -->
                    <h4>📨 留言</h4>
                    <?php if (isset($messagesByDevice[$key]) && count($messagesByDevice[$key]) > 0): ?>
                        <table>
                            <thead><tr><th>ID</th><th>发送者</th><th>内容</th><th>时间</th><th>状态</th></tr></thead>
                            <tbody>
                            <?php foreach ($messagesByDevice[$key] as $msg): ?>
                                <tr class="<?= $msg['read'] ? '' : 'unread' ?>">
                                    <td><?= $msg['id'] ?></td>
                                    <td><?= htmlspecialchars($msg['sender_name']) ?> (<?= htmlspecialchars($msg['from_device']) ?>)</td>
                                    <td><?= nl2br(htmlspecialchars($msg['content'])) ?></td>
                                    <td><?= $msg['timestamp'] ?></td>
                                    <td><?= $msg['read'] ? '已读' : '🔴 未读' ?></td>
                                </tr>
                            <?php endforeach; ?>
                            </tbody>
                        </table>
                    <?php else: ?>
                        <p style="color:#94a3b8;">暂无留言</p>
                    <?php endif; ?>

                    <!-- 笔记 -->
                    <h4>📋 笔记</h4>
                    <?php if (isset($notesByDevice[$key]) && count($notesByDevice[$key]) > 0): ?>
                        <table>
                            <thead><tr><th>note_id</th><th>父ID</th><th>内容</th><th>创建时间</th><th>截止日期</th><th>状态</th></tr></thead>
                            <tbody>
                            <?php foreach ($notesByDevice[$key] as $note): ?>
                                <tr class="<?= $note['completed'] ? 'completed' : '' ?>">
                                    <td><?= $note['note_id'] ?></td>
                                    <td><?= $note['parent_id'] ?? '-' ?></td>
                                    <td><?= nl2br(htmlspecialchars($note['content'])) ?></td>
                                    <td><?= $note['created_at'] ?></td>
                                    <td><?= $note['due_date'] ?? '-' ?></td>
                                    <td><?= $note['completed'] ? '✅ 完成' : '⏳ 待办' ?></td>
                                </tr>
                            <?php endforeach; ?>
                            </tbody>
                        </table>
                    <?php else: ?>
                        <p style="color:#94a3b8;">暂无笔记</p>
                    <?php endif; ?>
                </div>
            <?php endforeach; ?>
        <?php endif; ?>
    </div>
</body>
</html>