---
name: browse
version: 1.1.0
description: |
  QA テストとサイト dogfooding 向けの高速ヘッドレスブラウザ。任意の URL へ移動し、
  要素操作、ページ状態の確認、操作前後の差分確認、注釈付きスクリーンショット取得、
  レスポンシブレイアウト確認、フォーム/アップロード検証、ダイアログ処理、
  要素状態のアサーションを行える。1 コマンドあたり約 100ms。機能テスト、
  デプロイ検証、ユーザーフローの dogfooding、根拠付きバグ報告が必要なときに使う。
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion

---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

## Update Check (run first)

```bash
_UPD=$(~/.claude/skills/gstack/bin/gstack-update-check 2>/dev/null || .claude/skills/gstack/bin/gstack-update-check 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD" || true
```

If output shows `UPGRADE_AVAILABLE <old> <new>`: read `~/.claude/skills/gstack/gstack-upgrade/SKILL.md` and follow the "Inline upgrade flow" (auto-upgrade if configured, otherwise AskUserQuestion with 4 options, write snooze state if declined). If `JUST_UPGRADED <from> <to>`: tell user "Running gstack v{to} (just updated!)" and continue.

# browse: QA テスト & Dogfooding

永続 headless Chromium。最初の呼び出しで自動起動 (~3 秒) し、その後は 1 コマンド約 100ms。
呼び出し間で状態を保持する（cookies、tabs、login sessions）。

## SETUP (run this check BEFORE any browse command)

```bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
B=""
[ -n "$_ROOT" ] && [ -x "$_ROOT/.claude/skills/gstack/browse/dist/browse" ] && B="$_ROOT/.claude/skills/gstack/browse/dist/browse"
[ -z "$B" ] && B=~/.claude/skills/gstack/browse/dist/browse
if [ -x "$B" ]; then
  echo "READY: $B"
else
  echo "NEEDS_SETUP"
fi
```

If `NEEDS_SETUP`:
1. Tell the user: "gstack browse needs a one-time build (~10 seconds). OK to proceed?" Then STOP and wait.
2. Run: `cd <SKILL_DIR> && ./setup`
3. If `bun` is not installed: `curl -fsSL https://bun.sh/install | bash`

## 基本 QA パターン

### 1. ページが正しく読み込まれるか確認する
```bash
$B goto https://yourapp.com
$B text                          # content loads?
$B console                       # JS errors?
$B network                       # failed requests?
$B is visible ".main-content"    # key elements present?
```

### 2. ユーザーフローをテストする
```bash
$B goto https://app.com/login
$B snapshot -i                   # see all interactive elements
$B fill @e3 "user@test.com"
$B fill @e4 "password"
$B click @e5                     # submit
$B snapshot -D                   # diff: what changed after submit?
$B is visible ".dashboard"       # success state present?
```

### 3. 操作結果を検証する
```bash
$B snapshot                      # baseline
$B click @e3                     # do something
$B snapshot -D                   # unified diff shows exactly what changed
```

### 4. バグ報告向けの視覚的エビデンスを残す
```bash
$B snapshot -i -a -o /tmp/annotated.png   # labeled screenshot
$B screenshot /tmp/bug.png                # plain screenshot
$B console                                # error log
```

### 5. クリック可能要素をすべて見つける（non-ARIA 含む）
```bash
$B snapshot -C                   # finds divs with cursor:pointer, onclick, tabindex
$B click @c1                     # interact with them
```

### 6. 要素状態をアサートする
```bash
$B is visible ".modal"
$B is enabled "#submit-btn"
$B is disabled "#submit-btn"
$B is checked "#agree-checkbox"
$B is editable "#name-field"
$B is focused "#search-input"
$B js "document.body.textContent.includes('Success')"
```

### 7. レスポンシブレイアウトをテストする
```bash
$B responsive /tmp/layout        # mobile + tablet + desktop screenshots
$B viewport 375x812              # or set specific viewport
$B screenshot /tmp/mobile.png
```

### 8. ファイルアップロードをテストする
```bash
$B upload "#file-input" /path/to/file.pdf
$B is visible ".upload-success"
```

### 9. ダイアログをテストする
```bash
$B dialog-accept "yes"           # set up handler
$B click "#delete-button"        # trigger dialog
$B dialog                        # see what appeared
$B snapshot -D                   # verify deletion happened
```

### 10. 環境を比較する
```bash
$B diff https://staging.app.com https://prod.app.com
```

## Snapshot Flags

The snapshot is your primary tool for understanding and interacting with pages.

```
-i        --interactive           @e ref 付きの操作可能要素のみ（button/link/input）
-c        --compact               簡易表示（空の構造ノードを除外）
-d <N>    --depth                 ツリー深さを制限（0 = ルートのみ、既定: 無制限）
-s <sel>  --selector              CSS selector で対象範囲を限定
-D        --diff                  前回 snapshot との差分を unified diff で表示（初回はベースライン保存）
-a        --annotate              ref ラベル付き赤枠オーバーレイの注釈付きスクリーンショット
-o <path> --output                注釈付きスクリーンショットの出力先（既定: /tmp/browse-annotated.png）
-C        --cursor-interactive    cursor-interactive 要素（@c ref: pointer/onclick の div など）
```

All flags can be combined freely. `-o` only applies when `-a` is also used.
Example: `$B snapshot -i -a -C -o /tmp/annotated.png`

