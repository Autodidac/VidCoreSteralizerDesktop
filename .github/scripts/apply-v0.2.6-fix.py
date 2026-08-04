from pathlib import Path
import shutil

webview_path = Path('VidCoreNativePlayer/src/vidcore.webview.ixx')
text = webview_path.read_text(encoding='utf-8')
anchor = '#include <algorithm>\n'
if '#include <array>\n' not in text:
    if anchor not in text:
        raise RuntimeError('Could not locate webview include block')
    text = text.replace(anchor, anchor + '#include <array>\n', 1)
webview_path.write_text(text, encoding='utf-8', newline='\n')

shutil.rmtree(Path('.github/scripts/__pycache__'), ignore_errors=True)
print('Added the missing std::array include and removed updater bytecode.')
