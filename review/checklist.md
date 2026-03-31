# 着陆前审查清单

## 使用说明

审查 `git diff origin/main` 的输出，检查下列问题。要具体，引用 `file:line` 并给出修复建议。没问题的内容直接跳过。只标记真实问题。

**双阶段审查：**

- **Pass 1（CRITICAL）：** 优先检查 SQL 与数据安全、竞态条件、LLM 输出信任边界、Shell 注入、枚举完整性。它们的严重程度最高。
- **Pass 2（INFORMATIONAL）：** 再检查下面其他类别。严重度更低，但仍然需要处理。
- **Specialist 类别（由并行 subagent 处理，不在本清单中）：** Test Gaps、Dead Code、Magic Numbers、Conditional Side Effects、Performance & Bundle Impact、Crypto & Entropy。见 `review/specialists/`。

所有发现都会进入 Fix-First Review：明显的机械性修复自动应用，真正存在歧义的问题会合并成一次面向用户的提问。

**输出格式：**

```
Pre-Landing Review: N issues (X critical, Y informational)

**AUTO-FIXED:**
- [file:line] 问题 → 已应用修复

**NEEDS INPUT:**
- [file:line] 问题描述
  Recommended fix: 建议修复方式
```

如果没有发现问题：`Pre-Landing Review: No issues found.`

保持简洁。每个问题只写一行问题描述，再写一行修复方式。不要写前言、总结，也不要写 “looks good overall” 之类的话。

---

## 审查类别

### Pass 1 — CRITICAL

#### SQL 与数据安全

- SQL 中使用字符串插值（即使值已经做了 `.to_i` / `.to_f`，也要改用参数化查询；Rails 用 `sanitize_sql_array` / Arel，Node 用 prepared statements，Python 用参数化查询）
- TOCTOU 竞态：先检查再设置的模式，实际上应该改为原子性的 `WHERE` + `update_all`
- 绕过 model validation 直接写数据库（Rails: `update_column`；Django: `QuerySet.update()`；Prisma: raw queries）
- N+1 查询：在循环 / 视图中使用关联，却没有做预加载（Rails: `.includes()`；SQLAlchemy: `joinedload()`；Prisma: `include`）

#### 竞态条件与并发

- 读-检查-写流程，没有唯一约束，也没有捕获 duplicate key 错误并重试（例如 `where(hash:).first` 后直接 `save!`，却不处理并发插入）
- find-or-create 没有唯一 DB 索引，并发调用可能创建重复数据
- 状态迁移没有使用原子性的 `WHERE old_status = ? UPDATE SET new_status`，并发更新可能导致跳过状态或重复应用状态迁移
- 对用户可控数据做不安全 HTML 渲染（Rails: `.html_safe/raw()`；React: `dangerouslySetInnerHTML`；Vue: `v-html`；Django: `|safe/mark_safe`），存在 XSS 风险

#### LLM 输出信任边界

- 将 LLM 生成的值（邮箱、URL、名称等）写入数据库，或传给 mailer，却没有格式校验。持久化前至少加轻量防护，如 `EMAIL_REGEXP`、`URI.parse`、`.strip`
- 接收结构化工具输出（数组、哈希）后，没有做 type / shape 校验就直接写库
- 对 LLM 生成的 URL 直接发请求，且没有 allowlist，存在 SSRF 风险（Python 可用 `urllib.parse.urlparse` 检查 hostname，再决定是否允许 `requests.get` / `httpx.get`）
- 把 LLM 输出存入知识库或向量库前没有清洗，存在存储型 prompt injection 风险

#### Shell 注入（Python 专项）

- `subprocess.run()` / `subprocess.call()` / `subprocess.Popen()` 配合 `shell=True`，同时命令字符串里用了 f-string / `.format()` 插值。应改为参数数组
- `os.system()` 中做变量插值，应改为使用参数数组的 `subprocess.run()`
- 对 LLM 生成的代码直接 `eval()` / `exec()`，且没有 sandbox

#### 枚举与取值完整性

当 diff 引入了新的 enum 值、status 字符串、tier 名称或 type 常量时：

