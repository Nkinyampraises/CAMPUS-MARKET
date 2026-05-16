"""
Fix t() calls where the fallback text is French instead of English.
Uses MyMemory API to translate French fallbacks back to English,
then updates FR_TRANSLATIONS with the French text under the correct key.
"""
import re, os, json, urllib.request, urllib.parse, time

FRENCH_INDICATORS = [
    'de ', 'du ', 'des ', 'les ', 'mes ', 'mon ', 'ma ', 'sur ', 'au ', 'aux ',
    'en attente', 'tableau', 'bord', 'commande', 'annonce', 'retour', 'gerer',
    'modifier', 'supprimer', 'ajouter', 'afficher', 'voir', 'aucun', 'nouveau',
    'nouvelle', 'parametres', 'acheteur', 'vendeur', 'livraison', 'paiement',
    'statut', 'souhait', 'article', 'liste', 'toutes', 'toutes les', 'flux',
    'confirmation', 'bienvenue', 'compte', 'profil', 'connexion', 'inscription'
]

def looks_french(text: str) -> bool:
    lower = text.lower()
    return any(ind in lower for ind in FRENCH_INDICATORS)

def translate_to_english(french_text: str) -> str:
    """Translate French text to English using MyMemory API."""
    try:
        url = (
            'https://api.mymemory.translated.net/get?q='
            + urllib.parse.quote(french_text)
            + '&langpair=fr|en&de=praisessasha8@gmail.com'
        )
        with urllib.request.urlopen(url, timeout=5) as r:
            data = json.loads(r.read())
        translated = data.get('responseData', {}).get('translatedText', '')
        if translated and translated != french_text:
            return translated
    except Exception as e:
        print(f'    API error: {e}')
    return french_text  # fallback: return as-is

# ── Scan all pages/components ─────────────────────────────────────────────────
dirs = ['src/pages', 'src/components']
# Pattern: t('ui.key', 'fallback text here')
PATTERN = re.compile(r"(t\('(ui\.[^']+)',\s*)'([^']+)'(\))")

total_fixed = 0
lang_updates = {}  # key -> French text for updating FR_TRANSLATIONS

for d in dirs:
    for fname in sorted(os.listdir(d)):
        if not fname.endswith('.tsx'):
            continue
        fpath = os.path.join(d, fname)
        content = open(fpath, encoding='utf-8').read()
        new_content = content
        file_fixed = 0

        for m in PATTERN.finditer(content):
            prefix = m.group(1)   # t('ui.key',
            key    = m.group(2)   # ui.key
            fallback = m.group(3) # the fallback text
            suffix = m.group(4)   # )

            if not looks_french(fallback):
                continue

            # Translate French fallback → English
            print(f'  [{fname}] Fixing: {fallback[:50]}')
            english = translate_to_english(fallback)
            time.sleep(0.3)  # be gentle with free API

            if english and english != fallback:
                old = m.group(0)
                new = f"{prefix}'{english}'{suffix}"
                new_content = new_content.replace(old, new, 1)
                lang_updates[key] = fallback  # save French text for FR_TRANSLATIONS
                file_fixed += 1
                total_fixed += 1
                print(f'    -> {english[:50]}')

        if file_fixed > 0:
            open(fpath, 'w', encoding='utf-8').write(new_content)
            print(f'  Saved {fname} ({file_fixed} fixes)')

print(f'\nTotal fallbacks fixed: {total_fixed}')

# ── Update FR_TRANSLATIONS with the French text under each key ────────────────
if lang_updates:
    print(f'\nUpdating FR_TRANSLATIONS with {len(lang_updates)} keys...')
    lang_path = 'src/contexts/LanguageContext.tsx'
    lang_content = open(lang_path, encoding='utf-8').read()

    # Find end of FR_TRANSLATIONS block to insert new entries
    end_marker = '\n};\n'
    fr_start = lang_content.find('const FR_TRANSLATIONS')
    fr_end = lang_content.find(end_marker, fr_start)

    new_entries = []
    for key, fr_text in lang_updates.items():
        # Check if key already exists
        if f"'{key}':" not in lang_content:
            fr_escaped = fr_text.replace("'", "\\'")
            new_entries.append(f"  '{key}': '{fr_escaped}',")

    if new_entries:
        insert = '\n' + '\n'.join(new_entries)
        lang_content = lang_content[:fr_end] + insert + lang_content[fr_end:]
        open(lang_path, 'w', encoding='utf-8').write(lang_content)
        print(f'  Added {len(new_entries)} new FR_TRANSLATIONS keys')

print('\nDone!')
