# Rico Multi-Agent Slack Orchestration Design

- Date: 2026-04-12
- Status: Approved for planning
- Owner: petnow
- Context: `rico` currently operates as a single Slack app. The goal is to evolve it into a multi-agent system that can coordinate product work across multiple active projects such as `mypetroutine`, `sherpalabs`, and `pet_memorial_moltdog`.

## Problem

One app with one conversational role does not scale well across multiple concurrent projects. The missing pieces are:

- project-level delegation
- role-based specialist work
- portfolio-level prioritization
- clear approval boundaries
- observable execution inside Slack without turning Slack into the actual state store

The desired system should take a development goal, split the work across product, design, engineering, QA, and customer viewpoints, run the full delivery cycle, and report progress with minimal human intervention.

## Goals

- Use a single Slack app, `rico`, as the user-facing shell.
- Support multiple active projects with a shared operating model.
- Allow project-level autonomy while keeping portfolio-level policy centralized.
- Let specialist agents work in parallel where safe.
- Show meaningful progress from parallel agents inside Slack.
- Require human approval for:
  - external customer communication
  - cost-incurring actions
  - destructive data deletion
  - deployments
- Keep Slack as the conversation UI, not the system of record.

## Non-Goals

- Separate Slack apps per role.
- Fully independent project organizations with unlimited autonomy.
- Slack threads as the only workflow state store.
- Removing the human from all high-risk decisions.
- Building the implementation plan in this document.

## Considered Approaches

### A. Central Hub

One top-level orchestrator directly controls most project work.

Why not:

- central bottleneck appears early
- weak project ownership
- poor path to later customer-facing multi-tenant expansion

### B. Project Captain Model

A central policy layer controls priorities and approvals, while each project has its own execution captain that runs a specialist squad.

Why this wins:

- strong project ownership
- controllable parallelism
- clear user interaction model
- good bridge from internal ops to future productization

### C. Independent Mini Startups

Each project behaves like a nearly independent autonomous team.

Why not yet:

- operational complexity rises too fast
- Slack noise and cost likely spike early
- approval and exception handling become too fragmented

## Chosen Architecture

The system uses a `Governor + Project Captain + Specialist Agents` model.

### Governor

The Governor is a policy and exceptions engine, not a conversational micromanager.

Responsibilities:

- portfolio priority management
- project slot allocation
- approval gating
- tool, budget, and risk policy enforcement
- cross-project conflict resolution

Non-responsibilities:

- decomposing individual implementation tasks
- reviewing detailed code or design output
- responding in every project thread
- overriding specialist judgment on discipline-specific matters

### Project Captain

Each project has one Captain. The Captain is the execution orchestrator for that project.

Responsibilities:

- turn a goal into a task graph
- assign specialist agents
- manage dependencies and sequencing
- decide what can run in parallel
- collect outputs and move the state machine forward
- produce concise thread updates and end-of-cycle reports

Non-responsibilities:

- acting as the final authority for design quality, QA, or customer value
- replacing specialist judgment with one blended opinion
- endlessly re-planning or over-decomposing work

### Specialist Agents

Initial specialist roles:

- Planner
- Designer
- Customer Voice
- Frontend Engineer
- Backend Engineer
- QA

Each specialist owns a specific judgment domain and returns structured outputs. They do not behave as always-on public Slack personas.

## User Interaction Model

The user talks to both the Governor and Captains, but in different places.

### `#ai-ops`

Primary persona: Governor

Used for:

- new goal intake
- portfolio prioritization
- pausing or resuming projects
- approval requests
- portfolio summaries
- exception handling

### Project Channels

Examples:

- `#mypetroutine`
- `#sherpalabs`
- `#pet-memorial-moltdog`

Primary persona: the project Captain

Used for:

- project-specific goal execution
- day-to-day thread updates
- specialist impact reporting
- artifact review
- project-level blocking issues

Thread contract:

- each goal creates one root Slack message
- all execution for that goal stays in that thread
- Captain owns the thread narrative
- specialists may add impact-mode messages into the same thread when warranted

Routing rule:

- start at Governor for portfolio decisions
- work with Captain for project execution
- escalate back to Governor only for policy, priorities, or approvals

## Execution Model

### Parallelism Rules

- The portfolio may have up to 2 active execution projects at once.
- Each project has exactly 1 execution lane.
- A project may run specialist analysis in parallel, but only one write-oriented implementation flow may mutate state at a time inside that project.
- Initial specialist concurrency limit per project: 4.

### Task Decomposition Limits

To avoid Captain-induced coordination loops:

- max child tasks per goal: 8
- max re-plans per goal: 2
- max automatic retries for the same failure mode: 2

## Slack Visibility Model

