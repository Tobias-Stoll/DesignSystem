# Token Bridge

A Figma plugin that connects Figma Variables with this repository, in both directions.

```
Import   token JSON  ──▶  Figma Variables (as aliases)
Export   Figma Variables + Text Styles  ──▶  tokens/*.json in GitHub (one commit)
```

Figma's Variables REST API is only available on the Enterprise plan. Token Bridge uses the Plugin API instead, which works on every plan.

## What it does

**Import**
- Creates the `Semantic` and `Component` collections and fills them from `import/*.json`
- Every value is an **alias** to the layer below: `Primitives ← Semantic ← Component`
- Sets scopes per token, so colors only show up where they fit (fills, text, strokes …)
- Creates the text styles and binds them to the font variables
- Safe to run again: existing variables are updated, never duplicated
- Reports missing references, which doubles as a naming check

**Export**
- Reads all local collections and text styles
- Writes W3C design tokens with aliases intact:
  `tokens/primitives.json`, `semantic.json`, `component.json`, `typography.json`
- Pushes them as **one commit** via the GitHub Git Data API. No changes, no commit.
- The GitHub Action in this repo then builds `dist/tokens.css`

## Install (Figma desktop app)

1. Download this folder
2. Figma → Plugins → Development → **Import plugin from manifest…** → select `manifest.json`
3. Run it via Plugins → Development → **Token Bridge**

## Export to GitHub

You need a **fine-grained personal access token**:
- GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token
- Repository access: *Only select repositories* → this repository
- Permissions: **Contents: Read and write**

Enter owner, repo, branch and the token in the **Export → GitHub** tab. The token is stored only locally in Figma (`figma.clientStorage`), never in the file or the repository.

## Update the import data

The JSON that pre-fills the Import tab lives in `import/`. After editing it:

```bash
python3 build.py   # rebuilds ui.html from src/ui.template.html + import/*.json
```

You can also paste any JSON with `{ "Semantic": {…}, "Component": {…} }` straight into the Import tab.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Plugin manifest, network access limited to `api.github.com` |
| `code.js` | Plugin logic: import, export, text styles |
| `ui.html` | Built plugin UI (generated, do not edit) |
| `src/ui.template.html` | UI source |
| `import/semantic.json`, `import/component.json` | Token layers defined with Claude |
| `build.py` | Builds `ui.html` |

## Limits

- One mode per collection (no theming yet)
- Colors, numbers and strings. Number variables are exported as `px`, except font weights.
