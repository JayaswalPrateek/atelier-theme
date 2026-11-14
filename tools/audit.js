// Resolves every VS Code color against the built theme the way the workbench does
// (dark defaults), then:
//   - prints gaps: unset colors that fall back to a stock VS Code hex value
//   - flags deprecated or unknown keys in the theme
//   - writes reference/COLORS.md, a table of every color and what Atelier renders
//
//   node tools/audit.js            exits 1 if there are gaps or bad keys
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "reference", "color-registry.json"), "utf8"));
const theme = JSON.parse(fs.readFileSync(path.join(ROOT, "themes", "atelier-dark-color-theme.json"), "utf8"));
const docs = fs.readFileSync(path.join(ROOT, "reference", "theme-color.md"), "utf8");
const tc = theme.colors;

// Keys contributed by third-party extensions; not in VS Code's registry by design.
const THIRD_PARTY = /^(gitlens|issues|github|pullRequests|rust_analyzer|errorLens|remoteHub)\.|^rainbowtrack\d$/;
// Keys whose value is an opacity, not a color, so a stock default is meaningless.
const OPACITY_KEYS = new Set(["minimap.foregroundOpacity", "editorUnnecessaryCode.opacity"]);

// ---- Color: port of what the registry needs from vs/base/common/color.ts
const roundFloat = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
const clamp = (n, lo, hi) => Math.max(Math.min(hi, n), lo);
class RGBA {
  constructor(r, g, b, a = 1) {
    this.r = clamp(r, 0, 255) | 0;
    this.g = clamp(g, 0, 255) | 0;
    this.b = clamp(b, 0, 255) | 0;
    this.a = roundFloat(clamp(a, 0, 1), 3);
  }
}
class HSLA {
  constructor(h, s, l, a) {
    this.h = clamp(h, 0, 360) | 0;
    this.s = roundFloat(clamp(s, 0, 1), 3);
    this.l = roundFloat(clamp(l, 0, 1), 3);
    this.a = roundFloat(clamp(a, 0, 1), 3);
  }
  static fromRGBA({ r, g, b, a }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (min + max) / 2, chroma = max - min;
    let h = 0, s = 0;
    if (chroma > 0) {
      s = Math.min(l <= 0.5 ? chroma / (2 * l) : chroma / (2 - 2 * l), 1);
      if (max === r) h = (g - b) / chroma + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / chroma + 2;
      else h = (r - g) / chroma + 4;
      h = Math.round(h * 60);
    }
    return new HSLA(h, s, l, a);
  }
  static toRGBA({ h, s, l, a }) {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    h /= 360;
    if (s === 0) return new RGBA(Math.round(l * 255), Math.round(l * 255), Math.round(l * 255), a);
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return new RGBA(Math.round(hue2rgb(p, q, h + 1 / 3) * 255), Math.round(hue2rgb(p, q, h) * 255), Math.round(hue2rgb(p, q, h - 1 / 3) * 255), a);
  }
}
class Color {
  constructor(arg) {
    this.rgba = arg instanceof HSLA ? HSLA.toRGBA(arg) : arg;
  }
  get hsla() { return HSLA.fromRGBA(this.rgba); }
  static fromHex(hex) {
    let h = hex.slice(1);
    if (h.length <= 4) h = [...h].map((c) => c + c).join("");
    const n = (i) => parseInt(h.substr(i, 2), 16);
    return new Color(new RGBA(n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1));
  }
  luminance() {
    const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return roundFloat(0.2126 * f(this.rgba.r) + 0.7152 * f(this.rgba.g) + 0.0722 * f(this.rgba.b), 4);
  }
  isDarkerThan(o) { return this.luminance() < o.luminance(); }
  isLighterThan(o) { return this.luminance() > o.luminance(); }
  lighten(f) { const c = this.hsla; return new Color(new HSLA(c.h, c.s, c.l + c.l * f, c.a)); }
  darken(f) { const c = this.hsla; return new Color(new HSLA(c.h, c.s, c.l - c.l * f, c.a)); }
  transparent(f) { const { r, g, b, a } = this.rgba; return new Color(new RGBA(r, g, b, a * f)); }
  mix(o, f = 0.5) {
    const n = clamp(f, 0, 1), a = this.rgba, b = o.rgba;
    return new Color(new RGBA(a.r + (b.r - a.r) * n, a.g + (b.g - a.g) * n, a.b + (b.b - a.b) * n, a.a + (b.a - a.a) * n));
  }
  makeOpaque(bg) {
    if (this.rgba.a === 1 || bg.rgba.a !== 1) return this;
    const { r, g, b, a } = this.rgba, B = bg.rgba;
    return new Color(new RGBA(B.r - a * (B.r - r), B.g - a * (B.g - g), B.b - a * (B.b - b), 1));
  }
  static getLighterColor(of, rel, factor = 0.5) {
    return of.isLighterThan(rel) ? of : of.lighten((factor * (rel.luminance() - of.luminance())) / rel.luminance());
  }
  static getDarkerColor(of, rel, factor = 0.5) {
    return of.isDarkerThan(rel) ? of : of.darken((factor * (of.luminance() - rel.luminance())) / of.luminance());
  }
  hex() {
    const h = (n) => n.toString(16).padStart(2, "0");
    const { r, g, b, a } = this.rgba;
    return "#" + h(r) + h(g) + h(b) + (a === 1 ? "" : h(Math.round(a * 255)));
  }
}
for (const [name, rgba] of Object.entries({ white: [255, 255, 255, 1], black: [0, 0, 0, 1], red: [255, 0, 0, 1], blue: [0, 0, 255, 1], green: [0, 255, 0, 1], cyan: [0, 255, 255, 1], lightgrey: [211, 211, 211, 1], transparent: [0, 0, 0, 0] })) {
  Color[name] = new Color(new RGBA(...rgba));
}

