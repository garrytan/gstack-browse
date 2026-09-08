# Third-Party Notices

gstack is MIT. The files below contain material derived from Apache-2.0 works,
rewritten in gstack's voice and modified. Rewriting is not an exemption: the
license text is in `licenses/Apache-2.0.txt`, and each derived file carries a
notice that it was changed. Unmodified copies (the rule-registry fixture, the
license text) carry no header and are listed here instead.

## impeccable — Copyright Paul Bakaus — Apache License 2.0

https://github.com/pbakaus/impeccable

Derived, modified:

- `lib/design-catalog.ts`: rule ids and names from `crates/live/assets/antipatterns.json`; the prose is gstack's.
- `scripts/resolvers/design.ts`: the Persuade / Operate / Read / Experience visitor modes, the craft-floor reflexes (browser surfaces, one authored motion moment, depth has an offset, tinted secondary text, space above headings, light-or-dark from the use scene), and the three-looks calibration, from `SKILL.md`, `reference/craft-floor.md`, and `reference/new-work.md`, rewritten.
- `design-consultation/sections/proposal-and-preview.md.tmpl`: the font-selection procedure and the calibration paragraph, rewritten; and the `SKILL.md` / `sections/*.md` files generated from these sources.

Unmodified copy:

- `test/fixtures/impeccable-antipatterns.json`: `crates/live/assets/antipatterns.json` at commit 87d8f6d6 (engine-v0.1.3), wrapped in a `_source` provenance object.

Not distributed: `bin/gstack-design-detect.ts` invokes an impeccable engine the
user installed. gstack does not ship, download, or install that engine, and does
not audit its network behavior; the wrapper refuses URL targets so gstack never
asks it to touch the network.

## DESIGN.md specification — Copyright Google LLC — Apache License 2.0

https://github.com/google-labs-code/design.md

`lib/design-md.ts`, `bin/gstack-design-md.ts`, and the Phase 6 template in
`design-consultation/sections/proposal-and-preview.md.tmpl` implement the
format (YAML token front matter in five groups, eight canonical sections in
spec order, `{path}` token references). No specification text is reproduced.
