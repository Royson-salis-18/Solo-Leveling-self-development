import re

with open('web/src/pages/DashboardPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'(\s+)(//.*?Clean up duplicate system gates.*?)(\s+await SystemAPI\.cleanupDuplicateSystemGates\(userId\);.*?await SystemAPI\.manifestWeeklyTrial\(userId\);.*?)(//.*?Category Nudge check.*?)(\s+const NUDGE_KEY.*?localStorage\.setItem\(NUDGE_KEY, Date\.now\(\)\.toString\(\)\);\s+\})', re.DOTALL)

def replacer(match):
    indent = match.group(1)
    comment1 = match.group(2)
    code1 = match.group(3)
    comment2 = match.group(4)
    code2 = match.group(5)
    
    return f'''{indent}// -- FLOW SYSTEM: Maintenance Operations --
{indent}// Wrapped in try-catch to prevent 409 Conflict (race conditions) from crashing the Dashboard load.
{indent}try {{{indent}  {comment1}{code1}{indent}  {comment2}{code2}
{indent}}} catch (maintenanceErr) {{
{indent}  console.warn("System maintenance non-fatal error:", maintenanceErr);
{indent}}}'''

new_content, count = pattern.subn(replacer, content)

if count > 0:
    with open('web/src/pages/DashboardPage.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Replaced {count} instances.")
else:
    print("Pattern not found!")