// ---- evaluate registry defaults (same shapes as colorUtils.ts transforms)
const T = {
  darken: (value, factor) => ({ op: "darken", value, factor }),
  lighten: (value, factor) => ({ op: "lighten", value, factor }),
  transparent: (value, factor) => ({ op: "transparent", value, factor }),
  withOpacity: (value, opacity) => ({ op: "opacity", value, opacity }),
  opaque: (value, background) => ({ op: "opaque", value, background }),
  oneOf: (...values) => ({ op: "oneOf", values }),
  ifDefinedThenElse: (ifArg, thenArg, elseArg) => ({ op: "ifdef", if: ifArg, then: thenArg, else: elseArg }),
  lessProminent: (value, background, factor, transparency) => ({ op: "lessProminent", value, background, factor, transparency }),
};
const OPS = { Darken: "darken", Lighten: "lighten", Transparent: "transparent", Opaque: "opaque", OneOf: "oneOf", LessProminent: "lessProminent", IfDefinedThenElse: "ifdef", Mix: "mix", Opacity: "opacity" };
const byConst = new Map(registry.colors.filter((c) => c.constName).map((c) => [c.constName, c.id]));
const unresolved = new Set();
// eslint-disable-next-line no-new-func
const evaluate = new Function("scope", "src", "with (scope) { return eval(src); }");
const localCache = new Map();
const PASSTHROUGH = new Set(["eval", "src", "scope", "undefined", "Math", "Number", "Object", "Array", "JSON", "String", "Boolean"]);
function scopeFor(file) {
  const locals = registry.locals[file] ?? {};
  return new Proxy({}, {
    has: (_, k) => typeof k === "string" && !PASSTHROUGH.has(k),
    get: (_, k) => {
      if (k === Symbol.unscopables) return undefined;
      if (k in T) return T[k];
      if (k === "Color") return Color;
      if (k === "RGBA") return RGBA;
      if (k === "HSLA") return HSLA;
      if (k === "ColorTransformType") return OPS;
      if (k in locals) {
        const key = file + "#" + k;
        if (!localCache.has(key)) localCache.set(key, evaluate(scopeFor(file), locals[k]));
        return localCache.get(key);
      }
      if (byConst.has(k)) return byConst.get(k); // a registered color's const is its id
      return new Proxy({}, { // namespace import, e.g. colorRegistry.editorBackground
        get: (_, p) => {
          if (typeof p === "string" && byConst.has(p)) return byConst.get(p);
          if (p in T) return T[p];
          unresolved.add(`${k}.${String(p)} (${file})`);
          return undefined;
        },
      });
    },
  });
}

