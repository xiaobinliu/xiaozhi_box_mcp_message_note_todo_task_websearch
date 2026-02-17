<?php
// notes_viewer.php - 查看所有笔记的简单网页

header('Content-Type: text/html; charset=utf-8');

$notesDir = '/root/snv/notes';

if (!is_dir($notesDir)) {
    die("笔记目录不存在: $notesDir");
}

// 简单密码验证
$password = '790126';
if (!isset($_SERVER['PHP_AUTH_PW']) || $_SERVER['PHP_AUTH_PW'] !== $password) {
    header('WWW-Authenticate: Basic realm="笔记查看"');
    header('HTTP/1.0 401 Unauthorized');
    echo '需要密码';
    exit;
}

// 获取所有设备文件（排除 _meta.json）
$files = glob($notesDir . '/*.json');
$deviceNotes = [];

foreach ($files as $file) {
    $filename = basename($file);
    if ($filename === '_meta.json') continue;
    $deviceName = pathinfo($filename, PATHINFO_FILENAME);
    $content = file_get_contents($file);
    $data = json_decode($content, true);
    if ($data && isset($data['notes'])) {
        $deviceNotes[$deviceName] = $data['notes'];
    }
}

// 递归渲染笔记树
function renderNotes($notes, $level = 0) {
    $html = '';
    $indent = str_repeat('&nbsp;&nbsp;&nbsp;', $level);
    foreach ($notes as $note) {
        $status = $note['completed'] ? '✅' : '⏳';
        $due = isset($note['due_date']) && $note['due_date'] ? '截止: ' . date('Y-m-d', strtotime($note['due_date'])) : '';
        $created = date('Y-m-d H:i', strtotime($note['created_at']));
        $html .= "<div style='margin-left: {$level}em; padding: 5px; border-left: 1px solid #ccc;'>";
        $html .= "<span style='font-weight:bold;'>[$status] [ID:{$note['id']}]</span> ";
        $html .= htmlspecialchars($note['content']);
        $html .= " <span style='color:gray;font-size:0.9em;'>(创建: $created $due)</span>";
        if (!empty($note['subtasks'])) {
            $html .= renderNotes($note['subtasks'], $level + 1);
        }
        $html .= "</div>";
    }
    return $html;
}

// 统计未完成数量
function countPending($notes) {
    $count = 0;
    foreach ($notes as $note) {
        if (!$note['completed']) $count++;
        if (!empty($note['subtasks'])) {
            $count += countPending($note['subtasks']);
        }
    }
    return $count;
}

?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>笔记查看器</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        h1 { color: #333; }
        .device { background: white; border-radius: 8px; padding: 15px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .device h2 { margin-top: 0; color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 5px; }
        .stats { background: #e8f4f8; padding: 10px; border-radius: 4px; margin-bottom: 10px; }
        .note-tree { font-size: 14px; }
    </style>
</head>
<body>
    <h1>📋 家庭笔记总览 <a href="messages.php">家庭留言在这里</a></h1>
    <?php if (empty($deviceNotes)): ?>
        <p>还没有任何笔记。</p>
    <?php else: ?>
        <?php foreach ($deviceNotes as $device => $notes): ?>
            <div class="device">
                <h2>👤 <?php echo htmlspecialchars($device); ?></h2>
                <div class="stats">
                    总笔记数: <?php echo count($notes); ?> |
                    未完成: <?php echo countPending($notes); ?>
                </div>
                <div class="note-tree">
                    <?php echo renderNotes($notes); ?>
                </div>
            </div>
        <?php endforeach; ?>
    <?php endif; ?>
    <p style="color:gray; font-size:0.9em;">最后更新: <?php echo date('Y-m-d H:i:s'); ?></p>
</body>
</html>