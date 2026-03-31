---
name: gstack-upgrade
version: 1.1.0
description: |
  将 gstack 升级到最新版本。自动识别是全局安装还是 vendored 安装，
  执行升级，并展示新版本内容。适用于用户要求“升级 gstack”、
  “更新 gstack”或“获取最新版”时。
allowed-tools:
  - Bash
  - Read
  - Write
  - AskUserQuestion
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

# /gstack-upgrade

把 gstack 升级到最新版本，并展示新增内容。

## 内联升级流程

当 skill preamble 检测到 `UPGRADE_AVAILABLE` 时，会引用这一节。

### 第 1 步：询问用户（或自动升级）

先检查是否启用了自动升级：

```bash
_AUTO=""
[ "${GSTACK_AUTO_UPGRADE:-}" = "1" ] && _AUTO="true"
[ -z "$_AUTO" ] && _AUTO=$(~/.claude/skills/gstack/bin/gstack-config get auto_upgrade 2>/dev/null || true)
echo "AUTO_UPGRADE=$_AUTO"
```

**如果 `AUTO_UPGRADE=true` 或 `AUTO_UPGRADE=1`：** 跳过 AskUserQuestion。记录 "Auto-upgrading gstack v{old} → v{new}..."，然后直接进入第 2 步。如果自动升级过程中 `./setup` 失败，则从备份（`.bak` 目录）恢复，并告知用户："Auto-upgrade failed — restored previous version. Run `/gstack-upgrade` manually to retry."

**否则**，使用 AskUserQuestion：

- 问题："gstack **v{new}** is available (you're on v{old}). Upgrade now?"
- 选项：["Yes, upgrade now", "Always keep me up to date", "Not now", "Never ask again"]

**如果选择 "Yes, upgrade now"：** 进入第 2 步。

**如果选择 "Always keep me up to date"：**

```bash
~/.claude/skills/gstack/bin/gstack-config set auto_upgrade true
```

告诉用户："Auto-upgrade enabled. Future updates will install automatically." 然后进入第 2 步。

**如果选择 "Not now"：** 写入 snooze 状态，并采用递增退避（第一次 24 小时，第二次 48 小时，第三次及以后 1 周），然后继续执行当前 skill。不再主动提及升级。

```bash
_SNOOZE_FILE=~/.gstack/update-snoozed
_REMOTE_VER="{new}"
_CUR_LEVEL=0
if [ -f "$_SNOOZE_FILE" ]; then
  _SNOOZED_VER=$(awk '{print $1}' "$_SNOOZE_FILE")
  if [ "$_SNOOZED_VER" = "$_REMOTE_VER" ]; then
    _CUR_LEVEL=$(awk '{print $2}' "$_SNOOZE_FILE")
    case "$_CUR_LEVEL" in *[!0-9]*) _CUR_LEVEL=0 ;; esac
  fi
fi
_NEW_LEVEL=$((_CUR_LEVEL + 1))
[ "$_NEW_LEVEL" -gt 3 ] && _NEW_LEVEL=3
echo "$_REMOTE_VER $_NEW_LEVEL $(date +%s)" > "$_SNOOZE_FILE"
```

注意：`{new}` 是 `UPGRADE_AVAILABLE` 输出里的远程版本号，要用实际检查结果替换。

告诉用户当前的 snooze 时长："Next reminder in 24h"（或 48h、1 week，取决于级别）。补一句提示："Set `auto_upgrade: true` in `~/.gstack/config.yaml` for automatic upgrades."

**如果选择 "Never ask again"：**

```bash
~/.claude/skills/gstack/bin/gstack-config set update_check false
```

告诉用户："Update checks disabled. Run `~/.claude/skills/gstack/bin/gstack-config set update_check true` to re-enable."  
然后继续执行当前 skill。

### 第 2 步：识别安装类型

```bash
if [ -d "$HOME/.claude/skills/gstack/.git" ]; then
  INSTALL_TYPE="global-git"
  INSTALL_DIR="$HOME/.claude/skills/gstack"
elif [ -d "$HOME/.gstack/repos/gstack/.git" ]; then
  INSTALL_TYPE="global-git"
  INSTALL_DIR="$HOME/.gstack/repos/gstack"
elif [ -d ".claude/skills/gstack/.git" ]; then
  INSTALL_TYPE="local-git"
  INSTALL_DIR=".claude/skills/gstack"
elif [ -d ".agents/skills/gstack/.git" ]; then
  INSTALL_TYPE="local-git"
  INSTALL_DIR=".agents/skills/gstack"
elif [ -d ".claude/skills/gstack" ]; then
  INSTALL_TYPE="vendored"
  INSTALL_DIR=".claude/skills/gstack"
elif [ -d "$HOME/.claude/skills/gstack" ]; then
  INSTALL_TYPE="vendored-global"
  INSTALL_DIR="$HOME/.claude/skills/gstack"
else
  echo "ERROR: gstack not found"
  exit 1
fi
echo "Install type: $INSTALL_TYPE at $INSTALL_DIR"
```

后续所有步骤都使用这里输出的安装类型和目录路径。

### 第 3 步：保存旧版本

使用第 2 步输出的安装目录：

```bash
OLD_VERSION=$(cat "$INSTALL_DIR/VERSION" 2>/dev/null || echo "unknown")
```

### 第 4 步：执行升级

使用第 2 步检测到的安装类型和目录：

**对于 git 安装**（`global-git`、`local-git`）：