- **沿着每一个 consumer 追踪它。** 逐个读取（不是只 grep，要真正读）每个对该值做 switch、filter 或显示的文件。如果任何 consumer 没有处理这个新值，就要报出。最常见的问题是：前端下拉框里加了一个值，但后端 model / compute 方法没有持久化这个值。
- **检查 allowlist / filter 数组。** 搜索包含同类值的数组或 `%w[]` 列表（例如如果新增 `revise` 这个 tier，就把所有 `%w[quick lfg mega]` 找出来，看该包含的位置是不是也加入了 `revise`）。
- **检查 `case` / `if-elsif` 链。** 如果现有逻辑按 enum 分支，这个新值会不会落到错误的默认分支里？

做这件事时，要用 Grep 去找所有同类值的引用（例如 grep `"lfg"` 或 `"mega"` 找到所有 tier consumer），然后逐一读取。这个步骤要求读 **diff 之外的代码**。

### Pass 2 — INFORMATIONAL

#### Async / Sync 混用（Python 专项）

- 在 `async def` endpoint 中调用同步 `subprocess.run()`、`open()`、`requests.get()`，会阻塞 event loop。应改用 `asyncio.to_thread()`、`aiofiles` 或 `httpx.AsyncClient`
- 在 async 函数中使用 `time.sleep()`，应改成 `asyncio.sleep()`
- 在 async 上下文中直接做同步 DB 调用，且没有 `run_in_executor()` 包裹

#### 列名 / 字段名安全

- 核对 ORM 查询中的列名（`.select()`、`.eq()`、`.gte()`、`.order()`）是否与真实数据库 schema 一致。错误列名可能悄悄返回空结果，或抛出被吞掉的异常
- 检查查询结果上的 `.get()` 是否使用了真正被选中的列名
- 有 schema 文档时，交叉核对

#### 死代码与一致性（仅限 version / changelog，其他项由 maintainability specialist 处理）

- PR 标题与 VERSION / CHANGELOG 文件中的版本不一致
- CHANGELOG 条目描述不准确（例如写成“从 X 改为 Y”，但 X 实际上从未存在）

#### LLM Prompt 问题

- prompt 中使用从 0 开始编号的列表（LLM 更稳定返回从 1 开始的列表）
- prompt 文本里列出的工具 / 能力，与实际接上的 `tool_classes` / `tools` 数组不一致
- 多处声明了词数 / token 限制，存在漂移风险

#### 完整性缺口

- 采用了 shortcut 实现，而完整实现花费不到 30 分钟 Claude Code 时间（例如只处理了部分 enum、错误路径不完整、缺少容易补齐的边界情况）
- 提供选项时只给出人工团队工时估算，没有同时给出人工和 CC+gstack 时间
- 测试覆盖缺口其实只是“湖”而不是“海”（例如缺少负路径测试、缺少可直接镜像 happy path 结构的边界测试）
- 功能只实现到 80-90%，而再加少量代码即可做到 100%

#### 时间窗口安全

- 以日期 key 做查找时，默认“今天”覆盖完整 24 小时。比如太平洋时间早上 8 点出报表，只能看到当天 0 点到 8 点的数据
- 相关功能之间时间窗口不一致，一个用 hourly buckets，另一个对同一份数据用 daily keys

#### 边界处的类型强制转换

- 值在 Ruby → JSON → JS 边界之间流转时，类型可能发生变化（数字 vs 字符串）；哈希 / 摘要输入必须规范化类型
- 哈希 / 摘要输入没有在序列化前调用 `.to_s` 或等价处理，导致 `{ cores: 8 }` 和 `{ cores: "8" }` 产生不同哈希

#### 视图 / 前端

- partial 里内联 `<style>` 块（每次渲染都要重新解析）
- 视图中出现 O(n*m) 查找（例如在循环里用 `Array#find`，本来应该提前用 `index_by` 转哈希）
- Ruby 侧用 `.select{}` 过滤 DB 结果，而本可以写成 `WHERE` 子句（除非是刻意规避前置通配 `LIKE`）

#### 分发与 CI/CD 流水线

