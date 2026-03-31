# QA 报告：{APP_NAME}

| 字段 | 值 |
|-------|-------|
| **日期** | {DATE} |
| **URL** | {URL} |
| **分支** | {BRANCH} |
| **提交** | {COMMIT_SHA} ({COMMIT_DATE}) |
| **PR** | {PR_NUMBER} ({PR_URL}) 或 “—” |
| **层级** | Quick / Standard / Exhaustive |
| **范围** | {SCOPE or "完整应用"} |
| **耗时** | {DURATION} |
| **访问页面数** | {COUNT} |
| **截图数** | {COUNT} |
| **框架** | {DETECTED or "未知"} |
| **索引** | [所有 QA 运行记录](./index.md) |

## 健康分：{SCORE}/100

| 类别 | 分数 |
|----------|-------|
| 控制台 | {0-100} |
| 链接 | {0-100} |
| 视觉 | {0-100} |
| 功能 | {0-100} |
| UX | {0-100} |
| 性能 | {0-100} |
| 可访问性 | {0-100} |

## 优先修复的 3 个问题

1. **{ISSUE-NNN}: {title}** — {一行描述}
2. **{ISSUE-NNN}: {title}** — {一行描述}
3. **{ISSUE-NNN}: {title}** — {一行描述}

## 控制台健康情况

| 错误 | 数量 | 首次出现位置 |
|-------|-------|------------|
| {error message} | {N} | {URL} |

## 汇总

| 严重级别 | 数量 |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| **总计** | **0** |

## 问题列表

### ISSUE-001: {简短标题}

| 字段 | 值 |
|-------|-------|
| **严重级别** | critical / high / medium / low |
| **类别** | visual / functional / ux / content / performance / console / accessibility |
| **URL** | {page URL} |

**描述：** {问题是什么，预期与实际的差异。}

**复现步骤：**

1. 打开 {URL}
   ![步骤 1](screenshots/issue-001-step-1.png)
2. {Action}
   ![步骤 2](screenshots/issue-001-step-2.png)
3. **观察：** {出现了什么错误}
   ![结果](screenshots/issue-001-result.png)

---

## 已应用修复（如适用）

| 问题 | 修复状态 | 提交 | 改动文件 |
|-------|-----------|--------|---------------|
| ISSUE-NNN | verified / best-effort / reverted / deferred | {SHA} | {files} |

### 修复前后证据

#### ISSUE-NNN: {title}
**修复前：** ![Before](screenshots/issue-NNN-before.png)
**修复后：** ![After](screenshots/issue-NNN-after.png)

---

## 回归测试

| 问题 | 测试文件 | 状态 | 描述 |
|-------|-----------|--------|-------------|
| ISSUE-NNN | path/to/test | committed / deferred / skipped | description |

### 延后测试

#### ISSUE-NNN: {title}
**前置条件：** {触发该缺陷所需的环境状态}
**操作：** {用户做了什么}
**预期：** {正确行为}
**为何延后：** {原因}

---

## 可发布性评估

| 指标 | 值 |
|--------|-------|
| 健康分 | {before} → {after} ({delta}) |
| 发现问题数 | N |
| 已修复数 | N（verified: X, best-effort: Y, reverted: Z） |
| 延后数 | N |

**PR 摘要：** “QA 发现 N 个问题，修复了 M 个，健康分从 X 提升到 Y。”

---

## 回归（如适用）

| 指标 | 基线 | 当前 | 变化 |
|--------|----------|---------|-------|
| 健康分 | {N} | {N} | {+/-N} |
| 问题数 | {N} | {N} | {+/-N} |

**相对基线已修复：** {list}
**相对基线新增：** {list}
