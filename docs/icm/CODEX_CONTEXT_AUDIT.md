# Codex ICM Context Audit

Generated: 2026-09-06T18:56:51.892288+00:00

This compares the generated Codex SKILL.md payload on fork main with the ICM progressive-section branch. Approximate tokens use 4 bytes per token. Section files are excluded from initial context because the ICM branch loads them only when their phase fires.

## Corpus result

- Baseline initial SKILL.md bytes: 2,819,935 (~704,984 tokens)
- ICM initial SKILL.md bytes: 2,295,716 (~573,929 tokens)
- Removed from eager Codex context: 524,219 bytes (~131,055 tokens, 18.6%)

## Biggest savings from progressive loading

| Skill | Baseline tokens | ICM tokens | Tokens deferred | Saving | Sections |
| --- | ---: | ---: | ---: | ---: | ---: |
| gstack-ship | 43,185 | 19,746 | 23,439 | 54.3% | 9 |
| gstack-plan-ceo-review | 32,115 | 18,747 | 13,368 | 41.6% | 1 |
| gstack-office-hours | 28,704 | 16,560 | 12,144 | 42.3% | 3 |
| gstack-plan-eng-review | 25,671 | 13,645 | 12,026 | 46.8% | 1 |
| gstack-land-and-deploy | 25,090 | 15,801 | 9,290 | 37.0% | 3 |
| gstack-plan-design-review | 26,316 | 17,099 | 9,217 | 35.0% | 1 |
| gstack-plan-devex-review | 25,617 | 16,561 | 9,056 | 35.4% | 1 |
| gstack-autoplan | 22,723 | 16,460 | 6,262 | 27.6% | 5 |
| gstack-design-consultation | 17,358 | 12,304 | 5,054 | 29.1% | 1 |
| gstack-qa | 17,992 | 12,986 | 5,005 | 27.8% | 2 |
| gstack-setup-gbrain | 19,902 | 15,292 | 4,610 | 23.2% | 4 |
| gstack-document-release | 14,658 | 10,482 | 4,176 | 28.5% | 1 |
| gstack-spec | 18,320 | 14,378 | 3,942 | 21.5% | 1 |
| gstack-cso | 18,023 | 14,644 | 3,380 | 18.8% | 1 |
| gstack-browse | 10,448 | 7,170 | 3,278 | 31.4% | 1 |
| gstack-review | 17,551 | 14,672 | 2,879 | 16.4% | 3 |
| gstack-design-html | 15,354 | 13,361 | 1,993 | 13.0% | 2 |
| gstack-retro | 19,027 | 18,015 | 1,012 | 5.3% | 1 |
| gstack-design-shotgun | 14,252 | 13,326 | 926 | 6.5% | 1 |

## Largest remaining initial Codex skills

| Skill | ICM tokens | ICM bytes | Sections |
| --- | ---: | ---: | ---: |
| gstack-design-review | 22,422 | 89,687 | 0 |
| gstack-ship | 19,746 | 78,983 | 9 |
| gstack-plan-ceo-review | 18,747 | 74,989 | 1 |
| gstack-retro | 18,015 | 72,060 | 1 |
| gstack-plan-design-review | 17,099 | 68,395 | 1 |
| gstack-plan-devex-review | 16,561 | 66,243 | 1 |
| gstack-office-hours | 16,560 | 66,239 | 3 |
| gstack-autoplan | 16,460 | 65,841 | 5 |
| gstack-land-and-deploy | 15,801 | 63,203 | 3 |
| gstack-devex-review | 15,454 | 61,815 | 0 |
| gstack-setup-gbrain | 15,292 | 61,168 | 4 |
| gstack-review | 14,672 | 58,687 | 3 |
| gstack-cso | 14,644 | 58,574 | 1 |
| gstack-spec | 14,378 | 57,512 | 1 |
| gstack-plan-tune | 14,336 | 57,345 | 0 |
| gstack-sync-gbrain | 13,662 | 54,648 | 0 |
| gstack-plan-eng-review | 13,645 | 54,581 | 1 |
| gstack-design-html | 13,361 | 53,443 | 2 |
| gstack-design-shotgun | 13,326 | 53,306 | 1 |
| gstack-qa | 12,986 | 51,945 | 2 |
| gstack-qa-only | 12,716 | 50,865 | 0 |
| gstack-design-consultation | 12,304 | 49,217 | 1 |
| gstack-document-generate | 12,095 | 48,381 | 0 |
| gstack-skillify | 11,972 | 47,889 | 0 |
| gstack-pair-agent | 11,418 | 45,672 | 0 |
| gstack-ios-qa | 11,208 | 44,830 | 0 |
| gstack-claude | 10,954 | 43,817 | 0 |
| gstack-setup-deploy | 10,786 | 43,144 | 0 |
| gstack-investigate | 10,761 | 43,044 | 0 |
| gstack-health | 10,638 | 42,553 | 0 |

## Full comparison