```bash
cd "$INSTALL_DIR"
STASH_OUTPUT=$(git stash 2>&1)
git fetch origin
git reset --hard origin/main
./setup
```

如果 `$STASH_OUTPUT` 中包含 "Saved working directory"，要提醒用户："Note: local changes were stashed. Run `git stash pop` in the skill directory to restore them."

**对于 vendored 安装**（`vendored`、`vendored-global`）：

```bash
PARENT=$(dirname "$INSTALL_DIR")
TMP_DIR=$(mktemp -d)
git clone --depth 1 https://github.com/garrytan/gstack.git "$TMP_DIR/gstack"
mv "$INSTALL_DIR" "$INSTALL_DIR.bak"
mv "$TMP_DIR/gstack" "$INSTALL_DIR"
cd "$INSTALL_DIR" && ./setup
rm -rf "$INSTALL_DIR.bak" "$TMP_DIR"
```

### 第 4.5 步：同步本地 vendored 副本

使用第 2 步得到的安装目录。检查是否还存在一个需要同步的本地 vendored 副本：

```bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
LOCAL_GSTACK=""
if [ -n "$_ROOT" ] && [ -d "$_ROOT/.claude/skills/gstack" ]; then
  _RESOLVED_LOCAL=$(cd "$_ROOT/.claude/skills/gstack" && pwd -P)
  _RESOLVED_PRIMARY=$(cd "$INSTALL_DIR" && pwd -P)
  if [ "$_RESOLVED_LOCAL" != "$_RESOLVED_PRIMARY" ]; then
    LOCAL_GSTACK="$_ROOT/.claude/skills/gstack"
  fi
fi
echo "LOCAL_GSTACK=$LOCAL_GSTACK"
```

如果 `LOCAL_GSTACK` 非空，就从刚升级好的主安装中复制一份过去并更新它（做法与 README 里的 vendored 安装方式一致）：

```bash
mv "$LOCAL_GSTACK" "$LOCAL_GSTACK.bak"
cp -Rf "$INSTALL_DIR" "$LOCAL_GSTACK"
rm -rf "$LOCAL_GSTACK/.git"
cd "$LOCAL_GSTACK" && ./setup
rm -rf "$LOCAL_GSTACK.bak"
```

告诉用户："Also updated vendored copy at `$LOCAL_GSTACK` — commit `.claude/skills/gstack/` when you're ready."

如果 `./setup` 失败，则从备份恢复并提醒用户：

```bash
rm -rf "$LOCAL_GSTACK"
mv "$LOCAL_GSTACK.bak" "$LOCAL_GSTACK"
```

告诉用户："Sync failed — restored previous version at `$LOCAL_GSTACK`. Run `/gstack-upgrade` manually to retry."

### 第 5 步：写升级标记并清空缓存

```bash
mkdir -p ~/.gstack
echo "$OLD_VERSION" > ~/.gstack/just-upgraded-from
rm -f ~/.gstack/last-update-check
rm -f ~/.gstack/update-snoozed
```

### 第 6 步：展示新增内容

读取 `$INSTALL_DIR/CHANGELOG.md`。找到旧版本到新版本之间的所有版本条目。按主题归纳成 5-7 条摘要。不要把用户淹没，只讲用户能感知到的变化。除非内部重构非常重要，否则跳过。

格式：

```
gstack v{new} — upgraded from v{old}!

What's new:
- [bullet 1]
- [bullet 2]
- ...

Happy shipping!
```

### 第 7 步：继续原工作流

展示完 What's New 之后，继续执行用户原本触发的 skill。升级已经完成，不需要额外动作。

---

## 独立使用

当用户直接调用 `/gstack-upgrade`（而不是从 preamble 里触发）时：

1. 强制执行一次全新的升级检查（跳过缓存）：

```bash
~/.claude/skills/gstack/bin/gstack-update-check --force 2>/dev/null || \
.claude/skills/gstack/bin/gstack-update-check --force 2>/dev/null || true
```

根据输出判断是否有可用升级。

2. 如果输出为 `UPGRADE_AVAILABLE <old> <new>`：按照上面的第 2-6 步执行。

3. 如果没有输出（说明主安装已是最新）：检查是否存在过期的本地 vendored 副本。

运行上文第 2 步的 bash 代码块，识别主安装的 `INSTALL_TYPE` 和 `INSTALL_DIR`。然后再运行上文第 4.5 步的探测代码块，检查是否存在本地 vendored 副本（`LOCAL_GSTACK`）。

**如果 `LOCAL_GSTACK` 为空**（没有本地 vendored 副本）：告诉用户 "You're already on the latest version (v{version})."

**如果 `LOCAL_GSTACK` 非空**，则比较版本：

```bash
PRIMARY_VER=$(cat "$INSTALL_DIR/VERSION" 2>/dev/null || echo "unknown")
LOCAL_VER=$(cat "$LOCAL_GSTACK/VERSION" 2>/dev/null || echo "unknown")
echo "PRIMARY=$PRIMARY_VER LOCAL=$LOCAL_VER"
```

**如果版本不一致：** 按上面的第 4.5 步同步逻辑，用主安装更新本地副本。告诉用户："Global v{PRIMARY_VER} is up to date. Updated local vendored copy from v{LOCAL_VER} → v{PRIMARY_VER}. Commit `.claude/skills/gstack/` when you're ready."

**如果版本一致：** 告诉用户 "You're on the latest version (v{PRIMARY_VER}). Global and local vendored copy are both up to date."