const defs = new Map();
for (const c of registry.colors) {
  let d;
  try { d = evaluate(scopeFor(c.file), c.defaultsSrc); } catch (e) { unresolved.add(`${c.id}: ${e.message}`); d = null; }
  const dark = d && typeof d === "object" && "dark" in d && "light" in d ? d.dark : d;
  defs.set(c.id, { ...c, dark });
}

// ---- resolve against the theme, tracking provenance
function resolveValue(v, prov, stack) {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "string") {
    if (v[0] === "#") { prov.literals.add(v); return Color.fromHex(v); }
    return getColor(v, prov, stack);
  }
  if (v instanceof Color) { prov.literals.add(v.hex()); return v; }
  const R = (x) => resolveValue(x, prov, stack);
  switch (v.op) {
    case "darken": return R(v.value)?.darken(v.factor);
    case "lighten": return R(v.value)?.lighten(v.factor);
    case "transparent": return R(v.value)?.transparent(v.factor);
    case "opacity": { const c = R(v.value); return c && new Color(new RGBA(c.rgba.r, c.rgba.g, c.rgba.b, v.opacity)); }
    case "mix": return (R(v.color) || Color.transparent).mix(R(v.with) || Color.transparent, v.ratio);
    case "opaque": { const bg = R(v.background), c = R(v.value); return bg && c ? c.makeOpaque(bg) : c; }
    case "ifdef": return R(tc[v.if] !== undefined ? v.then : v.else);
    case "oneOf":
      for (const candidate of v.values) {
        const sub = { keys: new Set(), literals: new Set() };
        const c = resolveValue(candidate, sub, stack);
        if (c) { sub.keys.forEach((k) => prov.keys.add(k)); sub.literals.forEach((l) => prov.literals.add(l)); return c; }
      }
      return undefined;
    case "lessProminent": {
      const from = R(v.value);
      if (!from) return undefined;
      const bg = R(v.background);
      if (!bg) return from.transparent(v.factor * v.transparency);
      return (from.isDarkerThan(bg) ? Color.getLighterColor(from, bg, v.factor) : Color.getDarkerColor(from, bg, v.factor)).transparent(v.transparency);
    }
  }
  return undefined;
}
const memo = new Map();
function getColor(id, prov, stack = []) {
  if (tc[id] !== undefined) { prov.keys.add(id); return Color.fromHex(tc[id]); }
  if (stack.includes(id)) return undefined;
  if (!memo.has(id)) {
    const sub = { keys: new Set(), literals: new Set() };
    memo.set(id, { c: resolveValue(defs.get(id)?.dark, sub, [...stack, id]), sub });
  }
  const { c, sub } = memo.get(id);
  sub.keys.forEach((k) => prov.keys.add(k));
  sub.literals.forEach((l) => prov.literals.add(l));
  return c;
}

const describe = (v) => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (v instanceof Color) return v.hex();
  switch (v.op) {
    case "oneOf": return `oneOf(${v.values.map(describe).join(", ")})`;
    case "ifdef": return `${v.if} defined ? ${describe(v.then)} : ${describe(v.else)}`;
    case "mix": return `mix(${describe(v.color)}, ${describe(v.with)}, ${v.ratio ?? 0.5})`;
    case "opaque": return `opaque(${describe(v.value)} on ${describe(v.background)})`;
    case "lessProminent": return `lessProminent(${describe(v.value)}, ${describe(v.background)})`;
    default: return `${v.op}(${describe(v.value)}, ${v.factor ?? v.opacity})`;
  }
};

const rows = [];
for (const [id, d] of defs) {
  const prov = { keys: new Set(), literals: new Set() };
  const c = getColor(id, prov);
  let status;
  if (tc[id] !== undefined) status = "set";
  else if (!c) status = "unset";
  else if (c.rgba.a === 0 || OPACITY_KEYS.has(id)) status = "transparent";
  else if (prov.literals.size && !prov.keys.size) status = "gap";
  else status = "inherited";
  rows.push({ id, status, value: c ? c.hex() : null, d, from: [...prov.keys] });
}

