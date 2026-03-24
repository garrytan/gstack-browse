# Advisors

Each file in this directory defines one advisor on your Personal Board of Advisors.

## Schema

Advisor files use markdown with YAML frontmatter:

```yaml
---
role: "Role Title"          # How the moderator addresses this advisor
domain: [area1, area2]      # Topics this advisor covers (used for selection)
perspective: "One sentence"  # The core lens this advisor sees the world through
---
```

## Required Sections

| Section | Purpose |
|---------|---------|
| **Expertise** | What this advisor knows deeply (3-5 bullets) |
| **Mental Models** | Frameworks and beliefs they reach for |
| **Known Biases** | Blind spots the moderator can challenge |
| **Communication Style** | How they talk — data-driven, narrative, blunt, etc. |
| **Perspective Triggers** | When the moderator should call on them |
| **Example Positions** | Sample stances to calibrate voice and viewpoint |

## Design Principles

**Be specific, not generic.** "Experienced in product management" is useless. "Believes activation rate is the single most important metric for PLG companies and will argue this point aggressively" gives the advisor a real voice.

**Define real biases.** Every expert has blind spots. A growth leader over-indexes on metrics. A finance executive may undervalue long-term brand investment. These biases create productive tension in debates.

**Make them disagreeable.** Advisors who agree on everything are worthless. Design advisors whose mental models genuinely conflict. A move-fast product leader and a risk-conscious finance executive will naturally clash — that's the point.

**Keep domains complementary but overlapping.** Some overlap creates debate. Complete overlap creates redundancy. No overlap means advisors talk past each other.

## Knowledge Base Files

Each advisor has a companion knowledge file in `knowledge/{advisor-name}.md`. The persona file defines **who they are and how they think**; the knowledge file is **what they know**.

Knowledge files contain:

| Section | Purpose |
|---------|---------|
| **Frameworks in detail** | Full descriptions of each framework the advisor uses (not just names) |
| **Key data points & benchmarks** | Specific numbers, thresholds, and benchmarks they reference |
| **Case studies & examples** | Real company examples that ground their perspective |
| **Expert quotes & positions** | Attributed perspectives that define their worldview |
| **Contrarian takes** | Non-obvious positions this advisor would defend |
| **Decision frameworks** | When-to-use-what guidance for common decisions |

When creating a new advisor, create both files:
- `advisors/{name}.md` — the persona
- `advisors/knowledge/{name}.md` — the knowledge base

## Creating a New Advisor

1. Copy `templates/advisor-template.md` for the persona file
2. Create a corresponding `knowledge/{name}.md` file
3. Fill in every section in both files — don't leave blanks
4. Ensure the knowledge file contains **specific, detailed** frameworks (not just names or summaries)
5. Test by asking yourself: "If I gave this advisor a question about [topic], would their response be predictably different from every other advisor?"
6. If the answer is no, sharpen their perspective
