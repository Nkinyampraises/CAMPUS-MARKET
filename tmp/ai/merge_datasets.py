"""
Merges all existing datasets into fine_tune_train_sasha.jsonl.
Converts all entries to the Sasha JSON response format.
"""
import json, re

SASHA_SYS = (
    "You are Sasha, a smart AI assistant for Campus Market — a student marketplace platform in Cameroon. "
    "You answer ANY question on any topic AND help with marketplace recommendations. "
    "Always return valid JSON: {intent, assistant_message, recommended_item_ids, "
    "recommendation_reasons, style_plan, kitchen_list, budget_breakdown, next_questions}"
)

def wrap_as_sasha_json(intent, message_text):
    """Wrap a plain-text assistant answer into the Sasha JSON format."""
    text = message_text.strip()
    # Derive 2 follow-up questions from the intent
    nq_map = {
        "buyer_guide":              ["Are there similar items on Campus Market?", "What is your budget?"],
        "product_recommendation":   ["What city are you in?", "What is your budget?"],
        "shopping_plan":            ["Do you prefer new or second-hand?", "What city are you in?"],
        "student_advice":           ["What else can I help you with?", "Help me find something on Campus Market"],
        "platform_help":            ["What else would you like to know about Campus Market?", "How can I help you find something?"],
    }
    nq = nq_map.get(intent, ["What else can I help you with?", "How can I help you find something?"])
    return json.dumps({
        "intent": intent,
        "assistant_message": text,
        "recommended_item_ids": [],
        "recommendation_reasons": {},
        "style_plan": None,
        "kitchen_list": None,
        "budget_breakdown": None,
        "next_questions": nq,
    })

# ── QUALITY FILTERS ────────────────────────────────────────────────────────────

GENERIC_PHRASES = [
    "most suitable for shoppers who need this category item at around Price not listed",
    "The listing provides basic product metadata and category context",
    "Feature details are limited; verify specs on the product page",
]

def is_good_quality(answer_text):
    """Return True if the answer has real informational value."""
    text = answer_text.strip()
    # Too short
    if len(text) < 80:
        return False
    # Count how many generic boilerplate phrases appear
    generic_count = sum(1 for p in GENERIC_PHRASES if p in text)
    # If the answer is mostly boilerplate (2+ phrases and short), skip it
    if generic_count >= 2 and len(text) < 400:
        return False
    return True

# ── LOAD ALL SOURCES ───────────────────────────────────────────────────────────

def load_messages_jsonl(path):
    entries = []
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            d = json.loads(line)
            if 'messages' in d:
                entries.append(d['messages'])
    return entries

# Source files and the intent we'll assign them
SOURCES = [
    # (file, intent, include_all)
    ('tmp/ai/fine_tune_train_amazon.jsonl',         'buyer_guide',          False),  # filtered
    ('tmp/ai/fine_tune_validation_amazon.jsonl',    'buyer_guide',          False),  # filtered
    ('tmp/ai/fine_tune_train_multi_assistant.jsonl','product_recommendation', True), # all good
    ('tmp/ai/fine_tune_train_marketplace.jsonl',    'shopping_plan',         True),  # all good
]

# ── PROCESS AND CONVERT ────────────────────────────────────────────────────────

merged = []
stats = {}

for path, intent, include_all in SOURCES:
    source_entries = load_messages_jsonl(path)
    accepted = skipped = 0
    for msgs in source_entries:
        # Extract user and assistant messages
        user_msg = next((m['content'] for m in msgs if m['role'] == 'user'), '')
        asst_msg = next((m['content'] for m in msgs if m['role'] == 'assistant'), '')

        if not user_msg or not asst_msg:
            skipped += 1
            continue

        # Apply quality filter for Amazon data
        if not include_all and not is_good_quality(asst_msg):
            skipped += 1
            continue

        # Build the new Sasha-format entry
        new_entry = json.dumps({
            "messages": [
                {"role": "system",    "content": SASHA_SYS},
                {"role": "user",      "content": user_msg},
                {"role": "assistant", "content": wrap_as_sasha_json(intent, asst_msg)},
            ]
        })
        merged.append(new_entry)
        accepted += 1

    stats[path] = {'accepted': accepted, 'skipped': skipped, 'total': len(source_entries)}

# ── APPEND TO SASHA DATASET ────────────────────────────────────────────────────

output_path = 'tmp/ai/fine_tune_train_sasha.jsonl'
with open(output_path, 'a', encoding='utf-8') as f:
    for line in merged:
        f.write(line + '\n')

# ── FINAL VALIDATION ───────────────────────────────────────────────────────────

total_ok = total_err = 0
intent_counts = {}
with open(output_path, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        line = line.strip()
        if not line:
            continue
        try:
            d = json.loads(line)
            asst_content = d['messages'][2]['content']
            asst_json = json.loads(asst_content)
            intent = asst_json.get('intent', 'unknown')
            intent_counts[intent] = intent_counts.get(intent, 0) + 1
            total_ok += 1
        except Exception as ex:
            total_err += 1
            print(f'  BAD line {i+1}: {ex}')

# ── REPORT ─────────────────────────────────────────────────────────────────────

print('\n' + '='*55)
print('MERGE REPORT')
print('='*55)
print(f'\nSources processed:')
for path, s in stats.items():
    name = path.split('/')[-1]
    print(f'  {name:<45} accepted={s["accepted"]:3d}  skipped={s["skipped"]:3d}  total={s["total"]:3d}')

print(f'\nTotal lines appended: {sum(s["accepted"] for s in stats.values())}')
print(f'\nFINAL DATASET:')
print(f'  Total examples : {total_ok}')
print(f'  Errors         : {total_err}')
print(f'\nINTENT BREAKDOWN:')
for k, v in sorted(intent_counts.items(), key=lambda x: -x[1]):
    bar = '█' * (v // 2)
    print(f'  {v:3d}  {k:<30} {bar}')
