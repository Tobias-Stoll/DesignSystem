// Builds CSS from the W3C design tokens that Token Bridge exports from Figma.
// Aliases are kept as var() references, so the token chain stays visible in the browser:
//   --button-primary-bg-default -> --color-action-primary-bg-default -> --color-purple-600
import StyleDictionary from 'style-dictionary';

const isTypography = (t) => t.$type === 'typography';
const cssVar = (ref) => `var(--${ref.replace(/[{}]/g, '').split('.').join('-')})`;

// Text styles become utility classes that point at the font variables
StyleDictionary.registerFormat({
  name: 'css/typography-classes',
  format: ({ dictionary }) => {
    const header = '/**\n * Do not edit directly. Generated from Figma via Token Bridge.\n */\n\n';
    const rules = dictionary.allTokens.map((t) => {
      const v = t.original.$value;
      const cls = t.path.slice(1).join('-'); // typography.heading.l -> heading-l
      return `.text-${cls} {\n` +
        `  font-family: ${cssVar(v.fontFamily)};\n` +
        `  font-weight: ${cssVar(v.fontWeight)};\n` +
        `  font-size: ${cssVar(v.fontSize)};\n` +
        `  line-height: ${cssVar(v.lineHeight)};\n` +
        // Overline: tracking and case come straight from the Figma text style
        (v.letterSpacing ? `  letter-spacing: ${v.letterSpacing};\n` : '') +
        (v.textTransform ? `  text-transform: ${v.textTransform};\n` : '') + '}';
    });
    return header + rules.join('\n\n') + '\n';
  },
});

// Add a generic fallback so text stays readable while web fonts load
StyleDictionary.registerTransform({
  name: 'fontFamily/fallback',
  type: 'value',
  filter: (t) => t.$type === 'fontFamily',
  transform: (t) => {
    const name = String(t.$value).replace(/['"]/g, '');
    return /mono/i.test(name) ? `'${name}', ui-monospace, SFMono-Regular, Menlo, monospace` : `'${name}', sans-serif`;
  },
});

const sd = new StyleDictionary({
  source: ['tokens/**/*.json'],
  usesDtcg: true,
  log: { verbosity: 'default' },
  platforms: {
    css: {
      transforms: [...StyleDictionary.hooks.transformGroups.css, 'fontFamily/fallback'],
      buildPath: 'dist/',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables',
          filter: (t) => !isTypography(t),
          options: { outputReferences: true, selector: ':root' },
        },
        {
          destination: 'typography.css',
          format: 'css/typography-classes',
          filter: isTypography,
        },
      ],
    },
  },
});

await sd.buildAllPlatforms();
