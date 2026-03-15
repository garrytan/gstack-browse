/**
 * Command registry — single source of truth for all browse commands.
 *
 * Dependency graph:
 *   commands.ts ──▶ server.ts (runtime dispatch)
 *                ──▶ gen-skill-docs.ts (doc generation)
 *                ──▶ skill-parser.ts (validation)
 *                ──▶ skill-check.ts (health reporting)
 *
 * Zero side effects. Safe to import from build scripts and tests.
 */

export const READ_COMMANDS = new Set([
  'text', 'html', 'links', 'forms', 'accessibility',
  'js', 'eval', 'css', 'attrs',
  'console', 'network', 'cookies', 'storage', 'perf',
  'dialog', 'is',
]);

export const WRITE_COMMANDS = new Set([
  'goto', 'back', 'forward', 'reload',
  'click', 'fill', 'select', 'hover', 'type', 'press', 'scroll', 'wait',
  'viewport', 'cookie', 'cookie-import', 'cookie-import-browser', 'header', 'useragent',
  'upload', 'dialog-accept', 'dialog-dismiss',
]);

export const META_COMMANDS = new Set([
  'tabs', 'tab', 'newtab', 'closetab',
  'status', 'stop', 'restart',
  'screenshot', 'pdf', 'responsive',
  'chain', 'diff',
  'url', 'snapshot',
]);

export const ALL_COMMANDS = new Set([...READ_COMMANDS, ...WRITE_COMMANDS, ...META_COMMANDS]);

