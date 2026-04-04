import { describe, expect, test } from "bun:test";
import { extractChainSection, extractNewsHeadlinesFromLinks, parseLinkLines, scoreHeadlineSentiment } from "../stock";

describe("stock sentiment helpers", () => {
  test("extractChainSection returns the command block content", () => {
    const stdout = ["[goto] ok", "", "[links] A → https://finance.yahoo.com/news/a", "B → https://finance.yahoo.com/news/b", "", "[text] ignored"].join(
      "\n",
    );
    expect(extractChainSection(stdout, "links")).toContain("A → https://finance.yahoo.com/news/a");
    expect(extractChainSection(stdout, "links")).toContain("B → https://finance.yahoo.com/news/b");
    expect(extractChainSection(stdout, "links")).not.toContain("[text]");
  });

  test("parseLinkLines parses 'text → href' lines", () => {
    const lines = ["Hello → https://x", "World → https://y"].join("\n");
    expect(parseLinkLines(lines)).toEqual([
      { text: "Hello", href: "https://x" },
      { text: "World", href: "https://y" },
    ]);
  });

  test("extractNewsHeadlinesFromLinks filters finance.yahoo.com/news links", () => {
    const links = [
      "Nav → https://finance.yahoo.com/quote/SPY/news/",
      "Headline 1 → https://finance.yahoo.com/news/spy-rally-123",
      "Headline 2 → https://finance.yahoo.com/news/spy-plummet-456",
      "Other site → https://example.com/news/x",
    ].join("\n");
    const out = extractNewsHeadlinesFromLinks(links, "SPY");
    expect(out).toContain("Headline 1");
    expect(out).toContain("Headline 2");
    expect(out).not.toContain("Nav");
  });

  test("scoreHeadlineSentiment returns >50 when bullish keywords dominate", () => {
    const r = scoreHeadlineSentiment(["Stock rally as analysts upgrade outlook", "Record growth continues"]);
    expect(r.score).toBeGreaterThan(50);
  });

  test("scoreHeadlineSentiment returns <50 when bearish keywords dominate", () => {
    const r = scoreHeadlineSentiment(["Shares plummet after downgrade", "Company cuts guidance warning"]);
    expect(r.score).toBeLessThan(50);
  });
});
