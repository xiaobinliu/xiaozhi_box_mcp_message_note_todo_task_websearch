<?php
// messages_viewer.php - 查看所有留言的简单网页（带密码保护）

// ========== 配置密码（与笔记查看器保持一致） ==========
$valid_username = '';
$valid_password = ''; // 请修改为你自己的密码
// ====================================================

// HTTP 基本认证
if (!isset($_SERVER['PHP_AUTH_USER']) || !isset($_SERVER['PHP_AUTH_PW']) ||
    $_SERVER['PHP_AUTH_USER'] != $valid_username || $_SERVER['PHP_AUTH_PW'] != $valid_password) {
    header('WWW-Authenticate: Basic realm="留言查看器"');
    header('HTTP/1.0 401 Unauthorized');
    echo '需要认证才能访问此页面';
    exit;
}

header('Content-Type: text/html; charset=utf-8');

// 配置留言目录（请根据实际路径修改）
$messagesDir = '/root/snv/messages';  // 如果路径不同，请修改

if (!is_dir($messagesDir)) {
    die("留言目录不存在: $messagesDir");
}

// 获取所有以 messages_ 开头的 .json 文件
$files = glob($messagesDir . '/messages_*.json');
$allMessages = [];

foreach ($files as $file) {
    $filename = basename($file);
    // 提取设备名称：从 messages_爸爸.json 中提取 "爸爸"
    if (preg_match('/^messages_(.+)\.json$/', $filename, $matches)) {
        $deviceName = $matches[1];
        $content = file_get_contents($file);
        $messages = json_decode($content, true);
        if (is_array($messages)) {
            // 按时间倒序排列（最新的在前）
            usort($messages, function($a, $b) {
                return strtotime($b['timestamp']) - strtotime($a['timestamp']);
            });
            $allMessages[$deviceName] = $messages;
        }
    }
}

// 统计未读数量
function countUnread($messages) {
    $count = 0;
    foreach ($messages as $msg) {
        if (isset($msg['read']) && !$msg['read']) $count++;
    }
    return $count;
}

?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>留言查看器</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        h1 { color: #333; }
        .device { background: white; border-radius: 8px; padding: 15px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .device h2 { margin-top: 0; color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 5px; }
        .stats { background: #e8f4f8; padding: 10px; border-radius: 4px; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
        .unread { background-color: #fff3cd; font-weight: bold; }
        .read { color: #888; }
        .timestamp { font-size: 0.9em; color: #666; }
    </style>
</head>
<body>
    <h1>📨 家庭留言总览</h1>
    <?php if (empty($allMessages)): ?>
        <p>还没有任何留言。</p>
    <?php else: ?>
        <?php foreach ($allMessages as $device => $messages): ?>
            <div class="device">
                <h2>👤 <?php echo htmlspecialchars($device); ?></h2>
                <div class="stats">
                    总留言数: <?php echo count($messages); ?> |
                    未读: <?php echo countUnread($messages); ?>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>状态</th>
                            <th>来自</th>
                            <th>内容</th>
                            <th>时间</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($messages as $msg): ?>
                            <?php
                            $rowClass = isset($msg['read']) && !$msg['read'] ? 'unread' : 'read';
                            $status = isset($msg['read']) && !$msg['read'] ? '🔴 未读' : '✅ 已读';
                            $from = htmlspecialchars($msg['from'] ?? '未知');
                            $content = htmlspecialchars($msg['content'] ?? '');
                            $timestamp = isset($msg['timestamp']) ? date('Y-m-d H:i:s', strtotime($msg['timestamp'])) : '';
                            ?>
                            <tr class="<?php echo $rowClass; ?>">
                                <td><?php echo $status; ?></td>
                                <td><?php echo $from; ?></td>
                                <td><?php echo nl2br($content); ?></td>
                                <td class="timestamp"><?php echo $timestamp; ?></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        <?php endforeach; ?>
    <?php endif; ?>
    <p style="color:gray; font-size:0.9em;">最后更新: <?php echo date('Y-m-d H:i:s'); ?></p>
</body>
</html>