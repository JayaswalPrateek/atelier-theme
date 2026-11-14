// Extracts every themable color from a VS Code source checkout into
// reference/color-registry.json: id, description, dark default (as source), deprecation.
//
//   node tools/extract-registry.js <vscode-checkout> [out.json]
//
// Needs the TypeScript compiler. Uses the copy bundled with VS Code unless
// TYPESCRIPT points at another typescript.js.
const fs = require("fs");
const path = require("path");

const TS_CANDIDATES = [
  process.env.TYPESCRIPT,
  "/Applications/Visual Studio Code.app/Contents/Resources/app/extensions/node_modules/typescript/lib/typescript.js",
  "/usr/share/code/resources/app/extensions/node_modules/typescript/lib/typescript.js",
  "typescript",
].filter(Boolean);
let ts;
for (const c of TS_CANDIDATES) {
  try { ts = require(c); break; } catch {}
}
if (!ts) throw new Error("TypeScript not found; set TYPESCRIPT=/path/to/typescript.js");

const root = process.argv[2];
const out = process.argv[3] ?? path.join(__dirname, "..", "reference", "color-registry.json");
if (!root) throw new Error("usage: node tools/extract-registry.js <vscode-checkout> [out.json]");

const transpile = (src) =>
  ts.transpile("(" + src + ")", { target: ts.ScriptTarget.ES2020 }).replace(/^"use strict";\s*/, "").trim().replace(/;$/, "");

function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "test" && e.name !== "node_modules") walk(p, acc);
    } else if (e.name.endsWith(".ts") && !e.name.endsWith(".d.ts") && !e.name.includes(".test.")) {
      acc.push(p);
    }
  }
  return acc;
}

const strOf = (node) =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined;

function localizeText(node) {
  if (!node) return undefined;
  const s = strOf(node);
  if (s !== undefined) return s;
  if (ts.isCallExpression(node) && /localize$/.test(node.expression.getText()) && node.arguments.length >= 2) {
    return strOf(node.arguments[1]) ?? node.arguments[1].getText();
  }
  return node.getText();
}

const colors = [];
const locals = {}; // file -> { constName: source } for helpers like `const errorDefault = transparent(...)`
const skipped = [];

for (const file of walk(path.join(root, "src"), [])) {
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes("registerColor(")) continue;
  const rel = path.relative(root, file);
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);

  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue;
    for (const d of st.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || !d.initializer || d.initializer.getText().includes("registerColor(")) continue;
      (locals[rel] ??= {})[d.name.text] = transpile(d.initializer.getText());
    }
  }

  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText();
      if ((callee === "registerColor" || callee.endsWith(".registerColor")) && !callee.startsWith("this.") && node.arguments.length >= 2) {
        const [idN, defN, descN, transN, deprN] = node.arguments;
        let p = node.parent;
        while (p && !ts.isVariableDeclaration(p) && !ts.isSourceFile(p) && !ts.isBlock(p)) p = p.parent;
        const rec = {
          id: strOf(idN),
          constName: p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) ? p.name.text : undefined,
          file: rel,
          description: localizeText(descN),
          deprecated: deprN ? localizeText(deprN) : undefined,
          defaultsSrc: transpile(defN.getText()),
        };
        if (rec.id) colors.push(rec);
        else skipped.push(`${rel}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${idN.getText()}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

// Terminal ANSI colors are registered in a loop over this map.
const ansiFile = "src/vs/workbench/contrib/terminal/common/terminalColorRegistry.ts";
const ansiSrc = fs.readFileSync(path.join(root, ansiFile), "utf8");
for (const m of ansiSrc.matchAll(/'(terminal\.ansi\w+)':\s*\{\s*index:\s*\d+,\s*defaults:\s*\{[^}]*?dark:\s*'([^']+)'/g)) {
  colors.push({ id: m[1], file: ansiFile, description: `'${m[1].substring(13)}' ANSI color in the terminal.`, defaultsSrc: JSON.stringify(m[2]) });
}

// Colors contributed by built-in extensions (package.json "contributes.colors").
const extDir = path.join(root, "extensions");
for (const ext of fs.existsSync(extDir) ? fs.readdirSync(extDir) : []) {
  const pj = path.join(extDir, ext, "package.json");
  if (!fs.existsSync(pj)) continue;
  const pkg = JSON.parse(fs.readFileSync(pj, "utf8"));
  const nlsPath = path.join(extDir, ext, "package.nls.json");
  const nls = fs.existsSync(nlsPath) ? JSON.parse(fs.readFileSync(nlsPath, "utf8")) : {};
  for (const c of pkg.contributes?.colors ?? []) {
    const dark = c.defaults?.dark ?? null;
    colors.push({
      id: c.id,
      file: `extensions/${ext}/package.json`,
      description: c.description.replace(/^%(.*)%$/, (_, k) => nls[k] ?? k),
      defaultsSrc: JSON.stringify(dark),
    });
  }
}

const sha = (() => {
  try { return require("child_process").execSync("git rev-parse HEAD", { cwd: root }).toString().trim(); } catch { return undefined; }
})();
fs.writeFileSync(out, JSON.stringify({ vscodeCommit: sha, extracted: new Date().toISOString().slice(0, 10), colors, locals }, null, 1) + "\n");
console.log(`${colors.length} colors -> ${path.relative(process.cwd(), out)}`);
if (skipped.length) console.log(`skipped dynamic registrations (handled above or generic):\n  ${skipped.join("\n  ")}`);
