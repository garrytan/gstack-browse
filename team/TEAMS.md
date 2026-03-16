# gstack Agent Team Reference

This document defines how gstack skills coordinate as Claude Code Agent Teams.
Every teammate should read this to understand the communication protocol.

## Skill Roster (23 skills)

### Engineering Skills (modify code or produce technical artifacts)
| Skill | Persona | Standalone | As Teammate |
|-------|---------|------------|-------------|
| `/plan-ceo-review` | Founder/CEO | Review plan interactively | Message findings to architect |
| `/plan-eng-review` | Eng Manager | Review plan, produce test plan | Write test plan, message reviewer |
| `/review` | Staff Engineer | PR review against main | Share findings with security, risk |
| `/ship` | Release Engineer | Automated shipping | Wait for review+security approval |
| `/qa` | QA Engineer | Test with browse | Report bugs to shipper/lead |
| `/qa-only` | QA Reporter | Test, never fix | Report-only, message findings |
| `/browse` | Browser Agent | Headless Chromium | Shared browser for QA teammates |
| `/setup-browser-cookies` | Session Manager | Import cookies | Setup for QA teammates |
| `/retro` | Eng Manager | Weekly retrospective | Analyze team-wide patterns |
| `/conflicts` | Tech Lead | PR conflict detection | Alert reviewer of conflicts |

### Analysis Skills (read-only, produce reports)
| Skill | Persona | Standalone | As Teammate |
|-------|---------|------------|-------------|
| `/risk` | Chief Risk Officer | Risk register | Incorporate CSO findings, message board |
| `/cso` | Chief Security Officer | Security audit | Message findings to risk, reviewer |
| `/cfo` | CFO | Cost analysis | Share costs with VC, board |
| `/vc` | VC Partner | Due diligence | Share moat data with CFO, board |
| `/board` | Board Member | Executive brief | Wait for all analysts, synthesize |
| `/media` | Tech Journalist | Story mining | Coordinate messaging with PR, comms |
| `/comms` | Comms Specialist | Internal comms | Align messaging with PR, media |
| `/pr-comms` | VP of PR | External comms | Final say on external messaging |
| `/ai-hybrid` | AI Architect | AI workflow audit | Measure team effectiveness |
| `/escalation` | Escalation Manager | Incident response | IC role, coordinates all teammates |

### Meta Skills
| Skill | Purpose |
|-------|---------|
| `/team` | Spawn and orchestrate agent teams |
| `/gstack-upgrade` | Auto-upgrade gstack |

## Communication Protocol

### Message Format (teammate → teammate)

When messaging another teammate, use this structure:
```
FROM: [your skill name]
STATUS: [complete | in-progress | blocked | urgent]
TOP FINDINGS:
1. [severity] — [one-line finding]
2. [severity] — [one-line finding]
3. [severity] — [one-line finding]
FULL REPORT: .gstack/[report-dir]/[date].md
ACTION NEEDED: [what you need from the recipient, if anything]
```

### Message Format (teammate → lead)

When reporting to the lead:
```
SKILL: [your skill name]
STATUS: [complete | blocked]
FINDINGS: [N] total ([X] critical, [Y] high, [Z] medium)
TOP 3:
1. [finding]
2. [finding]
3. [finding]
REPORT SAVED: .gstack/[path]
BLOCKED BY: [teammate name, if blocked] or NONE
```

### Urgency Protocol

- **BROADCAST immediately** if you find: security breach, data exposure, production-breaking bug
- **Message specific teammate** if your finding affects their analysis
- **Message lead only** for status updates and completion reports

## Dependency Graph

```
                    ┌──────────────┐
                    │ /plan-ceo    │
                    │ (vision)     │
                    └──────┬───────┘
                           │ scope decision
                           ▼
                    ┌──────────────┐
                    │ /plan-eng    │
                    │ (architect)  │
                    └──────┬───────┘
                           │ test plan + architecture
                    ┌──────┴───────┐
                    ▼              ▼
             ┌────────────┐ ┌────────────┐
             │  /review   │ │   /cso     │
             │ (engineer) │ │ (security) │
             └─────┬──────┘ └─────┬──────┘
                   │   share      │
                   │◄────────────►│
                   │   findings   │
                   └──────┬───────┘
                          │ approval
                          ▼
                   ┌────────────┐
                   │   /ship    │──────────► ┌────────────┐
                   │ (release)  │            │   /qa      │
                   └────────────┘            │  (tester)  │
                                             └────────────┘

     ┌─────────┐ ┌─────────┐ ┌─────────┐
     │  /vc    │ │  /cfo   │ │  /cso   │
     │(invest) │ │(finance)│ │(security│
     └────┬────┘ └────┬────┘ └────┬────┘
          │           │           │
          │     ┌─────┴───────────┘
          │     │     findings
          │     ▼
          │ ┌─────────┐
          │ │  /risk  │
          │ │ (CRO)   │
          │ └────┬────┘
          │      │
          └──┬───┘
             │ all findings
             ▼
         ┌─────────┐
         │ /board  │
         │ (exec)  │
         └─────────┘

     ┌─────────┐ ┌─────────┐ ┌─────────┐
     │ /media  │◄──────────►│/pr-comms │◄──────────►│ /comms  │
     │(stories)│  messaging │  (PR)    │  alignment │(internal│
     └─────────┘ consistency└─────────┘             └─────────┘

     ┌──────────────┐
     │ /escalation  │ (Incident Commander — coordinates all)
     │              │◄── /cso (security assessment)
     │              │◄── /comms (drafts communications)
     └──────────────┘
```

## Shared State Locations

All teammates read/write to these shared directories:

```
.gstack/
├── team-reports/          ← Synthesized team outputs (lead writes)
├── conflict-reports/      ← /conflicts output
├── risk-reports/          ← /risk output (consumed by /board)
├── security-reports/      ← /cso output (consumed by /risk, /review)
├── cfo-reports/           ← /cfo output (consumed by /vc, /board)
├── vc-reports/            ← /vc output (consumed by /board)
├── board-reports/         ← /board output
├── escalation-reports/    ← /escalation output
├── qa-reports/            ← /qa output (consumed by /ship)
├── media-kit/             ← /media output (consumed by /pr-comms)
├── comms/                 ← /comms output
├── pr-comms/              ← /pr-comms output
├── ai-hybrid/             ← /ai-hybrid output
└── browse.json            ← Shared browser daemon state

~/.gstack/
├── projects/{slug}/       ← Test plans (/plan-eng → /qa handoff)
├── greptile-history.md    ← Review outcomes (read by /retro)
└── teams/*/config.json    ← Active team configuration
```

## Anti-Patterns

- **Don't edit the same file as another teammate.** Coordinate via messaging first.
- **Don't broadcast everything.** Only broadcast for critical/urgent findings.
- **Don't skip the lead.** The lead synthesizes — send your summary to the lead, not just to other teammates.
- **Don't wait forever.** If a dependency teammate hasn't responded in a reasonable time, proceed with what you have and note the gap.
- **Don't duplicate work.** Check `.gstack/` for existing reports before running your analysis.