// ---- report
const byStatus = (s) => rows.filter((r) => r.status === s && !r.d.deprecated);
const gaps = byStatus("gap");
const deprecatedUsed = rows.filter((r) => r.d.deprecated && tc[r.id] !== undefined);
const unknown = Object.keys(tc).filter((k) => !defs.has(k) && !THIRD_PARTY.test(k));

console.log(`VS Code registry: ${defs.size} colors (commit ${registry.vscodeCommit?.slice(0, 10) ?? "?"}, extracted ${registry.extracted})`);
console.log(`  set ${byStatus("set").length} · inherited ${byStatus("inherited").length} · transparent ${byStatus("transparent").length} · no default ${byStatus("unset").length} · gaps ${gaps.length}`);
for (const r of gaps) console.log(`  GAP        ${r.id.padEnd(52)} ${r.value}  (${r.d.description})`);
for (const r of deprecatedUsed) console.log(`  DEPRECATED ${r.id}: ${r.d.deprecated}`);
for (const k of unknown) console.log(`  UNKNOWN    ${k} (not a VS Code color; removed or misspelled?)`);
if (unresolved.size) console.log(`  could not evaluate: ${[...unresolved].join(", ")}`);

// ---- reference/COLORS.md
let section = null;
const docSection = {}, docOrder = {}, sections = [];
for (const line of docs.split("\n")) {
  const h = line.match(/^## (.*)/);
  if (h) { section = h[1]; sections.push(section); continue; }
  const m = line.match(/^- `([^`]+)`/);
  if (m && section && !(m[1] in docSection)) { docSection[m[1]] = section; docOrder[m[1]] = Object.keys(docOrder).length; }
}
const segSection = {};
for (const [k, s] of Object.entries(docSection)) segSection[k.split(".")[0]] ??= s;
const sectionOf = (id) => docSection[id] ?? segSection[id.split(".")[0]] ?? "Not in the reference docs";
const groups = new Map([...sections, "Not in the reference docs"].map((s) => [s, []]));
for (const r of rows) groups.get(sectionOf(r.id)).push(r);

const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const label = { set: "**set**", inherited: "inherited", transparent: "transparent", unset: "not drawn", gap: "⚠ gap" };
let md = `# Atelier color reference

Generated by \`npm run audit\` from VS Code commit \`${registry.vscodeCommit ?? "?"}\` (${registry.extracted}).
Every themable workbench color, what VS Code falls back to when a theme leaves it out, and what Atelier renders.

- **set**: defined in \`src/workbench.js\`
- inherited: not set; VS Code derives it from colors Atelier sets
- transparent: not set; transparent by design (for example, guide levels that reuse level 1)
- not drawn: no default; VS Code skips the decoration unless a theme sets it
- ⚠ gap: not set and falls back to a stock VS Code hex value. \`npm run audit\` fails on these.

Values are the dark defaults. Alpha is the last two hex digits.
`;
for (const [s, list] of groups) {
  if (!list.length) continue;
  list.sort((a, b) => (docOrder[a.id] ?? 1e9) - (docOrder[b.id] ?? 1e9) || a.id.localeCompare(b.id));
  md += `\n## ${s}\n\n| Color | Atelier | Status | VS Code default (dark) | Description |\n| --- | --- | --- | --- | --- |\n`;
  for (const r of list) {
    const dep = r.d.deprecated ? " _(deprecated)_" : "";
    md += `| \`${r.id}\`${dep} | ${r.value ? `\`${r.value}\`` : "—"} | ${label[r.status]} | ${esc(describe(r.d.dark))} | ${esc(r.d.description)} |\n`;
  }
}
fs.writeFileSync(path.join(ROOT, "reference", "COLORS.md"), md);
console.log("Wrote reference/COLORS.md");

process.exit(gaps.length || deprecatedUsed.length || unknown.length ? 1 : 0);
