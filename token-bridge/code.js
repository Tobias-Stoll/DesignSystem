// Token Bridge: imports token layers (JSON by Claude) into Figma.
// Every value becomes an ALIAS to a variable in the layer below:
//   Primitives  <-  Semantic  <-  Component
// Figma stays the single source of truth.

figma.showUI(__html__, { width: 420, height: 560 });

// Import order matters: each layer resolves references against the layers listed in "from".
const LAYERS = [
  { key: 'Semantic', from: ['Primitives'] },
  { key: 'Component', from: ['Semantic', 'Primitives'] },
];
const WEIGHT_TO_STYLE = { 400: 'Regular', 500: 'Medium', 700: 'Bold' };

// "{color.neutral.50}" -> "color/neutral/50"
const refToName = (ref) => ref.replace(/[{}]/g, '').split('.').join('/');

// Where each token may be used in Figma (keeps pickers clean)
function scopesFor(path) {
  if (/(^|\/)bg(\/|$)/.test(path)) return ['FRAME_FILL', 'SHAPE_FILL'];
  if (/(^|\/)fg(\/|$)/.test(path)) return ['TEXT_FILL', 'SHAPE_FILL', 'STROKE_COLOR'];
  if (/(^|\/)border(\/|$)/.test(path) || path.endsWith('focus-ring/color')) return ['STROKE_COLOR'];
  if (path.includes('border-width') || path.endsWith('focus-ring/width')) return ['STROKE_FLOAT'];
  if (path.startsWith('space/') || path.includes('padding') || path.endsWith('/gap')) return ['GAP'];
  if (path.includes('radius')) return ['CORNER_RADIUS'];
  return ['ALL_SCOPES'];
}

// Flatten W3C token tree into [{ path, value }]
function flatten(obj, prefix = []) {
  const out = [];
  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('$')) continue;
    if (val && typeof val === 'object' && '$value' in val) {
      out.push({ path: [...prefix, key].join('/'), value: val.$value });
    } else if (val && typeof val === 'object') {
      out.push(...flatten(val, [...prefix, key]));
    }
  }
  return out;
}

// name -> variable, per collection name
async function indexVariables() {
  const cols = await figma.variables.getLocalVariableCollectionsAsync();
  const vars = await figma.variables.getLocalVariablesAsync();
  const byId = new Map(cols.map((c) => [c.id, c]));
  const index = new Map(); // collectionName -> Map(varName -> variable)
  for (const c of cols) index.set(c.name, new Map());
  for (const v of vars) index.get(byId.get(v.variableCollectionId).name).set(v.name, v);
  return { cols, index };
}

async function importLayer(layer, tokens, log) {
  const { cols, index } = await indexVariables();
  const col = cols.find((c) => c.name === layer.key) || figma.variables.createVariableCollection(layer.key);
  const own = index.get(layer.key) || new Map();
  const modeId = col.defaultModeId;
  const resolve = (name) => {
    for (const src of layer.from) {
      const hit = index.get(src) && index.get(src).get(name);
      if (hit) return hit;
    }
    return null;
  };

  let created = 0, updated = 0, missing = 0;
  for (const token of flatten(tokens)) {
    const target = resolve(refToName(token.value));
    if (!target) {
      log.push(`⚠️ ${layer.key}: fehlt ${refToName(token.value)} (für ${token.path})`);
      missing++;
      continue;
    }
    let v = own.get(token.path);
    if (v) updated++;
    else { v = figma.variables.createVariable(token.path, col, target.resolvedType); created++; }
    v.setValueForMode(modeId, figma.variables.createVariableAlias(target));
    v.scopes = scopesFor(token.path);
  }
  log.push(`${layer.key}: ${created} neu, ${updated} aktualisiert, ${missing} fehlend`);
}

async function importTextStyles(defs, log) {
  const { index } = await indexVariables();
  const prim = index.get('Primitives') || new Map();
  const styles = await figma.getLocalTextStylesAsync();
  let created = 0, updated = 0;
  for (const [name, def] of Object.entries(defs)) {
    const refs = { family: def.family, weight: def.weight, size: def.size, lineHeight: def.lineHeight };
    const vars = {};
    const missing = [];
    for (const [k, ref] of Object.entries(refs)) {
      vars[k] = prim.get(refToName(ref));
      if (!vars[k]) missing.push(refToName(ref));
    }
    if (missing.length) { log.push(`⚠️ Text Style ${name}: fehlt ${missing.join(', ')}`); continue; }

    const first = (v) => v.valuesByMode[Object.keys(v.valuesByMode)[0]];
    const fontName = { family: first(vars.family), style: WEIGHT_TO_STYLE[first(vars.weight)] || 'Regular' };
    try { await figma.loadFontAsync(fontName); }
    catch (e) { log.push(`⚠️ Font nicht verfügbar: ${fontName.family} ${fontName.style}`); continue; }

    let style = styles.find((s) => s.name === name);
    if (style) updated++;
    else { style = figma.createTextStyle(); style.name = name; created++; }
    style.fontName = fontName;
    for (const [field, v] of [['fontFamily', vars.family], ['fontSize', vars.size], ['lineHeight', vars.lineHeight], ['fontWeight', vars.weight]]) {
      try { style.setBoundVariable(field, v); }
      catch (e) { log.push(`ℹ️ ${name}: ${field} nicht gebunden`); }
    }
  }
  log.push(`Text Styles: ${created} neu, ${updated} aktualisiert`);
}