Slack should show proof of progress without becoming a firehose.

### Default Visibility

- Governor is visible in `#ai-ops`
- Captains are visible in project channels
- specialists work mostly in the background
- not every internal handoff becomes a public Slack message

### Specialist Impact Mode

Specialists surface only when their output materially changes the project direction, risk, or release decision.

Examples:

- `[QA Impact] Regression found in onboarding. Release blocked.`
- `[Customer Voice Impact] Current copy explains features but not user value.`
- `[BE Impact] Goal is feasible, but schema migration introduces release approval risk.`

Impact messages must answer:

- what was found
- why it matters
- what changes because of it
- whether it blocks or informs
- where the supporting artifact lives

Limits:

- no chatter-style status spam from specialists
- default max of 1 to 2 public impact messages per specialist per task
- long artifacts stay outside Slack, linked from Slack

## State Model

Slack is a UI layer only. The system of record must exist outside Slack.

Required entities:

- `Project`
- `Goal`
- `Run`
- `Task`
- `Artifact`
- `Approval`
- `StateTransition`

Initial goal/run state machine:

- `intake`
- `triaged`
- `planned`
- `in_progress`
- `awaiting_qa`
- `qa_failed`
- `awaiting_human_approval`
- `approved`
- `released`
- `archived`

Slack threads may reference these states, but may not define them.

## Approval and Guardrail Rules

### Human Approval Required

- external customer communication
- any action that incurs spend
- destructive deletion or irreversible data changes
- deployment

### Automatic Stop Conditions

- approval-required action encountered
- project slot limit exceeded
- retry limit exceeded
- QA failure
- policy violation
- security or permission conflict

### Risk Acceptance

If the human wants to proceed despite a flagged issue, the system records an explicit `risk_accepted` approval event with actor, time, target action, and rationale.

## Specialist Independence Rules

To prevent the Captain or Governor from collapsing specialist roles into one generic opinion:

- QA is an independent gate. QA may fail a release candidate and return it for rework.
- Governor may not silently override QA. Governor can only escalate to human approval.
- Customer Voice is a counterweight role, not a helper role. It may object when user value is being traded away for internal efficiency.
- Captain must preserve specialist impact signals instead of rewriting them out of existence.

## RACI-Style Decision Ownership

### Portfolio Priority

- Responsible: Governor
- Accountable: Human
- Consulted: relevant Captains
- Informed: affected project channels

### Goal Decomposition and Scheduling

- Responsible: Captain
- Accountable: Captain
- Consulted: Planner, FE, BE, Designer as needed
- Informed: Governor, project thread

### Product Scope and Requirements Shape

- Responsible: Planner
- Accountable: Captain
- Consulted: Customer Voice, Designer
- Informed: project thread

### UX and Experience Direction

- Responsible: Designer
- Accountable: Captain
- Consulted: Customer Voice
- Informed: project thread

### Implementation

- Responsible: FE and BE
- Accountable: Captain
- Consulted: Planner, Designer
- Informed: project thread

### Release Validation

- Responsible: QA
- Accountable: QA
- Consulted: FE, BE, Captain
- Informed: Governor, project thread

### Deployment / External Send / Spend / Deletion

- Responsible: Captain prepares request
- Accountable: Human
- Consulted: Governor, QA, relevant specialists
- Informed: project thread, `#ai-ops`

## Operational Anti-Patterns to Avoid

- Governor reading and commenting in every project thread
- Captain rewriting every specialist conclusion in its own voice
- QA being subordinated under Governor or Captain release desire
- unlimited task splitting or re-planning loops
- Slack threads treated as the only durable state store

## Initial Delivery Scope

Version 1 should prove this operating model, not solve everything.

V1 should include:

- one Slack app identity
- Governor surface in `#ai-ops`
- one Captain per project channel
- structured specialist invocation behind the Captain
- external state store for project/run/task/approval history
- human approval gating for the four protected action classes
- impact-mode specialist reporting
- concurrency enforcement for 2 active projects max

V1 does not need:

- separate bot identities per role
- unrestricted project autonomy
- arbitrary parallel write execution inside one project
- a fully customer-facing product shell

## Open Questions

These do not block planning, but will matter during implementation planning:

- what storage backend should hold workflow state and artifacts
- how approvals should be represented in Slack UX
- how Captain-to-specialist invocation is implemented under the `rico` runtime
- what the minimal artifact schema should be for specialist outputs

## Planning Readiness

This spec is ready for implementation planning because it fixes:

- the operating model
- the user interaction model
- the role boundaries
- the approval boundaries
- the visibility rules
- the initial scope limits

It intentionally leaves implementation details, stack choices, and storage mechanics for the planning phase.
