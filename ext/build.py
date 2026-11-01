#!/usr/bin/env python3
"""Gera pacotes prontos para as lojas: dist/urna-guard-chrome-<v>.zip (Chrome Web Store / Edge Add-ons)
e dist/urna-guard-firefox-<v>.zip (addons.mozilla.org). Manifest na raiz; sem testes/e2e."""
import json, os, zipfile
ROOT = os.path.dirname(os.path.abspath(__file__))
m = json.load(open(os.path.join(ROOT, 'manifest.json'), encoding='utf-8'))
v = m['version']
FILES = ['src', 'icons', '_locales']
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)

def pack(name, manifest):
    out = os.path.join(ROOT, 'dist', name)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('manifest.json', json.dumps(manifest, ensure_ascii=False, indent=2))
        for d in FILES:
            for base, _, files in os.walk(os.path.join(ROOT, d)):
                for f in sorted(files):
                    p = os.path.join(base, f)
                    z.write(p, os.path.relpath(p, ROOT))
        z.write(os.path.join(ROOT, 'README.md'), 'README.md')
    print(out)

pack(f'urna-guard-chrome-{v}.zip', m)
ff = json.loads(json.dumps(m))
ff['background'] = {'scripts': ['src/background.js']}
ff['browser_specific_settings'] = {'gecko': {'id': 'urna-guard@urnaguard.local', 'strict_min_version': '142.0',
                                             'data_collection_permissions': {'required': ['none']}}, 'gecko_android': {'strict_min_version': '142.0'}}
ff['content_security_policy'] = {'extension_pages': "script-src 'self'; object-src 'self'"}
pack(f'urna-guard-firefox-{v}.zip', ff)
