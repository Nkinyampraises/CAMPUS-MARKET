"""Fix unescaped apostrophes in FR_TRANSLATIONS that break JS parsing."""
import re

content = open('src/contexts/LanguageContext.tsx', encoding='utf-8').read()

# Find the FR_TRANSLATIONS block boundaries
start_marker = 'const FR_TRANSLATIONS'
end_marker = '\n};\n'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx) + len(end_marker)

before = content[:start_idx]
fr_block = content[start_idx:end_idx]
after = content[end_idx:]

# Fix each line in the block
lines = fr_block.split('\n')
fixed_count = 0
new_lines = []

for line in lines:
    # Match translation value lines: '  'some.key': 'value here','
    # The value is between the second ': ' and the trailing ','
    if "': '" in line and line.strip().startswith("'"):
        # Find the key part and value part
        # key ends at "': '"
        colon_quote = "': '"
        idx = line.find(colon_quote)
        if idx > 0:
            key_part = line[:idx + len(colon_quote)]  # everything up to and including ': '
            rest = line[idx + len(colon_quote):]       # value + suffix

            # Find trailing ', // comment or just trailing ','
            # The value ends at the LAST unescaped ' before , or end of meaningful content
            # Simple approach: find all apostrophes and check if they're properly escaped

            # Split on the trailing comma
            # Find last ', (unescaped) followed by optional comment
            last_comma = rest.rfind("',")
            if last_comma >= 0:
                value = rest[:last_comma]
                suffix = rest[last_comma:]  # ',  // comment

                # Check if value has unescaped apostrophes (not preceded by backslash)
                # Replace unescaped ' with \'
                new_value = ''
                i = 0
                changed = False
                while i < len(value):
                    if value[i] == "'" and (i == 0 or value[i-1] != '\\'):
                        new_value += "\\'"
                        changed = True
                    else:
                        new_value += value[i]
                    i += 1

                if changed:
                    line = key_part + new_value + suffix
                    fixed_count += 1

    new_lines.append(line)

new_fr_block = '\n'.join(new_lines)
new_content = before + new_fr_block + after

open('src/contexts/LanguageContext.tsx', 'w', encoding='utf-8').write(new_content)
print(f'Fixed {fixed_count} lines with unescaped apostrophes')

# Verify the fix works
verify_content = open('src/contexts/LanguageContext.tsx', encoding='utf-8').read()
start_idx2 = verify_content.find(start_marker)
end_idx2 = verify_content.find(end_marker, start_idx2) + len(end_marker)
block_to_test = verify_content[start_idx2:end_idx2]
block_js = block_to_test.replace(': Record<string, string>', '')

try:
    import ast
    # Try evaluating as Python dict (similar structure)
    print('Validation: checking for obvious issues...')
    # Count quotes to see if they balance
    single_quotes = block_to_test.count("'") - block_to_test.count("\\'")
    print(f'Quote balance check: {single_quotes} unescaped single quotes (should be even)')
    if single_quotes % 2 == 0:
        print('OK - quote count is even')
    else:
        print('WARNING - odd number of quotes, may have issue')
except Exception as e:
    print(f'Validation error: {e}')
