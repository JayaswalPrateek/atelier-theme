# Atelier Black

A quiet, borderless dark theme for VS Code. One black surface, warm grey chrome, and color only where it means something.

## Install

Install **Atelier Black** from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=jayaswalprateek.atelier-theme), or from [Open VSX](https://open-vsx.org/extension/jayaswalprateek/atelier-theme) for VSCodium, Cursor and other forks. You can also run:

```sh
code --install-extension jayaswalprateek.atelier-theme
```

Then open **Preferences: Color Theme** and pick **Atelier Dark**.

Atelier started as a long-running personal patch of the (now archived) [Gruvbox Material](https://github.com/sainnhe/gruvbox-material-vscode) dark theme, hard contrast. The syntax colors are Gruvbox Material's. The workbench has been reworked around the rules below and audited against every color VS Code currently exposes.

## Design rules

These rules decide every value in `src/workbench.js`. New colors should follow them.

1. **One surface.** The editor, side bar, panel, tabs, title bar, status bar, activity bar and menus all sit on pure black `bg #000000`. Borders between chrome regions use that same black, so regions are separated by space, not lines (`tab.border`, `panel.border`, `statusBar.border`, `titleBar.border`, `activityBar.border`, `surface.border`).
2. **Hairlines only where identical surfaces meet.** Split editors and stacked panel sections get `line #070808`, which is barely off black. Nothing else gets a dividing line.
3. **Elevation by warmth, not outlines.** Floating UI (hover, suggest, peek, notifications, quick input, debug toolbar) lifts onto warm greys `bg0 #2a2827` to `bg2 #32302f`. Where a widget has a border, it matches the fill: the suggest widget, notifications, inline chat, secondary buttons.
4. **Monochrome chrome.** Chrome text uses the grey ramp: `grey2` for primary, `grey1` for secondary, `grey0` for inactive and for the status bar. Active states are thin grey underlines (`tab.activeBorder`, `activityBar.activeBorder`, `panelTitle.activeBorder`), never an accent color. There are no focus rings (`focusBorder` is transparent). Buttons and badges are inverted: `grey2` fill with black text.
5. **Color is meaning.** Accents appear only for state and content. Red is error or deleted, yellow is warning or untracked, blue is info or modified, green is added or a link, aqua is passed or staged, purple is a conflict. Syntax keeps the Gruvbox Material palette.
6. **Status never repaints the bar.** Debugging, offline and no-folder states keep the black status bar and change only the text color.
7. **Controls are outlines.** Inputs and dropdowns have a transparent or black fill with a `bg5` outline. Settings-editor controls use `bg7`.
8. **One loud element.** Inlay hints are solid pills with black text: green for general hints, purple for types, `fg` for parameters.

## Layout

```
src/palette.js     every hex value, named (bg, line, sunken, bg0..bg9, grey0..2, fg*, accents)
src/workbench.js   UI colors, grouped like the official theme-color reference
src/syntax.js      TextMate tokenColors
src/semantic.js    semanticTokenColors
src/build.js       writes themes/atelier-dark-color-theme.json (fails on unknown palette names or bad hex)
tools/audit.js     resolves every VS Code color against the built theme and writes reference/COLORS.md
tools/extract-registry.js, tools/sync-vscode.sh   refresh the VS Code color registry and docs
reference/         upstream docs, VS Code's default themes, the registry snapshot, COLORS.md
atelier            the original patched Gruvbox Material JSON, kept for reference
```

`themes/atelier-dark-color-theme.json` is a build output. Edit `src/` and run `npm run build`.

## Develop

```sh
npm run build    # src/ -> themes/atelier-dark-color-theme.json
npm run watch    # rebuild on save
npm run audit    # report gaps, deprecated and unknown keys; regenerate reference/COLORS.md
npm run check    # build + audit
```

To preview changes, press F5 in this folder. That opens an Extension Development Host with Atelier installed; pick **Atelier Dark** there. With `npm run watch` running, saved edits show up live.

There are no dependencies. Node 18 or newer is enough.

### What the audit checks

`tools/audit.js` evaluates each color's default the same way VS Code does: `transparent()`, `darken()`, `lessProminent()`, `oneOf()`, `ifDefinedThenElse()` and so on, all against Atelier's values. It reports what every color actually renders as. A **gap** is a color Atelier doesn't set whose default chain ends in a stock VS Code hex value, such as `#007acc` blue or `#ffffff` white. Gaps are what make a theme look patched, so the audit exits non-zero on any gap, on deprecated keys and on keys VS Code no longer knows.

`reference/COLORS.md` lists every themable color with its description, VS Code's dark default, Atelier's resolved value and whether it is set, inherited, transparent or not drawn.

### Keeping up with VS Code

VS Code adds colors most months. To pick them up:

```sh
npm run sync     # sparse-clones microsoft/vscode into .cache/, re-extracts the registry, refreshes docs
npm run check    # new gaps show up here; add them to src/workbench.js
```

Extracting the registry needs the TypeScript compiler. The script uses the copy that ships inside VS Code. Set `TYPESCRIPT=/path/to/typescript.js` if VS Code isn't installed in the default location.

## Publish

1. Bump `version` in `package.json` and add a `CHANGELOG.md` entry.
2. Run `npm run package`. This runs `check` first and produces `atelier-theme-<version>.vsix`.
3. Try it locally with `code --install-extension atelier-theme-<version>.vsix`.
4. Publish to the Marketplace with `npm run publish:vsce` (after `npx @vscode/vsce login jayaswalprateek`).
5. Publish to Open VSX with `npm run publish:ovsx -- -p <token>`.

## License

MIT. Derived from Gruvbox Material for VS Code by sainnhe (MIT), which builds on gruvbox by morhetz.
