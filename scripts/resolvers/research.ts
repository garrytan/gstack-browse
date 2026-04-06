import type { TemplateContext } from './types';

export function generateResearchConventions(_ctx: TemplateContext): string {
  return `## Read Project Conventions

Before generating any code, read the project's CLAUDE.md and look for a \`## Research conventions\` section.

\`\`\`bash
grep -A 50 "## Research conventions" CLAUDE.md 2>/dev/null || echo "NO_CONVENTIONS"
\`\`\`

If \`NO_CONVENTIONS\` is printed, the project has no research conventions configured yet.
Use AskUserQuestion to ask the researcher to define their conventions:

> This project doesn't have research conventions configured yet.
> I need to know your project's coding conventions to generate code that
> matches your style. I'll ask a few questions and save them to CLAUDE.md.

Questions to ask (via AskUserQuestion):
1. **Language:** What language do you use? (Python, Julia, MATLAB, etc.)
2. **Import style:** Any specific import conventions? (e.g., "import numpy as np")
3. **Naming:** How do you name experiment files and result directories?
4. **Compute backend:** Where do you run experiments? (local, SLURM, cloud)
5. **Baseline location:** Where are baseline results stored?
6. **Test command:** How do you run tests?

After gathering answers, write a \`## Research conventions\` section to CLAUDE.md with the
answers formatted as key-value pairs. Example:

\`\`\`markdown
## Research conventions

### Language
python 3.11+

### Imports
- Always use \`import stim\` not \`from stim import *\`
- Use \`pathlib.Path\` not \`os.path\`
- Numpy as \`np\`, matplotlib.pyplot as \`plt\`

### Naming
- Experiment files: \`run_<slug>.py\`
- Result directories: \`results/<slug>/<YYYYMMDD-HHMMSS>/\`

### Compute backend
local

### Baseline location
research/baselines/

### Test command
pytest tests/ -x
\`\`\`

If conventions ARE found, parse them and use them to guide all code generation.
Every generated file must follow these conventions exactly. Convention compliance
is more important than code elegance.`;
}

export function generateProvenanceSpec(_ctx: TemplateContext): string {
  return `## Provenance Bundle

Every experiment run MUST produce a \`provenance.json\` file alongside results.
This is non-negotiable. The provenance bundle captures everything needed to
reproduce the exact run.

**Required fields:**

\`\`\`json
{
  "git_sha": "string — output of git rev-parse HEAD",
  "git_dirty": "boolean — true if working tree has uncommitted changes",
  "branch": "string — current git branch name",
  "timestamp": "string — ISO 8601 UTC timestamp of run start",
  "wall_clock_seconds": "number — total execution time",
  "packages": "object — {package_name: version} for all research dependencies",
  "random_seeds": "array — all random seeds used in the experiment",
  "python_version": "string — or julia_version, matlab_version as appropriate",
  "platform": "string — e.g. darwin-arm64, linux-x86_64",
  "experiment_spec": "string — relative path to the spec.yaml file",
  "parameters": "object — the exact parameter grid used in this run",
  "baseline_ref": {
    "path": "string — relative path to baseline metrics file (if applicable)",
    "git_sha": "string — git SHA when baseline was last updated"
  }
}
\`\`\`

**How to generate the provenance bundle:**

\`\`\`python
import json, subprocess, sys, platform, time
from datetime import datetime, timezone
from pathlib import Path

def capture_provenance(spec_path, parameters, seeds, packages):
    prov = {
        "git_sha": subprocess.check_output(["git", "rev-parse", "HEAD"]).decode().strip(),
        "git_dirty": bool(subprocess.check_output(["git", "status", "--porcelain"]).decode().strip()),
        "branch": subprocess.check_output(["git", "branch", "--show-current"]).decode().strip(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "wall_clock_seconds": None,  # filled after run
        "packages": packages,
        "random_seeds": seeds,
        "python_version": sys.version.split()[0],
        "platform": f"{sys.platform}-{platform.machine()}",
        "experiment_spec": str(spec_path),
        "parameters": parameters,
    }
    return prov
\`\`\`

The provenance generation code should be included in every generated experiment
script. After the experiment completes, fill in \`wall_clock_seconds\` and write
\`provenance.json\` to the results directory.`;
}

export function generateExperimentStructure(_ctx: TemplateContext): string {
  return `## Research File Structure

All research artifacts follow this directory convention:

\`\`\`
research/
  hypotheses/<slug>.md              # Structured hypothesis document
  experiments/<slug>/
    spec.yaml                       # Parameter grid, baselines, conventions
    run_<slug>.py                   # Generated experiment code
  results/<slug>/<timestamp>/
    metrics.json                    # Raw experiment results
    provenance.json                 # Reproducibility bundle (see Provenance spec)
    plots/                          # Generated visualizations
  baselines/<slug>/
    metrics.json                    # Baseline results for comparison
  reports/<slug>.md                 # Final analysis report
\`\`\`

**Slug convention:** lowercase, hyphens for spaces, no underscores in slugs.
Example: \`threshold-scaling\`, \`decoder-comparison\`, \`noise-model-validation\`.

**Timestamp convention:** \`YYYYMMDD-HHMMSS\` (e.g., \`20260406-231603\`).

**Before creating any files:** Check if \`research/\` exists. If not, create the
full directory structure:

\`\`\`bash
mkdir -p research/{hypotheses,experiments,results,baselines,reports}
\`\`\`

**When referencing paths:** Always use relative paths from the project root.
Never hardcode absolute paths in generated code or spec files.`;
}
