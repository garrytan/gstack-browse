# Design Doc: Gstack Stock Checker (Wedge 1)

## 1. Demand Reality
- **User**: Individual investor (you) who wants to quickly check a stock's price and daily performance without opening a browser or a heavy app.
- **Pain**: Opening a browser, searching for a ticker, and navigating through ads/popups just to see a single number is high friction.

## 2. Status Quo
- Manual search on Google/Yahoo Finance. It takes ~30-60 seconds and constant context switching.

## 3. Desperate Specificity
- The single most painful part is getting a "clean" price and a "Up/Down" indicator in the terminal.

## 4. Narrowest Wedge
- A Bun script: `stock.ts`.
- It takes a ticker symbol as a command-line argument (e.g., `bun run stock.ts SPY`).
- It uses a free, no-auth API (like `query1.finance.yahoo.com`) to fetch real-time and historical data.
- It prints: `Ticker`, `Price`, `Probabilities`, `Technical Indicators (MA, Bollinger Bands)`.
- It mimics a professional market analysis layout with Chinese text and emojis.

## 5. Observation
- We know it's working if `bun run stock.ts SPY` returns a valid analysis with support/resistance levels in < 5 seconds.

## 6. Future-Fit (Goldman Sachs Analyst Recommendations)
- **Momentum & Strength**: Integrate RSI (Relative Strength Index) and MACD (Moving Average Convergence Divergence) to identify institutional accumulation/distribution phases.
- **Institutional Confirmation**: Add Volume Analysis to distinguish between retail noise and institutional conviction.
- **Volatility-Adjusted Risk**: Implement ATR (Average True Range) to project 1-standard-deviation price target ranges for the next session.
- **Cross-Asset Correlation**: Eventually track Bond Yields (TNX) or Dollar Index (DXY) impact on high-growth tech (NVDA, etc.).

## 7. Multi-Specialist Risk Model (BlackRock/Vanguard Grade)
- **Flow of Capital**: On-Balance Volume (OBV) to detect if price movement is supported by actual money flow (Divergence Analysis).
- **Mean Reversion**: Stochastic Oscillator (%K, %D) to identify precise entry/exit points during sideways consolidation.
- **Institutional Floor**: Floor Pivot Points (P, R1, S1) to identify "Unseen" support/resistance levels used by high-frequency trading (HFT) algorithms.
- **Risk-Reward Alpha**: Automatic calculation of R/R ratio based on current price vs. ATR-projected targets.

---

## Technical Implementation Plan (Institutional Upgrade)
1.  **OBV Logic**: Cumulative volume total that adds/subtracts based on daily close.
2.  **Stochastic Calculation**: 14-period %K and 3-period %D smoothing.
3.  **Pivot Point Math**: Standard Floor Pivots using (High + Low + Close) / 3 from the previous session.
4.  **Risk Summary**: High-level "Risk/Reward" rating for the current entry.
