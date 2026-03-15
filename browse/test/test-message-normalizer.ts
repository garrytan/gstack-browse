export function normalizeTestMessage(message: string): string {
  let out = message;

  // Common errors
  out = out.replace(/使い方:/g, 'Usage:');
  out = out.replace(/未知の/g, 'Unknown');
  out = out.replace(/Unknown snapshot フラグです/g, 'Unknown snapshot flag');
  out = out.replace(/Unknown screenshot フラグです/g, 'Unknown screenshot flag');
  out = out.replace(/(.*) の JSON が不正です/g, 'Invalid JSON: $1');
  out = out.replace(/JSON が不正です/g, 'Invalid JSON');
  out = out.replace(/ファイルが見つかりません: /g, 'File not found: ');
  out = out.replace(/selector が見つかりません: /g, 'Selector not found: ');
  out = out.replace(/パストラバーサル .* は許可されていません/g, 'Path traversal is not allowed');
  out = out.replace(/絶対パスは次の範囲内である必要があります/g, 'Absolute path must be within');
  out = out.replace(/パスは次の範囲内である必要があります/g, 'Path must be within');
  out = out.replace(/cookie ファイルは JSON 配列である必要があります/g, 'cookie file must be JSON array');

  // Core command responses
  out = out.replace(/^(.+) に移動しました \((.+)\)$/gm, 'Navigated to $1 ($2)');
  out = out.replace(/^戻る → (.+)$/gm, 'Back → $1');
  out = out.replace(/^進む → (.+)$/gm, 'Forward → $1');
  out = out.replace(/^(.+) を再読み込みしました$/gm, 'Reloaded $1');
  out = out.replace(/^(.+) をクリックしました → 現在 (.+)$/gm, 'Clicked $1 → now $2');
  out = out.replace(/^(.+) に入力しました$/gm, 'Filled $1');
  out = out.replace(/^(.+) で "(.+)" を選択しました$/gm, 'Selected $1 "$2"');
  out = out.replace(/^(.+) にホバーしました$/gm, 'Hovered $1');
  out = out.replace(/^要素 (.+) が表示されました$/gm, '$1 appeared');
  out = out.replace(/^(.+) が見える位置までスクロールしました$/gm, 'Scrolled to $1');
  out = out.replace(/^ページ最下部までスクロールしました$/gm, 'Scrolled to page bottom');
  out = out.replace(/^ビューポートを (.+) に設定しました$/gm, 'Viewport set to $1');
  out = out.replace(/^(\d+) 文字入力しました$/gm, 'Typed $1 characters');
  out = out.replace(/^(.+) を押しました$/gm, 'Pressed $1');
  out = out.replace(/^コンソールバッファをクリアしました。$/gm, 'console buffer cleared');
  out = out.replace(/^ダイアログバッファをクリアしました。$/gm, 'dialog buffer cleared');
  out = out.replace(/^ネットワークバッファをクリアしました。$/gm, 'network buffer cleared');
  out = out.replace(/^（コンソールメッセージはありません）$/gm, '(no console messages)');
  out = out.replace(/^（ダイアログは記録されていません）$/gm, '(no dialogs)');
  out = out.replace(/^スクリーンショットを保存しました（要素）: (.+)$/gm, 'Screenshot saved (element): $1');
  out = out.replace(/^スクリーンショットを保存しました（clip (.+)）: (.+)$/gm, 'Screenshot saved (clip $1): $2');
  out = out.replace(/^スクリーンショットを保存しました（viewport）: (.+)$/gm, 'Screenshot saved (viewport): $1');
  out = out.replace(/^スクリーンショットを保存しました: (.+)$/gm, 'Screenshot saved: $1');
  out = out.replace(/^--clip と selector\/ref は同時に使えません。どちらか一方を指定してください$/gm, 'Cannot use --clip with a selector/ref');
  out = out.replace(/^--viewport と --clip は同時に使えません。どちらか一方を指定してください$/gm, 'Cannot use --viewport with --clip');
  out = out.replace(/^Usage: screenshot --clip x,y,width,height（すべて数値）$/gm, 'Usage: screenshot --clip x,y,width,height (all must be numbers)');
  out = out.replace(/\[注釈付きスクリーンショット: (.+)\]/g, '[annotated screenshot: $1]');
  out = out.replace(/^タブ (\d+) を開きました → (.+)$/gm, 'Opened tab $1 → $2');
  out = out.replace(/^タブ (\d+) に切り替えました$/gm, 'Switched to tab $1');
  out = out.replace(/^タブを閉じました (\d+)$/gm, 'Closed tab $1');
  out = out.replace(/^ステータス:/gm, 'Status:');
  out = out.replace(/^タブ数:/gm, 'Tabs:');
  out = out.replace(/サーバーを起動しています/g, 'Starting server');
  out = out.replace(/^ネットワークが idle 状態になりました$/gm, 'Network idle');
  out = out.replace(/^ページ読み込みが完了しました$/gm, 'Page loaded');
  out = out.replace(/^DOM コンテンツの読み込みが完了しました$/gm, 'DOM content loaded');
  out = out.replace(/^（コンソールエラーはありません）$/gm, '(no console errors)');
  out = out.replace(/^(.+) から (\d+) 件の cookie を読み込みました$/gm, 'Loaded $2 cookies from $1');
  out = out.replace(/^cookie を設定しました: /gm, 'Cookie set: ');
  out = out.replace(/^ヘッダーを設定しました: /gm, 'Header set: ');
  out = out.replace(/^ダイアログを自動 dismiss します$/gm, 'dialogs auto dismissed');
  out = out.replace(/^アップロードしました: /gm, 'Uploaded: ');
  out = out.replace(/^PDF を保存しました: (.+) \((.+) bytes\)$/gm, 'PDF saved: $1 ($2 bytes)');
  out = out.replace(/^PDFを保存しました: (.+)$/gm, 'PDF saved: $1');
  out = out.replace(/^User-Agent を設定しました: /gm, 'User-Agent set: ');
  out = out.replace(/比較対象の前回 snapshot がないため/g, 'no previous snapshot:');
  out = out.replace(/ベースライン/g, 'baseline');
  out = out.replace(/^--- 前回 snapshot$/gm, '--- previous snapshot');
  out = out.replace(/^\+\+\+ 現在 snapshot$/gm, '+++ current snapshot');

  // Generic terms
  out = out.replace(/見つかりません/g, 'not found');

  return out;
}

export async function normalizePromise(promise: Promise<string>): Promise<string> {
  try {
    return normalizeTestMessage(await promise);
  } catch (err) {
    if (err instanceof Error) {
      err.message = normalizeTestMessage(err.message);
    }
    throw err;
  }
}
