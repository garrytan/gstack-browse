# Workflow memory with Memorable (optional, third party)

The third time you ask Claude Code to do the same shape of work, it starts
from nothing again. It re-reads the same files, re-runs the same searches, and
arrives at the fix it already wrote last month. **Memorable** is a third-party
CLI that records how a task was done and hands that back the next time you ask
for something close to it.

gstack does not install it, bundle it, or depend on it. This is a bridge: two
commands that wire Memorable's `UserPromptSubmit` hook into gstack's own hook
manager, so the entry is registered, listed and removed the same way every
other gstack hook is. It is off until you turn it on, and Claude Code is the
only host it works with.

## What you get

- The prompt hook asks Memorable, before each turn, whether a past session
  already solved something close to this, and injects that procedure if so.
- Registration through `gstack-settings-hook`, so `list-sources`,
  `prune-stale` and `rollback` all see it.
- An off switch that removes gstack's entry and nothing else.
- No daemon, no dependency, and nothing at all if the binary is absent.

## What this is not

- Not deterministic replay. It is recalled guidance the model may ignore.
- Not related to Aside or to browser automation.
- Not a gstack feature with gstack's guarantees. Everything past the process
  boundary belongs to a closed-source npm package from another vendor.

## Exactly what leaves your machine

The hook makes no network call of its own. Every row below is the Memorable
CLI acting under its own consent, which is why **`gstack-egress` will not show
any of it**: gstack issues no request here, so there is no receipt to write.

| Command | What leaves the machine |
|---|---|
| `command -v memorable`, `gstack-memorable status` | Nothing. Both are local reads. |
| `gstack-memorable enable` | Nothing from gstack. It runs `memorable enable`, which records consent on your machine. |
| the hook, on every prompt | The prompt text you typed, to Memorable's embed endpoint, when the local lexical match misses. Nothing else at prompt time. |
| capture, at session end | Memorable's own hook, not this bridge. It sends the finished session's tool calls and their arguments to Memorable's extraction API under `memorable enable`. |

Two things follow from that table and are worth saying out loud. The hook sees
**every** Claude Code prompt, not only the ones that came from a gstack skill.
And capture is a separate consent from this bridge: turning the bridge off does
not turn capture off. `memorable disable` does.

## What gstack pin-tests, and what is Memorable's claim

gstack tests the gating and the wiring, in `test/gstack-memorable.test.ts`:

- `enable` refuses when Memorable already registered the hook itself, and
  touches neither consent nor the settings file when it refuses.
- `disable` removes only gstack's entry and never a foreign one.
- The hook exits zero and silent when the binary is missing.
- `status` writes nothing.

Everything else is Memorable's claim and not ours: what it stores, where it
stores it, what it sends, and what `memorable disable` and `memorable forget`
actually erase.

## Turning it on (three steps, the middle one is yours)

```bash
npm i -g memorable-cli   # the CLI, from npm, not from gstack
memorable login          # opens a browser; only you can do this
bin/gstack-memorable enable
```

`enable` runs `memorable enable` to record capture consent, then registers the
hook. Check it with:

```bash
bin/gstack-memorable status
```

## If Memorable already registered the hook

`memorable start`, `memorable setup` and `memorable install-hooks` each
register the same `UserPromptSubmit` hook under Memorable's own name, outside
gstack's table. That is the documented way to install the CLI, so on most
machines the hook is already there before gstack is asked.

`enable` refuses in that case rather than adding a second entry. Two entries
run the same command twice on every prompt: the context is injected twice, and
the session is captured twice against your extraction allowance.

To hand it to gstack instead, delete that entry from
`~/.claude/settings.json` and run `enable` again. Memorable has no command that
removes its own hook; `uninstall-hooks` is not a command in 0.5.18.

## Turning it off

```bash
bin/gstack-memorable disable
```

That removes gstack's hook entry and runs `memorable disable`, which stops
capture. It does not delete anything Memorable has already stored. For that,
use `memorable forget`, or remove the binary.

## Under the hood

`bin/gstack-memorable` is the front door. It resolves the CLI from
`MEMORABLE_BIN`, then `~/.memorable/bin/memorable`, then `PATH`, and refuses
with a message naming the variable if it finds none.

`hosts/claude/hooks/memorable-user-prompt-hook` is what actually gets
registered. It resolves the same three ways, execs `memorable hook
user-prompt`, and exits zero on every failure path. A missing or broken
integration must never interrupt Claude Code, so the hook has no way to fail
loudly: if it cannot find the binary it prints nothing and returns success.

Registration itself goes through `bin/gstack-settings-hook ensure-event`, and
the entry is in that file's `KNOWN_HOOKS` table, so it is identified by its
command rather than by a tag. Claude Code rewrites `settings.json` and does not
preserve private tags; the same reason the rest of the table matches on
command.

## Credits

The integration and its hook contract are by
[Advaiyt Sane](https://github.com/AdvaiytSane) and
[Nikhil Krishnaswamy](https://github.com/NIkhil-cmd-cmd) at Memorable.
