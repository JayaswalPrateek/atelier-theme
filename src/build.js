// Builds themes/atelier-dark-color-theme.json from the palette and the color maps.
const fs = require("fs");
const path = require("path");

const p = new Proxy(require("./palette"), {
  // A typo like `p.bg10` should fail the build, not silently emit "undefined".
  get(target, key) {
    if (typeof key === "string" && !(key in target)) throw new Error(`Unknown palette color: p.${key}`);
    return target[key];
  },
});

const theme = {
  $schema: "vscode://schemas/color-theme",
  name: "Atelier Black",
  type: "dark",
  semanticHighlighting: true,
  semanticTokenColors: require("./semantic")(p),
  colors: require("./workbench")(p),
  tokenColors: require("./syntax")(p),
};

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const check = (where, value) => {
  if (!HEX.test(value)) throw new Error(`${where}: invalid color ${JSON.stringify(value)}`);
};
for (const [key, value] of Object.entries(theme.colors)) check(key, value);
for (const [key, value] of Object.entries(theme.semanticTokenColors)) check(key, typeof value === "string" ? value : value.foreground);
for (const rule of theme.tokenColors) {
  for (const k of ["foreground", "background"]) if (rule.settings[k] !== undefined) check(rule.name ?? rule.scope, rule.settings[k]);
}

const out = path.join(__dirname, "..", "themes", "atelier-dark-color-theme.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(theme, null, 2) + "\n");
console.log(`Wrote ${path.relative(process.cwd(), out)}: ${Object.keys(theme.colors).length} colors, ${theme.tokenColors.length} token rules`);