**Ref numbering:** @e refs are assigned sequentially (@e1, @e2, ...) in tree order.
@c refs from `-C` are numbered separately (@c1, @c2, ...).

After snapshot, use @refs as selectors in any command:
```bash
$B click @e3       $B fill @e4 "value"     $B hover @e1
$B html @e2        $B css @e5 "color"      $B attrs @e6
$B click @c1       # cursor-interactive ref (from -C)
```

**Output format:** indented accessibility tree with @ref IDs, one element per line.
```
  @e1 [heading] "Welcome" [level=1]
  @e2 [textbox] "Email"
  @e3 [button] "Submit"
```

Refs are invalidated on navigation — run `snapshot` again after `goto`.

## 全コマンド一覧

### Navigation
| Command | Description |
|---------|-------------|
| `back` | 履歴を戻る |
| `forward` | 履歴を進む |
| `goto <url>` | URLへ移動 |
| `reload` | ページを再読み込み |
| `url` | 現在のURLを表示 |

### Reading
| Command | Description |
|---------|-------------|
| `accessibility` | ARIAツリー全体 |
| `forms` | フォーム項目をJSONで表示 |
| `html [selector]` | selector の innerHTML（見つからなければエラー）。selector 省略時はページ全体のHTML |
| `links` | すべてのリンクを "text → href" 形式で表示 |
| `text` | 整形済みページテキスト |

### Interaction
| Command | Description |
|---------|-------------|
| `click <sel>` | 要素をクリック |
| `cookie <name>=<value>` | 現在ページのドメインに cookie を設定 |
| `cookie-import <json>` | JSONファイルから cookie を取り込み |
| `cookie-import-browser [browser] [--domain d]` | Comet/Chrome/Arc/Brave/Edge から cookie を取り込み（picker を開くか、--domain で直接取り込み） |
| `dialog-accept [text]` | 次の alert/confirm/prompt を自動 accept。任意テキストは prompt 応答として送信 |
| `dialog-dismiss` | 次のダイアログを自動 dismiss |
| `fill <sel> <val>` | 入力欄に値を入力 |
| `header <name>:<value>` | カスタムリクエストヘッダーを設定（colon区切り。機密値は自動マスク） |
| `hover <sel>` | 要素にホバー |
| `press <key>` | キー入力（Enter, Tab, Escape, ArrowUp/Down/Left/Right, Backspace, Delete, Home, End, PageUp, PageDown, Shift+Enter など） |
| `scroll [sel]` | 要素を表示位置までスクロール。selector 省略時はページ最下部までスクロール |
| `select <sel> <val>` | ドロップダウンを value/label/表示テキストで選択 |
| `type <text>` | フォーカス中の要素へ入力 |
| `upload <sel> <file> [file2...]` | ファイルをアップロード |
| `useragent <string>` | User-Agent を設定 |
| `viewport <WxH>` | ビューポートサイズを設定 |
| `wait <sel|--networkidle|--load>` | 要素、network idle、ページ読み込みを待機（timeout: 15秒） |

### Inspection
| Command | Description |
|---------|-------------|
| `attrs <sel|@ref>` | 要素属性をJSONで表示 |
| `console [--clear|--errors]` | コンソールメッセージ（--errors で error/warning のみ） |
| `cookies` | すべての cookie をJSONで表示 |
| `css <sel> <prop>` | 計算済みCSS値を取得 |
| `dialog [--clear]` | ダイアログメッセージ |
| `eval <file>` | ファイル内の JavaScript を実行し、結果を文字列で返す（path は /tmp または cwd 配下のみ） |
| `is <prop> <sel>` | 状態確認（visible/hidden/enabled/disabled/checked/editable/focused） |
| `js <expr>` | JavaScript 式を実行し、結果を文字列で返す |
| `network [--clear]` | ネットワークリクエスト |
| `perf` | ページ読み込みタイミング |
| `storage [set k v]` | localStorage + sessionStorage をJSONで表示。set <key> <value> で localStorage に書き込み |

### Visual
| Command | Description |
|---------|-------------|
| `diff <url1> <url2>` | ページ間のテキスト差分 |
| `pdf [path]` | PDFとして保存 |
| `responsive [prefix]` | mobile(375x812)/tablet(768x1024)/desktop(1280x720) で撮影。{prefix}-mobile.png 形式で保存 |
| `screenshot [--viewport] [--clip x,y,w,h] [selector|@ref] [path]` | スクリーンショットを保存（CSS/@ref 指定の要素切り抜き、--clip 範囲、--viewport 対応） |

### Snapshot
| Command | Description |
|---------|-------------|
| `snapshot [flags]` | 要素選択用 @e ref 付きアクセシビリティツリー。フラグ: -i interactive のみ, -c compact, -d N 深さ制限, -s sel 範囲指定, -D 前回との差分, -a 注釈付きスクリーンショット, -o 出力パス, -C cursor-interactive @c ref |

### Meta
| Command | Description |
|---------|-------------|
| `chain` | stdin の JSON からコマンドを順に実行。形式: [["cmd","arg1",...],...] |

### Tabs
| Command | Description |
|---------|-------------|
| `closetab [id]` | タブを閉じる |
| `newtab [url]` | 新しいタブを開く |
| `tab <id>` | タブを切り替え |
| `tabs` | 開いているタブ一覧 |

### Server
| Command | Description |
|---------|-------------|
| `restart` | サーバーを再起動 |
| `status` | ヘルスチェック |
| `stop` | サーバーを停止 |