- CI/CD 工作流改动（`.github/workflows/`）：校验构建工具版本是否符合项目要求，artifact 名称 / 路径是否正确，secrets 是否使用 `${{ secrets.X }}` 而不是硬编码
- 新增 artifact 类型（CLI 二进制、库、包）：确认存在发布 / release 工作流，并且目标平台正确
- 跨平台构建：确认 CI matrix 覆盖所有目标 OS / 架构组合，或者清楚注明哪些未测试
- 版本标签格式一致性：`v1.2.3` vs `1.2.3`，必须在 VERSION 文件、git tag 和发布脚本之间保持一致
- 发布步骤应具备幂等性：重复运行发布工作流也不该失败（例如 `gh release delete` 后再 `gh release create`）

**不要报以下情况：**

- 已有自动部署流水线的 Web 服务（Docker build + K8s deploy）
- 团队内部使用、不会对外分发的内部工具
- 仅测试用途的 CI 改动（增加测试步骤，而不是发布步骤）

---

## 严重级别分类

```
CRITICAL（最高严重度）：          INFORMATIONAL（主 agent 负责）：   SPECIALIST（并行 subagent）：
├─ SQL & Data Safety              ├─ Async/Sync Mixing             ├─ Testing specialist
├─ Race Conditions & Concurrency  ├─ Column/Field Name Safety      ├─ Maintainability specialist
├─ LLM Output Trust Boundary      ├─ Dead Code（仅版本相关）       ├─ Security specialist
├─ Shell Injection                ├─ LLM Prompt Issues             ├─ Performance specialist
└─ Enum & Value Completeness      ├─ Completeness Gaps             ├─ Data Migration specialist
                                   ├─ Time Window Safety            ├─ API Contract specialist
                                   ├─ Type Coercion at Boundaries   └─ Red Team（条件触发）
                                   ├─ View/Frontend
                                   └─ Distribution & CI/CD Pipeline

所有发现都走 Fix-First Review。严重度决定展示顺序，
也决定 AUTO-FIX 与 ASK 的分类方式：critical
发现更倾向 ASK（风险更高），informational 发现
更倾向 AUTO-FIX（更机械）。
```

---

## Fix-First 启发式

这个启发式规则同时被 `/review` 和 `/ship` 引用，用来决定 agent 是自动修复发现，还是向用户提问。

```
AUTO-FIX（无需询问，agent 直接修）：   ASK（需要人工判断）：
├─ 死代码 / 未使用变量                  ├─ 安全问题（鉴权、XSS、注入）
├─ N+1 查询（缺少 eager loading）       ├─ 竞态条件
├─ 过时且与代码矛盾的注释               ├─ 设计决策
├─ Magic numbers → 命名常量             ├─ 大修复（>20 行）
├─ 缺少 LLM 输出校验                    ├─ 枚举完整性
├─ 版本 / 路径不一致                    ├─ 删除功能
├─ 变量赋值后从未读取                   └─ 任何改变用户可见
└─ 内联样式、O(n*m) 视图查找               行为的修改
```

**经验法则：** 如果修复是机械性的，一个资深工程师无需讨论就会直接改，那就是 `AUTO-FIX`。如果合理的工程师之间可能对修法有分歧，那就是 `ASK`。

**Critical 发现默认偏向 ASK**（它们天然风险更高）。  
**Informational 发现默认偏向 AUTO-FIX**（它们更偏机械性）。

---

## 抑制规则 —— 以下不要报

- “X 与 Y 冗余” 但这种冗余本身无害且能提升可读性（例如 `present?` 和 `length > 20` 冗余）
- “给这个阈值 / 常量补一个解释性注释”，因为调参时这些注释很快会腐烂
- “这个断言可以更严格”，但实际上现有断言已经覆盖了行为
- 只为了“风格一致”而建议修改（例如为了和另一个常量的保护方式一致，就把某个值也包进条件里）
- “这个正则没处理边界情况 X”，但输入本身已受约束，X 在实际里不会出现
- “测试同时覆盖了多个 guard” —— 没问题，测试不必把每个 guard 都拆开孤立
- Eval threshold 的调整（`max_actionable`、最小分数等），这些是经验调参项，会频繁变化
- 无害的 no-op（例如对一个永远不在数组里的元素做 `.reject`）
- 你正在审查的 diff 里已经处理过的任何问题 —— 评论前务必阅读 **完整 diff**
