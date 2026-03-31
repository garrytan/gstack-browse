# Chrome 与 Chromium：为什么我们使用 Playwright 自带的 Chromium

## 最初的设想

当我们构建 `$B connect` 时，原本的计划是连接到用户的 **真实 Chrome 浏览器**，也就是那个已经带有用户 cookie、登录会话、扩展和现有标签页的浏览器。这样就不再需要导入 cookie。最初设计是这样的：

1. 通过 `chromium.connectOverCDP(wsUrl)` 连接到一个运行中的 Chrome 实例
2. 优雅地退出 Chrome，然后用 `--remote-debugging-port=9222` 重新启动
3. 访问用户真实的浏览上下文

这也是为什么当时会有 `chrome-launcher.ts`，里面写了 361 行代码来做浏览器二进制发现、CDP 端口探测和运行时检测；也是为什么那个方法叫 `connectCDP()`。

## 实际发生了什么

当通过 Playwright 的 `channel: 'chrome'` 启动真实 Chrome 时，Chrome 会静默屏蔽 `--load-extension`。结果就是扩展无法加载。而我们需要这个扩展来提供侧边面板能力，比如活动流、refs、聊天等。

于是实现退回到了 `chromium.launchPersistentContext()`，改用 Playwright 自带的 Chromium。这个方式可以稳定地通过 `--load-extension` 和 `--disable-extensions-except` 加载扩展。但命名没有跟着改：`connectCDP()`、`connectionMode: 'cdp'`、`BROWSE_CDP_URL`、`chrome-launcher.ts` 这些名字都保留了下来。

最初那个“访问用户真实浏览器状态”的设想其实从未真正实现。我们每次启动的都是一个新的浏览器实例，功能上和 Playwright 的 Chromium 没区别，只是留下了 361 行死代码和一堆误导性的命名。

## 发现问题的过程（2026-03-22）

在一次 `/office-hours` 设计会话中，我们顺着架构往下追，发现了这些事实：

1. `connectCDP()` 根本没有使用 CDP，它调用的是 `launchPersistentContext()`
2. `connectionMode: 'cdp'` 这个名字是误导，它本质上只是“有头模式”
3. `chrome-launcher.ts` 是死代码，它唯一的导入点在一个永远不可达的 `attemptReconnect()` 方法里
4. `preExistingTabIds` 原本是为了保护“我们从未真正连接过的真实 Chrome 标签页”而设计的
5. `$B handoff`（从 headless 切到 headed）使用的是另一套 API（`launch()` + `newContext()`），它无法加载扩展，于是形成了两种不同的“有头模式”体验

## 修复方案

### 重命名

- `connectCDP()` → `launchHeaded()`
- `connectionMode: 'cdp'` → `connectionMode: 'headed'`
- `BROWSE_CDP_URL` → `BROWSE_HEADED`

### 删除

- `chrome-launcher.ts`（361 行）
- `attemptReconnect()`（死方法）
- `preExistingTabIds`（死概念）
- `reconnecting` 字段（死状态）
- `cdp-connect.test.ts`（测试的对象已删除）

### 收敛

- `$B handoff` 现在也改为使用 `launchPersistentContext()` + 扩展加载（与 `$B connect` 保持一致）
- 现在只有一种 headed 模式，而不是两种
- handoff 会免费带上扩展和侧边面板

### 加开关

- 侧边栏聊天能力放在 `--chat` 标志后面
- `$B connect`（默认）：仅活动流 + refs
- `$B connect --chat`：再加上实验性的独立聊天 agent

## 修复后的架构

```
浏览器状态：
  HEADLESS（默认） ←→ HEADED（$B connect 或 $B handoff）
     Playwright            Playwright（同一引擎）
     launch()              launchPersistentContext()
     不可见                可见 + 扩展 + 侧边面板

侧边栏（正交附加层，仅限 headed）：
  Activity 标签  — 始终开启，展示实时 browse 命令
  Refs 标签      — 始终开启，展示 @ref 叠层
  Chat 标签      — 通过 --chat 显式开启，实验性独立 agent

数据桥（sidebar → workspace）：
  侧边栏写入 .context/sidebar-inbox/*.json
  工作区通过 $B inbox 读取
```

## 为什么不用真实 Chrome？

真实 Chrome 在被 Playwright 启动时会阻止 `--load-extension`。这是 Chrome 的一个安全特性，用来防止通过命令行参数恶意注入扩展，因此基于 Chromium 的浏览器也会受到这类限制。

Playwright 自带的 Chromium 没有这个限制，因为它本来就是为了测试和自动化设计的。`ignoreDefaultArgs` 选项还能让我们绕过 Playwright 自己默认加上的扩展屏蔽参数。

如果未来我们真的想访问用户真实的 cookie / 会话，路径应该是：

1. 导入 cookie（`$B cookie-import` 已经可用）
2. Conductor 会话注入（未来能力，让侧边栏把消息发给工作区 agent）

而不是重新连接真实 Chrome。
