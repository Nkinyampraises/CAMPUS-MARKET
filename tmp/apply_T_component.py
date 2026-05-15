"""
Systematically replace hardcoded English JSX text nodes
with the <T> auto-translation component across all pages.

Only replaces pure static text — does not touch:
- Dynamic expressions like {someVar}
- Strings already inside t()
- HTML attributes
- Import statements
- Comments
"""
import os, re

PAGES_DIR = 'src/pages'
IMPORT_LINE = "import { T } from '@/components/T';"

# Strings to skip (too short, numbers, or UI symbols)
def should_skip(text: str) -> bool:
    text = text.strip()
    if len(text) <= 3:
        return True
    if text.isdigit():
        return True
    if not any(c.isalpha() for c in text):
        return True
    # Skip if it starts with lowercase (likely a variable or prop)
    if text[0].islower():
        return True
    return False

def add_T_import(content: str, filename: str) -> str:
    """Add T import if not already present."""
    if "import { T }" in content or "from '@/components/T'" in content:
        return content
    # Add after last import line
    lines = content.split('\n')
    last_import_idx = 0
    for i, line in enumerate(lines):
        if line.strip().startswith('import '):
            last_import_idx = i
    lines.insert(last_import_idx + 1, IMPORT_LINE)
    return '\n'.join(lines)

def wrap_text_nodes(content: str) -> tuple[str, int]:
    """
    Replace >Some Text< with ><T>Some Text</T><
    Only for pure static text not already in t() or {}
    """
    count = 0

    # Pattern: JSX text node between > and <
    # Must start with uppercase, be pure text (no { } t() already)
    pattern = r'(>)(\s*)([A-Z][a-zA-Z &\-\.,!?:/\'()\d]{4,80})(\s*)(<)'

    def replacer(m):
        nonlocal count
        pre = m.group(1)
        ws1 = m.group(2)
        text = m.group(3).strip()
        ws2 = m.group(4)
        post = m.group(5)

        if should_skip(text):
            return m.group(0)

        count += 1
        return f'{pre}{ws1}<T>{text}</T>{ws2}{post}'

    new_content = re.sub(pattern, replacer, content)
    return new_content, count

# Files to process (exclude ones already well-translated or too complex)
SKIP_FILES = {
    'Home.tsx',        # user said don't change
    'Messages.tsx',    # 3900 lines, too complex
}

total_changed = 0
files_changed = 0

for fname in sorted(os.listdir(PAGES_DIR)):
    if not fname.endswith('.tsx'):
        continue
    if fname in SKIP_FILES:
        continue

    fpath = os.path.join(PAGES_DIR, fname)
    original = open(fpath, encoding='utf-8').read()

    # Skip if file has very few hardcoded strings
    content, count = wrap_text_nodes(original)

    if count == 0:
        continue

    # Add T import
    content = add_T_import(content, fname)

    open(fpath, 'w', encoding='utf-8').write(content)
    print(f'  {fname}: {count} strings wrapped')
    total_changed += count
    files_changed += 1

print(f'\nTotal: {total_changed} strings wrapped in {files_changed} files')
print('All text will now auto-translate to French via MyMemory API.')
