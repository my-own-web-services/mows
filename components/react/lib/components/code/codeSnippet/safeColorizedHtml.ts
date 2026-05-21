// Belt-and-braces guard around Monaco's `colorize()` output. Monaco is
// documented to escape its input as part of the token→HTML pipeline, but
// the safety guarantee depends on that escape staying in place across
// Monaco upgrades and across whatever themes/languages a future
// contributor wires in. If the produced HTML ever contains an
// active-content tag, fall back to the raw escaped text instead of
// injecting it via `dangerouslySetInnerHTML`.
//
// Lives in its own file so the guard is unit-testable without pulling in
// the `monaco-editor` ESM bundle (which trips over jsdom limitations).

const ACTIVE_TAG_RE = /<\s*(script|iframe|object|embed|link|meta|style)\b/i;

const escapeHtml = (input: string): string =>
    input
        .replace(/&/g, `&amp;`)
        .replace(/</g, `&lt;`)
        .replace(/>/g, `&gt;`)
        .replace(/"/g, `&quot;`)
        .replace(/'/g, `&#39;`);

export const safeColorizedHtml = (raw: string, source: string): string =>
    ACTIVE_TAG_RE.test(raw) ? escapeHtml(source) : raw;
