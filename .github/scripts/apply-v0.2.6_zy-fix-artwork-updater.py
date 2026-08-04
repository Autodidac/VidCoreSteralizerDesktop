from pathlib import Path

path = Path('.github/scripts/apply-v0.2.6_zz-artwork-cache.py')
text = path.read_text(encoding='utf-8')
old = '''        'const webview = fs.readFileSync(path.join(root, "src", "vidcore.webview.ixx"), "utf8");',
        'const webview = fs.readFileSync(path.join(root, "src", "vidcore.webview.ixx"), "utf8");\\nconst imageCache = fs.readFileSync(path.join(root, "src", "vidcore.image_cache.ixx"), "utf8");\\nconst cmake = fs.readFileSync(path.join(root, "CMakeLists.txt"), "utf8");','''
new = '''        'const webview = fs.readFileSync(\\n  path.join(root, "src", "vidcore.webview.ixx"),\\n  "utf8"\\n);',
        'const webview = fs.readFileSync(\\n  path.join(root, "src", "vidcore.webview.ixx"),\\n  "utf8"\\n);\\nconst imageCache = fs.readFileSync(\\n  path.join(root, "src", "vidcore.image_cache.ixx"),\\n  "utf8"\\n);\\nconst cmake = fs.readFileSync(path.join(root, "CMakeLists.txt"), "utf8");','''
if old not in text:
    raise RuntimeError('Could not repair artwork updater smoke-test anchor')
path.write_text(text.replace(old, new, 1), encoding='utf-8', newline='\n')
print('Repaired v0.2.6 artwork updater test anchor.')
