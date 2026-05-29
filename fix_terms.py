import os
import glob

replacements = {
    "L-XP": "XP",
    "Dopamine Hole": "Dark Mana",
    "Dopamine Debt": "Dark Mana debt",
    "dopamine debt": "Dark Mana debt",
    "Dopamine": "Dark Mana",
    "dopamine": "Dark Mana"
}

# specific fixes to avoid breaking logic variables or UI
# But wait, dopamine is a word. I should probably just replace L-XP and Dopamine Hole / Debt, not the raw word dopamine, because it might replace standard words in comments, or worse, if the previous agent did it blindly, I should just do L-XP and Dopamine Hole/Debt.
# Actually, the user specifically mentioned "revert the L-XP and Dopamine Hole terminology". 
# Let's see what exactly was replaced.

def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content = content.replace("L-XP", "XP")
        new_content = new_content.replace("l-xp", "xp")
        new_content = new_content.replace("Dopamine Hole", "Dark Mana")
        new_content = new_content.replace("dopamine hole", "Dark Mana")
        new_content = new_content.replace("Dopamine Debt", "Dark Mana debt")
        new_content = new_content.replace("dopamine debt", "Dark Mana debt")
        
        if content != new_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated {filepath}")
    except Exception as e:
        print(f"Failed {filepath}: {e}")

for root, dirs, files in os.walk('web/src'):
    for file in files:
        if file.endswith('.ts') or file.endswith('.tsx'):
            process_file(os.path.join(root, file))
