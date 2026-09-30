# Builds ui.html: injects the token JSON (Semantic + Component) into the template.
import json, html, pathlib
root = pathlib.Path(__file__).parent
sem = json.loads((root / 'import/semantic.json').read_text())
comp = json.loads((root / 'import/component.json').read_text())
tokens = json.dumps({"Semantic": sem, "Component": comp}, indent=2, ensure_ascii=False)
tpl = (root / 'src/ui.template.html').read_text()
(root / 'ui.html').write_text(tpl.replace('__TOKENS__', html.escape(tokens)))
print('ui.html built')
