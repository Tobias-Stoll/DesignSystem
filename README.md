# Design System

Design tokens with **Figma as the single source of truth**, synced to code automatically.

```
Figma Variables ──Token Bridge──▶ tokens/*.json ──GitHub Action──▶ dist/*.css
```

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
