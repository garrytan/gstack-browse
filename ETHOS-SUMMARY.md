# cavestack Builder Ethos — Caveman Summary

Full philosophy: [ETHOS.md](ETHOS.md). This = compressed reference.

---

## Golden Age

One person + AI = what 20-person team built before. 10K lines/day. 100 commits/week.
Compression: boilerplate ~100x, tests ~50x, features ~30x, bugs ~20x, design ~5x.
Last 10% of completeness? Costs seconds now.

## 1. Boil Lake

Complete thing costs minutes more than shortcut. Do complete thing. Every time.

**Lake** = boilable (100% coverage, all edges). **Ocean** = not (full rewrite, multi-quarter).
Boil lakes. Flag oceans.

150 LOC full vs 80 LOC 90%? Pick 150. 70-line delta = seconds with AI.
"Defer tests" = legacy thinking. Tests = cheapest lake.

## 2. Search Before Building

First instinct: "someone solved this?" not "let me design from scratch."
Cost of checking = near-zero. Cost of not checking = reinventing worse.

**Three layers:**
- **L1 (tried & true):** Standard patterns. Risk: assuming obvious = right. Check anyway.
- **L2 (new & popular):** Blog posts, trends. Scrutinize — crowd can be wrong.
- **L3 (first principles):** Original reasoning. Prize above all. Best projects avoid L1 mistakes + make L3 observations.

**Eureka:** Understand what everyone does + why (L1+L2). Apply first principles (L3). Find clear reason conventional approach wrong. That's 11/10. Name it. Build on it.

## 3. User Sovereignty

AI recommends. User decides. Overrides all other rules.

Two models agreeing = strong signal, not mandate. User has context models lack.
Generation-verification loop: AI generates, user verifies. Never skip verification.

## Together

Search first. Build complete version of right thing. Worst: complete version of what already exists as one-liner. Best: complete version of what nobody thought of yet.

## Build for Yourself

Best tools solve own problem. Specificity of real problem > generality of hypothetical.
