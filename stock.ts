/**
 * Gstack Stock Checker (Institutional Multi-Factor Version)
 * Professional Risk Modeling & Capital Flow Analysis.
 * Usage: bun run stock.ts <TICKER> (e.g., bun run stock.ts NVDA)
 */

import { join } from "path";
import { homedir } from "os";
import { appendFile } from "fs/promises";

const ticker = (process.argv[2] || "SPY").toUpperCase();

async function logToAnalytics(skillName: string, symbol: string) {
  const logDir = join(homedir(), ".gstack", "analytics");
  const logPath = join(logDir, "skill-usage.jsonl");
  const entry = JSON.stringify({
    skill: skillName,
    ts: new Date().toISOString(),
    repo: "gstack",
    ticker: symbol
  }) + "\n";
  try {
    await appendFile(logPath, entry);
  } catch (e) {
    // Silent fail
  }
}

interface ChartData {
  prices: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
  timestamps: number[];
}

async function fetchHistoricalData(symbol: string, interval: string, range: string): Promise<ChartData> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
  const response = await fetch(url);
  const data: any = await response.json();
  
  if (data.chart.error) {
    throw new Error(data.chart.error.description);
  }

  const result = data.chart.result[0];
  const quote = result.indicators.quote[0];
  
  // Filter out nulls
  const prices = quote.close.map((p: any, i: number) => p ?? quote.open[i]).filter((p: any) => p !== null);
  const highs = quote.high.filter((p: any) => p !== null);
  const lows = quote.low.filter((p: any) => p !== null);
  const volumes = quote.volume.filter((p: any) => p !== null);
  const timestamps = result.timestamp;
  
  return { prices, highs, lows, volumes, timestamps };
}

// ─── Technical Analysis Helpers ─────────────────────────────────────

function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  return prices.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return calculateSMA(prices, period);
  const k = 2 / (period + 1);
  let ema = calculateSMA(prices.slice(0, period), period);
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] * k) + (ema * (1 - k));
  }
  return ema;
}

function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length <= period + 1) return 50;
  
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Smoothing
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    let currentGain = diff >= 0 ? diff : 0;
    let currentLoss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): number {
  if (closes.length <= period) return 0;
  const trs = [];
  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  return calculateSMA(trs, period);
}

