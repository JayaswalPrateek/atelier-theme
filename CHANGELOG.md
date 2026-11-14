# Changelog

## 0.1.0

First release, built from a personal patch of Gruvbox Material Dark (hard contrast, material palette, v6.5.2).

### Carried over unchanged

- All 452 hand-tuned workbench values, all 276 token rules and all semantic token colors.
- The surface model: a pure black base, the shifted `bg0`..`bg9` ramp, and the original hard-contrast `#070808` and `#131414` kept as `line` and `sunken`.

### Fixed

- `git.blame.editorDecorationForeground` inherited the black inlay-hint text, so inline blame was invisible on the black editor. It is now `grey0`.
- `commentsView.unresolvedIcon`, `notebook.cellInsertionIndicator` and `chat.voiceGlowBaseColor` default to `focusBorder`, which is transparent here, so they never showed. They now have values.
- `inlineEdit.gutterIndicator.primaryForeground` drew a black icon on a 40% grey wash. It now uses `fg`.
- `checkbox.disabled.*` mixed black with the orange checkmark into a brown. It is now neutral.
- `editorIndentGuide.background` and `.activeBackground` are deprecated. They moved to `background1` and `activeBackground1`.
- Removed keys VS Code no longer reads: `activityBar.dropBackground`, `imagePreview.border`, `welcomePage.buttonBackground`, `welcomePage.buttonHoverBackground`, `notebook.focusedRowBorder`.

### Filled

Atelier sets 137 colors the patch didn't, including the fixes above. Most of them previously fell back to stock VS Code values (`#007acc` blue, `#ffffff` white, `#3399cc` tab-modified blue and others) and now come from the palette. They cover diff and merge editors, chat, agent sessions, the modern layout (`surface.border`), the command center, the SCM graph, terminal command decorations, debug views, testing badges, radio controls, activity bar badges and the top/bottom activity bar. The audit reports zero gaps against VS Code commit `b4bd9bd3c0`.

Extension colors are now on the palette too: Error Lens (inline messages, line tints, status bar), GitHub Pull Requests (merged/draft/closed), Remote Repositories decorations and Rainbow CSV column tracking.
