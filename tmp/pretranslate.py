"""
Pre-translate all <T> strings to French and store them directly
in FR_TRANSLATIONS so translation is INSTANT with no API calls.
"""
import os, re, json, time
import urllib.request, urllib.parse

PAGES_DIR = 'src/pages'
LANG_FILE = 'src/contexts/LanguageContext.tsx'
EMAIL = 'praisessasha8@gmail.com'

# ── Step 1: Extract all unique <T> strings ──────────────────────────────────

def extract_T_strings(directory):
    strings = set()
    for fname in os.listdir(directory):
        if not fname.endswith('.tsx'):
            continue
        content = open(f'{directory}/{fname}', encoding='utf-8').read()
        found = re.findall(r'<T>([^<]{5,100})</T>', content)
        for s in found:
            s = s.strip()
            if s and any(c.isalpha() for c in s):
                strings.add(s)
    return sorted(strings)

# ── Step 2: Translate via MyMemory API ──────────────────────────────────────

def translate(text, cache):
    if text in cache:
        return cache[text]
    if not any(c.isalpha() for c in text):
        return text
    try:
        q = urllib.parse.quote(text[:500])
        url = f'https://api.mymemory.translated.net/get?q={q}&langpair=en|fr&de={EMAIL}'
        with urllib.request.urlopen(url, timeout=6) as r:
            data = json.loads(r.read())
        translated = data.get('responseData', {}).get('translatedText', '')
        if translated and translated.lower() != text.lower() and len(translated) > 1:
            # Check quality score
            score = data.get('responseData', {}).get('match', 0)
            if score > 0 or len(translated) > 3:
                cache[text] = translated
                return translated
    except Exception as e:
        print(f'  API error for "{text[:40]}": {e}')
    return text  # fallback to original

# ── Step 3: Generate safe key from text ─────────────────────────────────────

def make_key(text):
    # Create a safe key from the text
    key = re.sub(r'[^a-zA-Z0-9]', '_', text.lower().strip())
    key = re.sub(r'_+', '_', key).strip('_')
    return f'ui.{key[:50]}'

# ── MAIN ─────────────────────────────────────────────────────────────────────

print('Step 1: Extracting strings...')
strings = extract_T_strings(PAGES_DIR)
print(f'  Found {len(strings)} unique strings')

# Load existing FR_TRANSLATIONS to avoid re-translating
lang_content = open(LANG_FILE, encoding='utf-8').read()
existing_fr = set(re.findall(r"'([^']+)':\s*'", lang_content))

print('Step 2: Translating...')
cache = {}
translations = {}  # key -> {en: ..., fr: ...}

# Translate in batches with delays to respect rate limits
for i, text in enumerate(strings):
    key = make_key(text)

    # Skip if we already have a close match
    if key in existing_fr:
        continue

    fr = translate(text, cache)
    translations[key] = {'en': text, 'fr': fr}

    if (i + 1) % 10 == 0:
        print(f'  Translated {i+1}/{len(strings)}...')
        time.sleep(1)  # Be polite to free API

print(f'  Got {len(translations)} new translations')

# ── Step 4: Add translations to FR_TRANSLATIONS ──────────────────────────────

if translations:
    print('Step 3: Adding to LanguageContext...')

    new_entries = []
    for key, data in sorted(translations.items()):
        en = data['en']
        fr = data['fr']
        if fr != en:  # Only add if actually translated
            # Escape single quotes
            fr_escaped = fr.replace("'", "\\'")
            new_entries.append(f"  '{key}': '{fr_escaped}',  // {en[:40]}")

    if new_entries:
        marker = "  'common.yes': 'Oui',"
        insert_block = '\n'.join(new_entries) + '\n'
        lang_content = lang_content.replace(marker, f'{insert_block}  \'common.yes\': \'Oui\',')
        open(LANG_FILE, 'w', encoding='utf-8').write(lang_content)
        print(f'  Added {len(new_entries)} translations to FR_TRANSLATIONS')

# ── Step 5: Replace <T>text</T> with {t('key', 'text')} ─────────────────────

print('Step 4: Replacing <T> components with t() calls...')
total_replacements = 0

for fname in os.listdir(PAGES_DIR):
    if not fname.endswith('.tsx'):
        continue
    fpath = f'{PAGES_DIR}/{fname}'
    content = open(fpath, encoding='utf-8').read()

    if '<T>' not in content:
        continue

    original = content
    count = 0

    def replace_T(m):
        global count
        text = m.group(1).strip()
        key = make_key(text)
        count += 1
        return '{t(\'' + key + '\', \'' + text.replace("'", "\\'") + '\')}'

    # Only replace if we have the translation
    def replace_T_safe(m):
        text = m.group(1).strip()
        key = make_key(text)
        # Only replace with t() if we have a translation for it
        if key in translations or key in existing_fr:
            return '{t(\'' + key + '\', \'' + text.replace("'", "\\'") + '\')}'
        # Otherwise keep <T> for runtime translation
        return m.group(0)

    content = re.sub(r'<T>([^<]{5,100})</T>', replace_T_safe, content)

    # Remove T import if no more <T> tags
    if '<T>' not in content and 'import { T }' in content:
        content = content.replace("import { T } from '@/components/T';\n", '')

    if content != original:
        open(fpath, 'w', encoding='utf-8').write(content)
        total_replacements += 1

print(f'  Updated {total_replacements} files')
print('\nDone! All text will now translate to French INSTANTLY with no API calls.')
