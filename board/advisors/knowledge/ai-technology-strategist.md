# AI & Technology Strategist — Knowledge Base

## Frameworks

### 25 Tactics for Accelerating AI Adoption (Peter Yang + Lenny Rachitsky)
Five recurring patterns across companies succeeding at AI adoption:

**1. Explain the How (not just the why)**
- Generic mandates ("use AI more") fail. Specific tactics work.
- Shopify's CEO memo approach: not just "use AI" but specific tactics for each function, tied to performance reviews
- Create playbooks for specific use cases: "Here's how to use AI for code review," "Here's how to use AI for customer research"

**2. Track & Reward Adoption**
- Ramp publishes AI usage metrics by team — creates visibility and social pressure
- Make AI usage part of performance conversations, not just side projects
- Celebrate early wins publicly to create momentum

**3. Cut Red Tape**
- Zapier has a dedicated PM for AI tool approvals — turns around requests in days, not months
- Remove procurement barriers for AI tools under a reasonable threshold
- Pre-approve a set of AI tools for common use cases

**4. Turn Enthusiasts into Teachers**
- Identify the 10-15% of natural AI adopters in your org
- Give them time and recognition to teach others
- Peer learning is 5-10x more effective than top-down training

**5. Prioritize High-Impact Tasks**
- Focus AI adoption on tasks with clear, measurable time savings
- Duolingo: $300 learning budget per employee specifically for AI skills
- Intercom: 2x productivity goal embedded into team planning

### AI Product Mental Models (Aishwarya Naresh Reganti & Kiriti Badam)
Three ways AI products differ from traditional products:

**Non-determinism:**
- AI outputs are probabilistic — the same input can produce different outputs
- This breaks traditional QA and testing approaches
- Requires thinking in terms of accuracy distributions, not pass/fail
- Users need to be educated that outputs need review

**Agency/Control Trade-off:**
- How much decision-making do you delegate to the AI?
- Too much agency = scary, unreliable, potential for harm
- Too little agency = just a fancy autocomplete, not worth the AI label
- The right balance depends on the stakes (medical diagnosis vs. email drafting)
- Start with high human control, gradually increase AI agency as trust builds

**Feedback Flywheels:**
- AI products MUST get better with use — if they don't, they're not leveraging the AI advantage
- Design data collection into the product from day one
- User corrections are gold — every "this was wrong" is training data
- First-mover advantage matters less than having the best flywheel

### Context Engineering (Alexander Embiricos, Codex/OpenAI)
- The quality of AI output depends more on the context provided than on prompt tricks
- **Context = all the information the AI system needs to produce a good output**: user data, prior interactions, relevant documents, constraints, examples
- Better context engineering strategies:
  - Retrieve relevant context dynamically (RAG patterns)
  - Provide structured examples of desired output
  - Include constraints and failure modes explicitly
  - Reduce context noise — more isn't always better
- Parallelizing workflows: break complex tasks into independent subtasks, run them concurrently, synthesize results

### AI Prototyping Tools Taxonomy (Colin Matthews)
Matched to complexity and use case:

**Chatbots (Claude, ChatGPT):**
- Best for: Simple one-page prototypes, exploring ideas, generating code snippets
- Limitation: No persistent state, limited multi-file coordination

**Cloud Dev Environments (v0, Bolt, Replit, Lovable):**
- Best for: Multi-page apps, complex features, rapid prototyping with real backends
- Limitation: Less control, may not match production architecture

**Local Assistants (Cursor, GitHub Copilot):**
- Best for: Production-ready code, integration with existing codebases, developer-controlled quality
- Limitation: Requires more developer skill, slower iteration

**Success Techniques:**
- Reflection: Plan before coding (have AI explain approach before writing code)
- Batching: Start with the smallest possible iteration
- Specificity: Detailed prompts produce dramatically better results
- Context management: Avoid lost context by keeping interactions focused

### DORA Metrics (Nicole Forsgren)
Four key metrics for engineering team effectiveness:
1. **Deployment Frequency** — How often the team ships to production
2. **Lead Time for Changes** — Time from code commit to production deployment
3. **Change Failure Rate** — Percentage of deployments that cause failures
4. **Time to Restore Service** — Time to recover from a production failure

- Elite teams: deploy multiple times per day, lead time < 1 hour, change failure rate < 15%, restore < 1 hour
- Key insight: Speed and stability are NOT trade-offs. The best teams are both faster AND more stable.
- DORA metrics are better predictors of organizational performance than lines of code, story points, or velocity

### Developer Experience as Product (Guillermo Rauch, Vercel)
- For developer tools and platforms, the developer's experience IS the product
- Principles: documentation is UX, error messages are product copy, getting started should take < 5 minutes
- The best developer platforms feel like they're removing constraints, not adding capabilities

## Key Data Points & Benchmarks
- 90% of AI demos don't reflect production performance — always ask for production accuracy metrics
- Peer learning is 5-10x more effective than top-down AI training
- Elite engineering teams (DORA): deploy multiple times/day, <1 hour lead time, <15% failure rate
- Speed and stability are NOT trade-offs — the best teams are both faster and more stable
- First-mover advantage in AI matters less than feedback flywheel quality
- 10-15% of any org are natural AI adopters — find and leverage them

## Expert Quotes & Positions
- **Peter Yang + Lenny**: "The biggest barrier to AI adoption isn't technology; it's organizational change."
- **Aishwarya Naresh Reganti**: "AI products require fundamentally different mental models than traditional products."
- **Alexander Embiricos**: "Context engineering matters more than prompt engineering."
- **Nicole Forsgren**: "Speed and stability are not trade-offs. The best teams have both."
- **Guillermo Rauch**: "Developer experience is product experience."
- **Archive contrarian take**: "Instead of flashy demos, demand rigorous data and evaluations."

## Contrarian Takes
- **AI adoption is a people problem, not a technology problem**: Most companies that fail at AI fail because of culture, process, and change management — not because the technology isn't ready.
- **Most AI features should start as human-in-the-loop**: Full automation is the end state, not the starting point. Build trust through assisted workflows before automating entirely.
- **The AI tool doesn't matter — the workflow does**: Teams argue about Claude vs. GPT vs. Gemini when the actual bottleneck is that no one has redesigned the workflow to take advantage of AI at all.
- **AI makes good engineers better, not bad engineers good**: AI coding tools amplify existing skill. A junior developer with Copilot produces more bugs faster. A senior developer with Copilot produces better code faster.
- **Build evaluation before building features**: If you can't measure whether the AI is working, don't ship it. Evaluation frameworks first, features second.

## Decision Frameworks
- **When to use AI vs. traditional software**: AI when the task is fuzzy, variable, or requires judgment. Traditional software when the rules are clear and deterministic. Don't use AI for things a simple if/else can handle.
- **When to build vs. buy AI capabilities**: Build when it's your core differentiator and you have proprietary data. Buy when it's infrastructure or commodity capability.
- **When to increase AI agency**: When accuracy is proven, failure consequences are low, users have expressed desire, and a graceful fallback exists.
- **When to invest in AI adoption**: When you have 2+ tools purchased but <30% adoption. Adding more tools won't help — drive adoption of what you have.
- **How to evaluate AI vendors**: Ask for production accuracy metrics (not demo accuracy), failure modes and fallback behavior, data privacy practices, and total cost of ownership (including integration time).
