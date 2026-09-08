// lib/dom-dump-script.ts — the rendered-DOM dump script design-review evaluates
// in the page before handing the result to the design detector.
//
// Pure module: no I/O, no imports from scripts/. Consumers:
//   scripts/resolvers/design.ts   renders it once as a fenced JS block (Phase 3)
//   test/fixtures/*.dom.html      captured by running it through the browse engine
//   test/impeccable-fixtures.test.ts  pins that the committed dump came from THIS script
//
// Contract (one script, two engines):
//   - An IIFE expression: Aside's `pg.evaluate(...)` and `$B eval <file>` both
//     wrap an expression, and every `aside repl '...'` body is a single-quoted
//     bash string, so the text contains NO single-quote characters and no `${`.
//   - Works on a CLONE of document.documentElement, never the live page.
//   - Inlines only the stylesheets a <link> owns (inline <style> nodes are
//     already in the markup; re-serializing them double-counts) as one
//     <style data-gstack-dom-css> in <head>, and removes each inlined <link>
//     from the clone so the static engine does not try to resolve its href
//     relative to the dump file. Cross-origin sheets throw on cssRules access,
//     stay as <link>, and are listed in the trailing HTML comment.
//   - The CSSOM serializes author hex colors as rgb(r, g, b); the engine's
//     palette rules (ai-color-palette, cream-palette, ...) match hex literals,
//     so opaque rgb() triples are folded back to #rrggbb. Verified on engine
//     0.1.3: without this fold the DOM dump loses ai-color-palette.
//   - Hygiene before the file leaves the browser: <script> bodies emptied,
//     <input>/<textarea> values dropped, `value=` and `data-*` attributes over
//     32 chars emptied, <meta content> emptied (charset and viewport kept: they
//     carry no user data and the viewport hint is layout-relevant), href query
//     strings cut, data: URLs over 1 KB replaced by a placeholder in attributes
//     and in the inlined CSS.
//   - The trailing comment names what the dump cannot contain (shadow DOM,
//     constructed stylesheets, runtime-injected styles when scripts were
//     stripped) so the report can say so once.
export const DOM_DUMP_SCRIPT = String.raw`(() => {
  const root = document.documentElement.cloneNode(true);
  const head = root.querySelector("head") || root;
  const inlined = [];
  const crossOrigin = [];
  const liveLinks = Array.from(document.querySelectorAll("link"));
  const cloneLinks = Array.from(root.querySelectorAll("link"));
  liveLinks.forEach((link, i) => {
    const sheet = link.sheet;
    if (!sheet) return;
    try {
      const text = Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n");
      inlined.push("/* gstack-dom-dump: " + (sheet.href || "link") + " */\n" + text);
      if (cloneLinks[i]) cloneLinks[i].remove();
    } catch (err) {
      crossOrigin.push(sheet.href || "(unknown)");
    }
  });
  if (inlined.length) {
    const style = document.createElement("style");
    style.setAttribute("data-gstack-dom-css", "");
    const dataUrl = new RegExp("url\\((\"?)data:[^)]{1024,}\\)", "g");
    const rgb = new RegExp("rgb\\((\\d+), (\\d+), (\\d+)\\)", "g");
    const hex = (n) => Number(n).toString(16).padStart(2, "0");
    style.textContent = inlined.join("\n")
      .replace(dataUrl, "url(data:,gstack-stripped)")
      .replace(rgb, (m, r, g, b) => "#" + hex(r) + hex(g) + hex(b));
    head.appendChild(style);
  }
  let scripts = 0;
  for (const el of Array.from(root.querySelectorAll("script"))) {
    if (el.textContent) { el.textContent = ""; scripts += 1; }
  }
  for (const el of Array.from(root.querySelectorAll("textarea"))) el.textContent = "";
  for (const el of Array.from(root.querySelectorAll("*"))) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name;
      const value = attr.value;
      if (name === "value" && (el.nodeName === "INPUT" || el.nodeName === "TEXTAREA")) el.setAttribute(name, "");
      else if ((name === "value" || name.indexOf("data-") === 0) && value.length > 32) el.setAttribute(name, "");
      else if (name === "content" && el.nodeName === "META" && el.getAttribute("name") !== "viewport") el.setAttribute(name, "");
      else if (name === "href" && value.indexOf("?") !== -1) el.setAttribute(name, value.split("?")[0]);
      else if (value.indexOf("data:") === 0 && value.length > 1024) el.setAttribute(name, "data:,gstack-stripped");
    }
  }
  const notes = ["shadow DOM and constructed stylesheets not captured"];
  if (crossOrigin.length) notes.push("cross-origin stylesheets not resolved: " + crossOrigin.join(" "));
  if (scripts) notes.push("scripts stripped: " + scripts + "; styles injected at runtime not captured");
  return "<!DOCTYPE html>\n" + root.outerHTML + "\n<!-- gstack-dom-dump: " + notes.join("; ") + " -->\n";
})()`;

/** Marker the dump script leaves on the inlined-stylesheet node. */
export const DOM_DUMP_STYLE_ATTR = 'data-gstack-dom-css';
/** Prefix of the trailing HTML comment the dump script appends. */
export const DOM_DUMP_NOTE_PREFIX = 'gstack-dom-dump:';