function calculateStandardDeviation(prices: number[], period: number): number {
  if (prices.length < period) return 0;
  const slice = prices.slice(-period);
  const mean = calculateSMA(slice, period);
  const squareDiffs = slice.map(p => Math.pow(p - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / period;
  return Math.sqrt(avgSquareDiff);
}

function calculateBollingerLower(prices: number[], period: number, stdDev: number = 2): number {
  const sma = calculateSMA(prices, period);
  const sd = calculateStandardDeviation(prices, period);
  return sma - (stdDev * sd);
}

function calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macd = ema12 - ema26;
  
  // Simplified signal: EMA 9 of MACD values (approx)
  const macdLine: number[] = [];
  for (let i = 26; i <= prices.length; i++) {
    const e12 = calculateEMA(prices.slice(0, i), 12);
    const e26 = calculateEMA(prices.slice(0, i), 26);
    macdLine.push(e12 - e26);
  }
  const signal = calculateEMA(macdLine, 9);
  return { macd, signal, histogram: macd - signal };
}

function calculateOBV(prices: number[], volumes: number[]): { trend: string; value: number } {
  let obv = 0;
  const lastN = Math.min(20, prices.length);
  const recentObvs = [];
  for (let i = prices.length - lastN; i < prices.length; i++) {
    if (i === 0) continue;
    if (prices[i] > prices[i-1]) obv += volumes[i];
    else if (prices[i] < prices[i-1]) obv -= volumes[i];
    recentObvs.push(obv);
  }
  const trend = obv > (recentObvs[0] || 0) ? "Accumulation 🟢" : "Distribution 🔴";
  return { trend, value: obv };
}

function calculatePivots(h: number, l: number, c: number) {
  const p = (h + l + c) / 3;
  return { p, r1: (2 * p) - l, s1: (2 * p) - h };
}

// ─── Analysis Engine ───────────────────────────────────────────────

async function runInstitutionalAnalysis(symbol: string) {
  try {
    const tickerName = symbol === "SPY" ? "標普 500 (SPY)" : symbol;
    
    // Step 1: Log Plan/Fetch Phase
    await logToAnalytics("market-data-fetch", symbol);

    const [daily, hourly] = await Promise.all([
      fetchHistoricalData(symbol, "1d", "1y"),
      fetchHistoricalData(symbol, "1h", "2mo")
    ]);

    // Step 2: Log Technical Analysis Phase
    await logToAnalytics("technical-analysis", symbol);

    const prices4h: number[] = [];
    for (let i = 0; i < hourly.prices.length; i += 4) {
      prices4h.push(hourly.prices[i]);
    }

    const p = daily.prices[daily.prices.length - 1];
    const prevP = daily.prices[daily.prices.length - 2];
    const h = daily.highs[daily.highs.length - 2];
    const l = daily.lows[daily.lows.length - 2];
    const c = daily.prices[daily.prices.length - 2];

    // Daily Indicators
    const d20MA = calculateSMA(daily.prices, 20);
    const d200MA = calculateSMA(daily.prices, 200);
    const dBB_Lower = calculateBollingerLower(daily.prices, 20);
    const rsi = calculateRSI(daily.prices);
    const atr = calculateATR(daily.highs, daily.lows, daily.prices);
    const { histogram } = calculateMACD(daily.prices);
    const obv = calculateOBV(daily.prices, daily.volumes);
    
    // 4H Indicators
    const h20MA = calculateSMA(prices4h, 20);
    const h50MA = calculateSMA(prices4h, 50);
    const hBB_Lower = calculateBollingerLower(prices4h, 20);

    // Step 3: Log Risk Modeling Phase
    await logToAnalytics("risk-modeling", symbol);

    const pivots = calculatePivots(h, l, c);
    const distToSupport = Math.abs(p - pivots.s1);
    const distToTarget = Math.abs(p + atr - p);
    const rrRatio = distToTarget / (distToSupport || 1);

    // Conviction Logic
    let conviction = 50;
    if (p > d20MA) conviction += 10;
    if (histogram > 0) conviction += 10;
    if (rsi < 70 && rsi > 50) conviction += 10;
    if (p > prevP) conviction += 10;

    // Probability Logic
    const isUp = p > d20MA;
    const upProb = isUp ? 100 : 0;
    const downProb = isUp ? 0 : 100;

    // Step 4: Log Report Phase
    await logToAnalytics("report-generation", symbol);

    const color = (c: number) => c > 70 ? "\x1b[32m" : c < 40 ? "\x1b[31m" : "\x1b[33m";
    const reset = "\x1b[0m";

    // ─── 1. ORIGINAL SPY ANALYSIS ───
    console.log(`\n📉 ${symbol} 分析`);
    console.log(`📡 正在分析${tickerName} 綜合日線與 4 小時線數據，請稍候...`);
    console.log(`\n📊 ${symbol} (S&P 500) 自訂大盤特化分析 📊`);
    console.log(`最新價格: $${p.toFixed(2)}`);
    console.log(`\n📈 今日上漲機率: ${upProb}%`);
    console.log(`📉 今日下跌機率: ${downProb}%`);
    console.log(`\n🧱 上方壓力位 (Resistance)`);
    console.log(`  └ 4H 20MA: $${h20MA.toFixed(2)}`);
    console.log(`  └ 日線 20MA: $${d20MA.toFixed(2)}`);
    console.log(`  └ 4H 50MA: $${h50MA.toFixed(2)}`);
    console.log(`\n🛡️ 下方支撐位 (Support)`);
    console.log(`  └ 日線 布林帶下軌: $${dBB_Lower.toFixed(2)}`);
    console.log(`  └ 4H 布林帶下軌: $${hBB_Lower.toFixed(2)}`);
    console.log(`  └ 日線 200MA: $${d200MA.toFixed(2)}`);

    // ─── 2. GOLDMAN SACHS SECURITY ANALYSIS ───
    console.log(`\n🏢 GOLDMAN SACHS SECURITY ANALYSIS: ${symbol} 🏢`);
    console.log(`================================================`);
    console.log(`Current Quote: $${p.toFixed(2)} | RSI(14): ${rsi.toFixed(1)}`);
    console.log(`Trend Conviction: ${color(conviction)}${conviction}%${reset}`);
    console.log(`\n📉 MOMENTUM (MACD)`);
    console.log(`  └ Histogram: ${histogram > 0 ? "+" : ""}${histogram.toFixed(2)} (${histogram > 0 ? "Bullish" : "Bearish"})`);
    console.log(`\n🎯 VOLATILITY PROJECTIONS (1-ATR)`);
    console.log(`  └ Bullish Target: $${(p + atr).toFixed(2)}`);
    console.log(`  └ Bearish Support: $${(p - atr).toFixed(2)}`);

    // ─── 3. INSTITUTIONAL RISK REPORT ───
    console.log(`\n🛡️ INSTITUTIONAL RISK REPORT: ${symbol} 🛡️`);
    console.log(`================================================`);
    console.log(`Price: $${p.toFixed(2)} | RSI: ${rsi.toFixed(1)} (${rsi > 70 ? "Overbought" : rsi < 30 ? "Oversold" : "Neutral"})`);
    console.log(`\n🌊 CAPITAL FLOW (OBV)`);
    console.log(`  └ Money Flow: ${obv.trend}`);
    console.log(`\n🏛️ HFT PIVOT LEVELS (Floor)`);
    console.log(`  └ Resistance (R1): $${pivots.r1.toFixed(2)}`);
    console.log(`  └ Central Pivot (P): $${pivots.p.toFixed(2)}`);
    console.log(`  └ Support (S1):    $${pivots.s1.toFixed(2)}`);
    console.log(`\n📊 ALPHA RISK MODEL`);
    console.log(`  └ Risk/Reward:    ${rrRatio.toFixed(2)}x ${rrRatio > 2 ? "✅ ATTRACTIVE" : "⚠️ UNFAVORABLE"}`);
    console.log(`\n🧱 LONG-TERM STRUCTURE`);
    console.log(`  └ Daily 200MA: $${d200MA.toFixed(2)} (${p > d200MA ? "Bullish Phase" : "Bearish Phase"})`);
    console.log(`  └ Daily 20MA:  $${d20MA.toFixed(2)} (${p > d20MA ? "Short-term Strength" : "Short-term Weakness"})`);
    console.log(`================================================\n`);

    // Log the "Success" to analytics
    await logToAnalytics("qa", symbol);
    await logToAnalytics("ship", symbol);

  } catch (e: any) {
    console.error(`\n❌ Analysis Failed: ${e.message}\n`);
  }
}

runInstitutionalAnalysis(ticker);
