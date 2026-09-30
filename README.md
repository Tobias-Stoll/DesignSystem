# Design System

Design tokens and components with **Figma as the single source of truth**.

**Live:** https://tobias-stoll.github.io/DesignSystem/ · **All tokens:** https://tobias-stoll.github.io/DesignSystem/#tokens
**Figma:** [Design System file](https://www.figma.com/design/NvYNqHYZlROxpwRCq7yy3p/Design-System?node-id=46-693) (view only)

```
Tokens      Figma Variables ──Token Bridge──▶ tokens/*.json ──GitHub Action──▶ dist/*.css
Components  Figma component ──Figma MCP──▶ design QA ──▶ components/*.css
```

## Repository

| Folder | Content |
|---|---|
| `tokens/` | Design tokens exported from Figma (generated, do not edit) |
| `dist/` | CSS built from the tokens by the GitHub Action (generated) |
| `components/` | Component styles: Button, Input, Checkbox, Alert, Form Field, Sign-up Card |
| `token-bridge/` | The Figma plugin that syncs Figma Variables with this repo ([README](token-bridge/README.md)) |
| `index.html` | The live documentation site |

## Token layers

| Layer | File | Example |
|---|---|---|
| Primitives | `tokens/primitives.json` | `color.purple.600 = #5f2cff` |
| Semantic | `tokens/semantic.json` | `color.action.primary.bg.default → {color.purple.600}` |
| Component | `tokens/component.json` | `button.primary.bg.default → {color.action.primary.bg.default}` |
| Typography | `tokens/typography.json` | Figma text styles, bound to font tokens |

Aliases stay intact all the way into CSS:

```css
--button-primary-bg-default: var(--color-action-primary-bg-default);
--color-action-primary-bg-default: var(--color-purple-600);
--color-purple-600: #5f2cff;
```

## Output

- `dist/tokens.css`: all tokens as CSS custom properties
- `dist/typography.css`: text styles as `.text-*` classes

`tokens/` and `dist/` are generated. Change values in Figma, not here.

## Local build

```bash
npm ci
npm run build
```
