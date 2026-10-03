// Local-only content: anything a studio fences with <!-- local-only --> ... <!-- /local-only --> (markup) or
// /* local-only */ ... /* /local-only */ (script) stays in the workspace and never reaches the public site.
// Guards the boundary between workspace-only content and public studio snapshots.
export const stripLocal = text => text
  .replace(/<!-- local-only -->[\s\S]*?<!-- \/local-only -->\n?/g, "")
  .replace(/\/\* local-only \*\/[\s\S]*?\/\* \/local-only \*\/\n?/g, "");
// throws if a fence was left open, so a half-stripped page can never be published
export function assertStripped(name, text) {
  if (/local-only/.test(text)) throw Error(`${name}: an unclosed local-only fence survived stripping; refusing to publish`);
  return text;
}
