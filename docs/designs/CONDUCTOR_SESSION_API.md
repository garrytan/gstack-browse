# Conductor 会话流式 API 提案

## 问题

当 Claude 通过 CDP 控制你的真实浏览器时（gstack `$B connect`），你需要同时盯着两个窗口：**Conductor**（看 Claude 的思考）和 **Chrome**（看 Claude 的操作）。

gstack 的 Chrome 扩展侧边面板会展示 browse 活动，包括每一条命令、结果和错误。但如果想做到*完整*的会话镜像，比如 Claude 的思考、工具调用、代码编辑，侧边面板就需要 Conductor 暴露整条对话流。

## 这会带来什么能力

在 gstack Chrome 扩展侧边面板里增加一个“Session”标签页，显示：

- Claude 的思考 / 内容（为了性能会做截断）
- 工具调用名称和图标（Edit、Bash、Read 等）
- 轮次边界与成本估算
- 对话进行过程中的实时更新

用户就能在一个地方看到所有信息：一边是 Claude 在浏览器中的操作，一边是 Claude 在侧边面板里的思考过程，不需要来回切换窗口。

## 提议的 API

### `GET http://127.0.0.1:{PORT}/workspace/{ID}/session/stream`

一个 Server-Sent Events 端点，将 Claude Code 的对话流重新以 NDJSON 事件形式发出来。

**事件类型**（复用 Claude Code 的 `--output-format stream-json` 格式）：

```
event: assistant
data: {"type":"assistant","content":"让我检查一下那个页面……","truncated":true}

event: tool_use
data: {"type":"tool_use","name":"Bash","input":"$B snapshot","truncated_input":true}

event: tool_result
data: {"type":"tool_result","name":"Bash","output":"[snapshot output...]","truncated_output":true}

event: turn_complete
data: {"type":"turn_complete","input_tokens":1234,"output_tokens":567,"cost_usd":0.02}
```

**内容截断：** 流里的工具输入 / 输出限制为 500 个字符。完整数据仍然保留在 Conductor 的 UI 中。侧边面板是摘要视图，不是替代品。

### `GET http://127.0.0.1:{PORT}/api/workspaces`

一个用于发现当前活动工作区的端点。

```json
{
  "workspaces": [
    {
      "id": "abc123",
      "name": "gstack",
      "branch": "garrytan/chrome-extension-ctrl",
      "directory": "/Users/garry/gstack",
      "pid": 12345,
      "active": true
    }
  ]
}
```

Chrome 扩展会通过匹配 browse server 的 git 仓库信息（来自 `/health` 响应）与工作区的目录或名称，自动选择对应的工作区。

## 安全性

- **仅限 localhost。** 信任模型与 Claude Code 自己的调试输出一致。
- **无需鉴权。** 如果 Conductor 想加鉴权，可以在 workspace 列表里返回一个 Bearer token，由扩展在 SSE 请求时带上。
- **内容截断** 同时也是一种隐私保护机制。长代码输出、文件内容和敏感工具结果不会离开 Conductor 的完整 UI。

## gstack 侧需要做什么（扩展侧）

侧边面板里的 “Session” 标签页已经完成脚手架（当前显示的是占位内容）。

当 Conductor 的 API 可用后：

1. 侧边面板通过端口探测或手动输入找到 Conductor
2. 获取 `/api/workspaces`，并与 browse server 的仓库做匹配
3. 对 `/workspace/{id}/session/stream` 打开 `EventSource`
4. 渲染 assistant 消息、工具名与图标、轮次边界、成本
5. 平滑回退为：“连接 Conductor 以查看完整会话”

预计工作量：`sidepanel.js` 中大约 200 行代码。

## Conductor 侧需要做什么（服务端）

1. 一个 SSE 端点，按工作区重新发出 Claude Code 的 stream-json
2. 一个 `/api/workspaces` 发现端点，列出当前活动工作区
3. 内容截断（工具输入 / 输出上限 500 字符）

如果 Conductor 内部本来就已经捕获了 Claude Code 的流（它自己的 UI 渲染本来就需要），那么预计工作量约为 100-200 行代码。

## 设计决策

| 决策 | 选择 | 原因 |
|----------|--------|-----------|
| 传输方式 | SSE（而不是 WebSocket） | 单向、自动重连、更简单 |
| 格式 | Claude 的 stream-json | Conductor 已经在解析，无需新 schema |
| 发现方式 | HTTP 端点（而不是文件） | Chrome 扩展不能读取文件系统 |
| 鉴权 | 无（localhost） | 与 browse server、CDP 端口、Claude Code 一致 |
| 截断长度 | 500 字符 | 侧边面板只有约 300px 宽，长内容没有意义 |
