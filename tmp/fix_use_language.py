"""
Add missing `useLanguage` import and `const { t } = useLanguage()` hook
to every .tsx file that calls t('ui.xxx') but doesn't have the hook set up.
"""
import re, os

def fix_file(fpath: str) -> bool:
    content = open(fpath, encoding='utf-8').read()
    original = content

    has_ui_t = bool(re.search(r"t\('ui\.", content))
    if not has_ui_t:
        return False

    has_import = 'useLanguage' in content
    has_dest = bool(re.search(r'const\s*\{[^}]*\bt\b[^}]*\}\s*=\s*useLanguage', content))

    if has_import and has_dest:
        return False  # Already fixed

    # ── Step 1: Add import ────────────────────────────────────────────────────
    if not has_import:
        # Find last import line
        import_lines = [(m.start(), m.end()) for m in re.finditer(r'^import .+;$', content, re.MULTILINE)]
        if import_lines:
            last_import_end = import_lines[-1][1]
            content = (
                content[:last_import_end]
                + "\nimport { useLanguage } from '@/contexts/LanguageContext';"
                + content[last_import_end:]
            )
        else:
            content = "import { useLanguage } from '@/contexts/LanguageContext';\n" + content
    elif not has_dest:
        # Has import but useLanguage not destructured with t
        # Check if it's already imported but maybe as something else - just add new import
        if 'useLanguage' not in content:
            import_lines = [(m.start(), m.end()) for m in re.finditer(r'^import .+;$', content, re.MULTILINE)]
            if import_lines:
                last_import_end = import_lines[-1][1]
                content = (
                    content[:last_import_end]
                    + "\nimport { useLanguage } from '@/contexts/LanguageContext';"
                    + content[last_import_end:]
                )

    # ── Step 2: Add const { t } = useLanguage(); inside component ────────────
    if not has_dest:
        # Find the first exported function/component body
        # Look for: export function/const Xxx = () => { or export default function
        # Try to find the right place: after first use of useState/useEffect/useNavigate/useAuth
        # Or just after the opening of the first exported function

        # Find existing hook calls and insert after the last one in the first function
        # Strategy: find 'export function' or 'export const' that defines the component
        # then find a good insertion point

        # Find first hook-like line (use*) in the component body
        # Pattern: lines starting with '  const ... = use'
        hook_pattern = re.compile(r'(  const \{[^}]+\} = use[A-Za-z]+\([^)]*\);)', re.MULTILINE)

        # Find all hook declarations
        hooks = list(hook_pattern.finditer(content))

        if hooks:
            # Insert after the last existing hook call
            last_hook = hooks[-1]
            insert_pos = last_hook.end()
            content = (
                content[:insert_pos]
                + "\n  const { t } = useLanguage();"
                + content[insert_pos:]
            )
        else:
            # Fallback: find the component's opening brace
            # Look for: export function ComponentName( or export const ComponentName = (
            comp_match = re.search(
                r'export\s+(?:default\s+)?(?:function|const)\s+\w+[^{]*\{',
                content
            )
            if comp_match:
                insert_pos = comp_match.end()
                content = (
                    content[:insert_pos]
                    + "\n  const { t } = useLanguage();"
                    + content[insert_pos:]
                )

    if content != original:
        open(fpath, 'w', encoding='utf-8').write(content)
        return True
    return False


# ── Run on all pages and components ──────────────────────────────────────────
dirs = ['src/pages', 'src/components']
fixed = []

for d in dirs:
    for fname in sorted(os.listdir(d)):
        if not fname.endswith('.tsx'):
            continue
        fpath = os.path.join(d, fname)
        if fix_file(fpath):
            fixed.append(fpath)
            print(f'  Fixed: {fpath}')

print(f'\nTotal fixed: {len(fixed)} files')