| Skill | Baseline tokens | ICM tokens | Deferred | Saving | Sections |
| --- | ---: | ---: | ---: | ---: | ---: |
| gstack | 3,740 | 3,740 | 0 | 0.0% | 0 |
| gstack-autoplan | 22,723 | 16,460 | 6,262 | 27.6% | 5 |
| gstack-benchmark | 5,048 | 5,048 | 0 | 0.0% | 0 |
| gstack-benchmark-models | 3,998 | 3,998 | 0 | 0.0% | 0 |
| gstack-browse | 10,448 | 7,170 | 3,278 | 31.4% | 1 |
| gstack-canary | 10,506 | 10,506 | 0 | 0.0% | 0 |
| gstack-careful | 881 | 881 | 0 | 0.0% | 0 |
| gstack-claude | 10,954 | 10,954 | 0 | 0.0% | 0 |
| gstack-context-restore | 9,488 | 9,488 | 0 | 0.0% | 0 |
| gstack-context-save | 10,077 | 10,077 | 0 | 0.0% | 0 |
| gstack-cso | 18,023 | 14,644 | 3,380 | 18.8% | 1 |
| gstack-design-consultation | 17,358 | 12,304 | 5,054 | 29.1% | 1 |
| gstack-design-html | 15,354 | 13,361 | 1,993 | 13.0% | 2 |
| gstack-design-review | 22,422 | 22,422 | 0 | 0.0% | 0 |
| gstack-design-shotgun | 14,252 | 13,326 | 926 | 6.5% | 1 |
| gstack-devex-review | 15,454 | 15,454 | 0 | 0.0% | 0 |
| gstack-diagram | 4,007 | 4,007 | 0 | 0.0% | 0 |
| gstack-document-generate | 12,095 | 12,095 | 0 | 0.0% | 0 |
| gstack-document-release | 14,658 | 10,482 | 4,176 | 28.5% | 1 |
| gstack-freeze | 897 | 897 | 0 | 0.0% | 0 |
| gstack-guard | 783 | 783 | 0 | 0.0% | 0 |
| gstack-health | 10,638 | 10,638 | 0 | 0.0% | 0 |
| gstack-investigate | 10,761 | 10,761 | 0 | 0.0% | 0 |
| gstack-ios-clean | 8,639 | 8,639 | 0 | 0.0% | 0 |
| gstack-ios-design-review | 8,818 | 8,818 | 0 | 0.0% | 0 |
| gstack-ios-fix | 8,598 | 8,598 | 0 | 0.0% | 0 |
| gstack-ios-qa | 11,208 | 11,208 | 0 | 0.0% | 0 |
| gstack-ios-sync | 8,750 | 8,750 | 0 | 0.0% | 0 |
| gstack-land-and-deploy | 25,090 | 15,801 | 9,290 | 37.0% | 3 |
| gstack-landing-report | 9,416 | 9,416 | 0 | 0.0% | 0 |
| gstack-learn | 9,067 | 9,067 | 0 | 0.0% | 0 |
| gstack-make-pdf | 5,084 | 5,084 | 0 | 0.0% | 0 |
| gstack-office-hours | 28,704 | 16,560 | 12,144 | 42.3% | 3 |
| gstack-open-gstack-browser | 4,656 | 4,656 | 0 | 0.0% | 0 |
| gstack-pair-agent | 11,418 | 11,418 | 0 | 0.0% | 0 |
| gstack-plan-ceo-review | 32,115 | 18,747 | 13,368 | 41.6% | 1 |
| gstack-plan-design-review | 26,316 | 17,099 | 9,217 | 35.0% | 1 |
| gstack-plan-devex-review | 25,617 | 16,561 | 9,056 | 35.4% | 1 |
| gstack-plan-eng-review | 25,671 | 13,645 | 12,026 | 46.8% | 1 |
| gstack-plan-tune | 14,336 | 14,336 | 0 | 0.0% | 0 |
| gstack-qa | 17,992 | 12,986 | 5,005 | 27.8% | 2 |
| gstack-qa-only | 12,716 | 12,716 | 0 | 0.0% | 0 |
| gstack-retro | 19,027 | 18,015 | 1,012 | 5.3% | 1 |
| gstack-review | 17,551 | 14,672 | 2,879 | 16.4% | 3 |
| gstack-scrape | 4,108 | 4,108 | 0 | 0.0% | 0 |
| gstack-setup-browser-cookies | 3,393 | 3,393 | 0 | 0.0% | 0 |
| gstack-setup-deploy | 10,786 | 10,786 | 0 | 0.0% | 0 |
| gstack-setup-gbrain | 19,902 | 15,292 | 4,610 | 23.2% | 4 |
| gstack-ship | 43,185 | 19,746 | 23,439 | 54.3% | 9 |
| gstack-skillify | 11,972 | 11,972 | 0 | 0.0% | 0 |
| gstack-spec | 18,320 | 14,378 | 3,942 | 21.5% | 1 |
| gstack-sync-gbrain | 13,662 | 13,662 | 0 | 0.0% | 0 |
| gstack-unfreeze | 334 | 334 | 0 | 0.0% | 0 |
| gstack-upgrade | 3,965 | 3,965 | 0 | 0.0% | 0 |

## Wave 2 selection rule

Prioritize large remaining eager skills where content is branch-exclusive, late-phase, optional, or reference material. Keep safety gates, dispatch rules, destructive-action checks, scope gates, and decision rules in the always-loaded skeleton.

