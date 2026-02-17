<?php
// api.php - 多用户 MCP 设备管理 API
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

session_start();

// 数据库路径（根据实际修改）
$dbPath = '/root/mcp2/lxbchat.db';

$action = $_GET['action'] ?? '';

try {
    $db = new PDO("sqlite:$dbPath");
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // ---------- 注册 ----------
    if ($_POST['action'] === 'register' || $action === 'register') {
        $username = $_POST['username'] ?? '';
        $password = $_POST['password'] ?? '';
        if (!$username || !$password) {
            http_response_code(400);
            echo json_encode(['error' => '用户名和密码不能为空']);
            exit;
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $db->prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)");
        try {
            $stmt->execute([$username, $hash]);
            echo json_encode(['success' => true, 'message' => '注册成功']);
        } catch (PDOException $e) {
            http_response_code(409);
            echo json_encode(['error' => '用户名已存在']);
        }
        exit;
    }

    // ---------- 登录 ----------
    if ($_POST['action'] === 'login' || $action === 'login') {
        $username = $_POST['username'] ?? '';
        $password = $_POST['password'] ?? '';
        if (!$username || !$password) {
            http_response_code(400);
            echo json_encode(['error' => '用户名和密码不能为空']);
            exit;
        }

        $stmt = $db->prepare("SELECT * FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user && password_verify($password, $user['password_hash'])) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['username'];
            echo json_encode(['success' => true, 'user' => ['id' => $user['id'], 'username' => $user['username']]]);
        } else {
            http_response_code(401);
            echo json_encode(['error' => '用户名或密码错误']);
        }
        exit;
    }

    // ---------- 需要登录的接口 ----------
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['error' => '未登录']);
        exit;
    }
    $userId = $_SESSION['user_id'];

    // ---------- 获取设备列表 ----------
    if ($_GET['action'] === 'devices' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $db->prepare("SELECT id, device_name, mcp_endpoint, created_at FROM devices WHERE user_id = ? ORDER BY created_at DESC");
        $stmt->execute([$userId]);
        $devices = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($devices);
        exit;
    }

    // ---------- 添加设备 ----------
    if ($_POST['action'] === 'add_device') {
        $deviceName = $_POST['device_name'] ?? '';
        $mcpEndpoint = $_POST['mcp_endpoint'] ?? '';
        if (!$deviceName || !$mcpEndpoint) {
            http_response_code(400);
            echo json_encode(['error' => '设备名称和端点不能为空']);
            exit;
        }

        $stmt = $db->prepare("INSERT INTO devices (user_id, device_name, mcp_endpoint) VALUES (?, ?, ?)");
        $stmt->execute([$userId, $deviceName, $mcpEndpoint]);
        echo json_encode(['success' => true, 'id' => $db->lastInsertId()]);
        exit;
    }

    // ---------- 删除设备 ----------
    if ($_GET['action'] === 'delete_device' && $_SERVER['REQUEST_METHOD'] === 'DELETE') {
        parse_str(file_get_contents("php://input"), $_DELETE);
        $deviceId = $_DELETE['id'] ?? $_GET['id'] ?? 0;
        if (!$deviceId) {
            http_response_code(400);
            echo json_encode(['error' => '缺少设备ID']);
            exit;
        }

        $stmt = $db->prepare("DELETE FROM devices WHERE id = ? AND user_id = ?");
        $stmt->execute([$deviceId, $userId]);
        echo json_encode(['success' => true]);
        exit;
    }

    http_response_code(404);
    echo json_encode(['error' => '接口不存在']);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => '数据库错误: ' . $e->getMessage()]);
}