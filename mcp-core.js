// mcp-core.js
const WebSocket = require('ws');

class MCPServerConnection {
  constructor(deviceId, deviceName, url, toolHandlers, connections, userId) {
    this.deviceId = deviceId;
    this.deviceName = deviceName;
    this.userId = userId;
    this.url = url;
    this.toolHandlers = toolHandlers;
    this.connections = connections;
    this.ws = null;
    this.initialized = false;
    this.heartbeatInterval = null;
  }

  connect() {
    console.log(`🔌 正在连接 ${this.deviceName}...`);
    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => this.onOpen());
    this.ws.on('message', (data) => this.onMessage(data));
    this.ws.on('close', (code, reason) => this.onClose(code, reason));
    this.ws.on('error', (err) => this.onError(err));

    return this;
  }

  onOpen() {
    console.log(`✅ ${this.deviceName} WebSocket连接成功`);
    this.startHeartbeat();
  }

  onMessage(data) {
    try {
      const msg = JSON.parse(data.toString());
      console.log(`📩 ${this.deviceName} 收到:`, msg.method || `ID:${msg.id}`);

      if (msg.method === 'ping') {
        this.sendResponse(msg.id, {});
        return;
      }

      if (msg.method === 'initialize') {
        this.handleInitialize(msg);
        return;
      }

      if (msg.method === 'tools/list') {
        this.handleToolsList(msg);
        return;
      }

      if (msg.method === 'tools/call') {
        this.handleToolCall(msg);
        return;
      }

      console.log(`⚠️ ${this.deviceName} 未处理的消息类型:`, msg.method);
    } catch (err) {
      console.error(`❌ ${this.deviceName} 消息处理错误:`, err.message);
    }
  }

  handleInitialize(msg) {
    const clientVersion = msg.params?.protocolVersion || '0.1.0';
    const response = {
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        protocolVersion: clientVersion,
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: 'lxbchat', version: '1.0.0' }
      }
    };
    this.ws.send(JSON.stringify(response));
    console.log(`📨 ${this.deviceName} 回复 initialize (版本: ${clientVersion})`);
    this.initialized = true;
  }

  handleToolsList(msg) {
    const tools = Object.entries(this.toolHandlers).map(([name, handler]) => ({
      name: name,
      description: handler.description || '',
      inputSchema: handler.inputSchema || {
        type: 'object',
        properties: {
          expression: { type: 'string', description: '输入表达式' }
        },
        required: ['expression']
      }
    }));

    this.sendResponse(msg.id, { tools });
    console.log(`📨 ${this.deviceName} 返回工具列表:`, tools.map(t => t.name));
  }

  async handleToolCall(msg) {
    const { name, arguments: args } = msg.params;
    const reqId = msg.id;

    console.log(`🔧 设备 ${this.deviceId} (${this.deviceName}) 调用工具:`, name, args);

    const handler = this.toolHandlers[name];
    if (!handler) {
      this.sendError(reqId, -32601, `未知工具: ${name}`);
      return;
    }

    try {
      // 传递上下文：设备ID、设备名、用户ID、所有连接
      const result = await handler.execute(args, {
        deviceId: this.deviceId,
        deviceName: this.deviceName,
        userId: this.userId,
        connections: this.connections
      });
      console.log(`✅ 工具 ${name} 执行成功`);

      const response = {
        jsonrpc: '2.0',
        id: reqId,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result) }]
        }
      };
      this.sendResponseWithCheck(response);
    } catch (err) {
      console.error(`❌ 工具执行错误:`, err);
      this.sendError(reqId, -32000, err.message || '工具执行失败');
    }
  }

  sendResponseWithCheck(response) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error(`❌ ${this.deviceName} WebSocket 未连接，无法发送响应`);
      return false;
    }
    try {
      const payload = JSON.stringify(response);
      this.ws.send(payload);
      console.log(`📨 ${this.deviceName} 已发送响应 ID ${response.id}`);
      return true;
    } catch (err) {
      console.error(`❌ ${this.deviceName} 发送响应异常:`, err.message);
      return false;
    }
  }

  sendResponse(id, result) {
    const response = { jsonrpc: '2.0', id, result };
    return this.sendResponseWithCheck(response);
  }

  sendError(id, code, message) {
    this.ws.send(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }));
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 25000);
  }

  stopHeartbeat() {
    clearInterval(this.heartbeatInterval);
  }

  onClose(code, reason) {
    console.log(`❌ ${this.deviceName} 连接关闭: ${code} ${reason}`);
    this.stopHeartbeat();
  }

  onError(err) {
    console.error(`❌ ${this.deviceName} 错误:`, err.message);
  }

  close() {
    this.stopHeartbeat();
    this.ws.close();
  }
}

module.exports = MCPServerConnection;