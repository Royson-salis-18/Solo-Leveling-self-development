/**
 * ORACLE SERVICE (The Gemini AI Integration)
 * 
 * Supports two modes:
 * - 'short': For the floating Auditor (small talk, quick solutions).
 * - 'long': For the Architect section in the Guide page (deep analysis).
 */

export const OracleService = {
  consult: async (query: string, context: any, mode: 'short' | 'long' = 'short') => {
    const API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || "AIzaSyCsPK5Sh8PXlJ_B3UHeLBFPi02NtMhpIfs").trim();
    const MODEL = "gemini-flash-latest"; 
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

    const shortPrompt = `
      You are the [SYSTEM AUDITOR]. Be EXTREMELY CONCISE (1-2 sentences). 
      Give a direct solution or small talk. Keep it brief.
      Context: Debt ${context.player_stats?.total_points < 0 ? Math.abs(context.player_stats.total_points) : 0} XP, Gates ${context.active_gates.length}.
    `;

    const KNOWLEDGE_BASE = `
      SOLO LEVELING LORE:
      - You are the Architect, creator of the System to find a vessel for the Shadow Monarch.
      - Terminology: Mana (Energy), XP (Experience), Gates (Dungeons/Tasks), Arise (Extraction).
      
      WEBSITE FUNCTIONS:
      - Dashboard: "Monarch's Vision". Shows resonance radar and status.
      - War Room: "Tactical Hub". Interactive grid to view shadows and hunters.
      - Dungeon Gates: "The Field". Where users manage tasks. High-tier gates give more XP.
      - Collection: "Shadow Army". Where extracted shadows (completed high-tier tasks) are managed.
      - Arena/Leaderboard: "Hunter Rankings". Compete for the title of National Level Hunter.
      - Guide: "Cartenon Temple". Contains the fundamental rules.
    `;

    const longPrompt = `
      You are the [SYSTEM ARCHITECT]. 
      
      ${KNOWLEDGE_BASE}

      LOGIC:
      - If the user asks a simple question, answer in 1-2 SHORT sentences.
      - If the user asks for "analysis", "evaluation", "report", or "help", provide a DEEP TACTICAL ANALYSIS.
      - You can explain how to use the website using the lore (e.g. "To extract a shadow, you must first clear a High-rank gate in the Dungeon Field").
      
      STRICT FORMATTING:
      - Do NOT use raw markdown like "**text**" or "###". Use plain text but separate sections with double newlines.
      - Use uppercase for titles like "STATUS EVALUATION".
      
      Context: Level ${context.player_stats?.level}, Gates ${context.active_gates.length}.
    `;

    const systemPrompt = `
      ${mode === 'short' ? shortPrompt : longPrompt}
      USER QUERY: "${query}"
    `;

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }]
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(`API Error ${response.status}: ${errJson.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "System silence.";

    } catch (err: any) {
      console.error("AUDITOR ERROR:", err);
      return `[SYSTEM ERROR] ${err.message}.`;
    }
  }
};