async function importTokens(json) {
  const log = [];
  for (const layer of LAYERS) {
    if (json[layer.key]) await importLayer(layer, json[layer.key], log);
  }
  if (json.Semantic && json.Semantic.$textStyles) await importTextStyles(json.Semantic.$textStyles, log);
  return log;
}

// ---------- EXPORT: Figma Variables -> W3C design tokens (one file per collection) ----------

const toHex = ({ r, g, b, a = 1 }) => {
  const h = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b) + (a < 1 ? h(a) : '');
};
const nameToRef = (name) => '{' + name.split('/').join('.') + '}';
const slug = (s) => s.toLowerCase().replace(/\s+/g, '-');

function tokenType(v) {
  if (v.resolvedType === 'COLOR') return 'color';
  if (v.resolvedType === 'STRING') return v.name.startsWith('font/family') ? 'fontFamily' : 'string';
  if (v.resolvedType === 'FLOAT') return v.name.startsWith('font/weight') ? 'fontWeight' : 'dimension';
  return 'string';
}

function formatValue(raw, type, byId) {
  if (raw && raw.type === 'VARIABLE_ALIAS') {
    const target = byId.get(raw.id);
    return target ? nameToRef(target.name) : null;
  }
  if (type === 'color') return toHex(raw);
  if (type === 'dimension') return raw + 'px';
  return raw;
}

function setPath(obj, path, leaf) {
  let node = obj;
  path.slice(0, -1).forEach((k) => (node = node[k] = node[k] || {}));
  node[path[path.length - 1]] = leaf;
}

async function exportTokens() {
  const cols = await figma.variables.getLocalVariableCollectionsAsync();
  const vars = await figma.variables.getLocalVariablesAsync();
  const byId = new Map(vars.map((v) => [v.id, v]));
  const files = {};
  const log = [];

  for (const col of cols) {
    const tree = {};
    let count = 0;
    for (const v of vars.filter((x) => x.variableCollectionId === col.id)) {
      const type = tokenType(v);
      const value = formatValue(v.valuesByMode[col.defaultModeId], type, byId);
      if (value === null) { log.push(`⚠️ ${v.name}: Alias-Ziel nicht gefunden`); continue; }
      setPath(tree, v.name.split('/'), { $type: type, $value: value });
      count++;
    }
    files[`tokens/${slug(col.name)}.json`] = tree;
    log.push(`${col.name}: ${count} Tokens`);
  }

  // Text styles -> composite typography tokens (references to font variables)
  const styles = await figma.getLocalTextStylesAsync();
  if (styles.length) {
    const typo = {};
    const ref = (s, field, fallback) => {
      const b = s.boundVariables && s.boundVariables[field];
      const target = b && byId.get(b.id);
      return target ? nameToRef(target.name) : fallback;
    };
    for (const s of styles) {
      const lh = s.lineHeight && s.lineHeight.unit === 'PIXELS' ? s.lineHeight.value + 'px' : 'normal';
      setPath(typo, s.name.split('/').map(slug), {
        $type: 'typography',
        $value: {
          fontFamily: ref(s, 'fontFamily', s.fontName.family),
          fontWeight: ref(s, 'fontWeight', s.fontName.style),
          fontSize: ref(s, 'fontSize', s.fontSize + 'px'),
          lineHeight: ref(s, 'lineHeight', lh),
        },
      });
    }
    files['tokens/typography.json'] = { typography: typo };
    log.push(`Text Styles: ${styles.length} Typography Tokens`);
  }
  return { files, log };
}

// ---------- Messages ----------

figma.ui.onmessage = async (msg) => {
  try {
    if (msg.type === 'import') {
      const log = await importTokens(JSON.parse(msg.json));
      figma.ui.postMessage({ type: 'done', log });
      figma.notify('✅ Tokens importiert');
    }
    if (msg.type === 'export') {
      const { files, log } = await exportTokens();
      figma.ui.postMessage({ type: 'export-files', files, log });
    }
    if (msg.type === 'load-settings') {
      figma.ui.postMessage({ type: 'settings', settings: (await figma.clientStorage.getAsync('github')) || {} });
    }
    if (msg.type === 'save-settings') {
      await figma.clientStorage.setAsync('github', msg.settings);
    }
    if (msg.type === 'notify') figma.notify(msg.text);
  } catch (e) {
    figma.ui.postMessage({ type: 'done', log: ['❌ Fehler: ' + e.message] });
  }
};
