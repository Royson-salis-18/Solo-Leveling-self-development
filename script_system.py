import re

with open('web/src/services/SystemAPI.ts', 'r', encoding='windows-1252') as f:
    content = f.read()

target = '''    const normalizedPts = calculateEffectiveXp(task.points, task.category, currentTotalXp) * config.xpMultiplier * zoneMult * egoMult * devourMult;
    const pts = (await applyXpBoost(s, userId, normalizedPts)) + ariseBonus;

    const statColumn = CATEGORY_STAT_MAP[task.category];
    const updatePayload: any = { 
      total_points: (prof?.total_points ?? 0) + pts,
      status: prof?.status === "DECEASED" ? "ACTIVE" : prof?.status // Restore status if ARISE
    };'''

replacement = '''    const normalizedPts = calculateEffectiveXp(task.points, task.category, currentTotalXp) * config.xpMultiplier * zoneMult * egoMult * devourMult;
    const pts = (await applyXpBoost(s, userId, normalizedPts)) + ariseBonus;

    const statColumn = CATEGORY_STAT_MAP[task.category];
    
    // Dopamine Hole (Dark Mana) resolution: Clear debt before increasing baseline
    let actualPts = pts;
    let currentDM = prof?.dark_mana || 0;
    if (currentDM > 0) {
      if (actualPts >= currentDM) {
        actualPts -= currentDM;
        currentDM = 0;
      } else {
        currentDM -= actualPts;
        actualPts = 0;
      }
    }

    const updatePayload: any = { 
      total_points: (prof?.total_points ?? 0) + actualPts,
      dark_mana: currentDM,
      status: prof?.status === "DECEASED" ? "ACTIVE" : prof?.status // Restore status if ARISE
    };
    if (currentDM === 0 && (prof?.dark_mana || 0) > 0) {
      updatePayload.dark_mana_started_at = null;
    }'''

if target in content:
    content = content.replace(target, replacement)
    with open('web/src/services/SystemAPI.ts', 'w', encoding='windows-1252') as f:
        f.write(content)
    print("Replaced successfully")
else:
    print("Target not found")