export const COMMAND_DESCRIPTIONS: Record<string, { category: string; description: string; usage?: string }> = {
  // Navigation
  'goto':    { category: 'Navigation', description: 'URLへ移動', usage: 'goto <url>' },
  'back':    { category: 'Navigation', description: '履歴を戻る' },
  'forward': { category: 'Navigation', description: '履歴を進む' },
  'reload':  { category: 'Navigation', description: 'ページを再読み込み' },
  'url':     { category: 'Navigation', description: '現在のURLを表示' },
  // Reading
  'text':    { category: 'Reading', description: '整形済みページテキスト' },
  'html':    { category: 'Reading', description: 'selector の innerHTML（見つからなければエラー）。selector 省略時はページ全体のHTML', usage: 'html [selector]' },
  'links':   { category: 'Reading', description: 'すべてのリンクを "text → href" 形式で表示' },
  'forms':   { category: 'Reading', description: 'フォーム項目をJSONで表示' },
  'accessibility': { category: 'Reading', description: 'ARIAツリー全体' },
  // Inspection
  'js':      { category: 'Inspection', description: 'JavaScript 式を実行し、結果を文字列で返す', usage: 'js <expr>' },
  'eval':    { category: 'Inspection', description: 'ファイル内の JavaScript を実行し、結果を文字列で返す（path は /tmp または cwd 配下のみ）', usage: 'eval <file>' },
  'css':     { category: 'Inspection', description: '計算済みCSS値を取得', usage: 'css <sel> <prop>' },
  'attrs':   { category: 'Inspection', description: '要素属性をJSONで表示', usage: 'attrs <sel|@ref>' },
  'is':      { category: 'Inspection', description: '状態確認（visible/hidden/enabled/disabled/checked/editable/focused）', usage: 'is <prop> <sel>' },
  'console': { category: 'Inspection', description: 'コンソールメッセージ（--errors で error/warning のみ）', usage: 'console [--clear|--errors]' },
  'network': { category: 'Inspection', description: 'ネットワークリクエスト', usage: 'network [--clear]' },
  'dialog':  { category: 'Inspection', description: 'ダイアログメッセージ', usage: 'dialog [--clear]' },
  'cookies': { category: 'Inspection', description: 'すべての cookie をJSONで表示' },
  'storage': { category: 'Inspection', description: 'localStorage + sessionStorage をJSONで表示。set <key> <value> で localStorage に書き込み', usage: 'storage [set k v]' },
  'perf':    { category: 'Inspection', description: 'ページ読み込みタイミング' },
  // Interaction
  'click':   { category: 'Interaction', description: '要素をクリック', usage: 'click <sel>' },
  'fill':    { category: 'Interaction', description: '入力欄に値を入力', usage: 'fill <sel> <val>' },
  'select':  { category: 'Interaction', description: 'ドロップダウンを value/label/表示テキストで選択', usage: 'select <sel> <val>' },
  'hover':   { category: 'Interaction', description: '要素にホバー', usage: 'hover <sel>' },
  'type':    { category: 'Interaction', description: 'フォーカス中の要素へ入力', usage: 'type <text>' },
  'press':   { category: 'Interaction', description: 'キー入力（Enter, Tab, Escape, ArrowUp/Down/Left/Right, Backspace, Delete, Home, End, PageUp, PageDown, Shift+Enter など）', usage: 'press <key>' },
  'scroll':  { category: 'Interaction', description: '要素を表示位置までスクロール。selector 省略時はページ最下部までスクロール', usage: 'scroll [sel]' },
  'wait':    { category: 'Interaction', description: '要素、network idle、ページ読み込みを待機（timeout: 15秒）', usage: 'wait <sel|--networkidle|--load>' },
  'upload':  { category: 'Interaction', description: 'ファイルをアップロード', usage: 'upload <sel> <file> [file2...]' },
  'viewport':{ category: 'Interaction', description: 'ビューポートサイズを設定', usage: 'viewport <WxH>' },
  'cookie':  { category: 'Interaction', description: '現在ページのドメインに cookie を設定', usage: 'cookie <name>=<value>' },
  'cookie-import': { category: 'Interaction', description: 'JSONファイルから cookie を取り込み', usage: 'cookie-import <json>' },
  'cookie-import-browser': { category: 'Interaction', description: 'Comet/Chrome/Arc/Brave/Edge から cookie を取り込み（picker を開くか、--domain で直接取り込み）', usage: 'cookie-import-browser [browser] [--domain d]' },
  'header':  { category: 'Interaction', description: 'カスタムリクエストヘッダーを設定（colon区切り。機密値は自動マスク）', usage: 'header <name>:<value>' },
  'useragent': { category: 'Interaction', description: 'User-Agent を設定', usage: 'useragent <string>' },
  'dialog-accept': { category: 'Interaction', description: '次の alert/confirm/prompt を自動 accept。任意テキストは prompt 応答として送信', usage: 'dialog-accept [text]' },
  'dialog-dismiss': { category: 'Interaction', description: '次のダイアログを自動 dismiss' },
  // Visual
  'screenshot': { category: 'Visual', description: 'スクリーンショットを保存（CSS/@ref 指定の要素切り抜き、--clip 範囲、--viewport 対応）', usage: 'screenshot [--viewport] [--clip x,y,w,h] [selector|@ref] [path]' },
  'pdf':     { category: 'Visual', description: 'PDFとして保存', usage: 'pdf [path]' },
  'responsive': { category: 'Visual', description: 'mobile(375x812)/tablet(768x1024)/desktop(1280x720) で撮影。{prefix}-mobile.png 形式で保存', usage: 'responsive [prefix]' },
  'diff':    { category: 'Visual', description: 'ページ間のテキスト差分', usage: 'diff <url1> <url2>' },
  // Tabs
  'tabs':    { category: 'Tabs', description: '開いているタブ一覧' },
  'tab':     { category: 'Tabs', description: 'タブを切り替え', usage: 'tab <id>' },
  'newtab':  { category: 'Tabs', description: '新しいタブを開く', usage: 'newtab [url]' },
  'closetab':{ category: 'Tabs', description: 'タブを閉じる', usage: 'closetab [id]' },
  // Server
  'status':  { category: 'Server', description: 'ヘルスチェック' },
  'stop':    { category: 'Server', description: 'サーバーを停止' },
  'restart': { category: 'Server', description: 'サーバーを再起動' },
  // Meta
  'snapshot':{ category: 'Snapshot', description: '要素選択用 @e ref 付きアクセシビリティツリー。フラグ: -i interactive のみ, -c compact, -d N 深さ制限, -s sel 範囲指定, -D 前回との差分, -a 注釈付きスクリーンショット, -o 出力パス, -C cursor-interactive @c ref', usage: 'snapshot [flags]' },
  'chain':   { category: 'Meta', description: 'stdin の JSON からコマンドを順に実行。形式: [["cmd","arg1",...],...]' },
};

// Load-time validation: descriptions must cover exactly the command sets
const allCmds = new Set([...READ_COMMANDS, ...WRITE_COMMANDS, ...META_COMMANDS]);
const descKeys = new Set(Object.keys(COMMAND_DESCRIPTIONS));
for (const cmd of allCmds) {
  if (!descKeys.has(cmd)) throw new Error(`COMMAND_DESCRIPTIONS にエントリがありません: ${cmd}`);
}
for (const key of descKeys) {
  if (!allCmds.has(key)) throw new Error(`COMMAND_DESCRIPTIONS に未知のコマンドがあります: ${key}`);
}
