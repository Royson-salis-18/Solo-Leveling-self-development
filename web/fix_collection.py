content = open('src/pages/CollectionPage.tsx', 'rb').read().decode('utf-8')

new_styles = """
      <style>{`
        /* ── Collection Container ── */
        .collection-grid-v2 {
          position: relative; padding: 28px; border-radius: 20px;
          background: rgba(17, 24, 39, 0.65);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(148, 163, 184, 0.08);
          background-image: var(--bg-noise);
        }
        .army-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(175px, 1fr));
          gap: 20px;
        }
        .arsenal-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }

        /* ── Army Card — gray base, colored accent on top ── */
        .shadow-card-v2 {
          background: rgba(17, 24, 39, 0.88);
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 20px;
          padding: 28px 20px 24px;
          text-align: center;
          position: relative;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
          cursor: pointer;
        }
        .shadow-card-v2::before {
          content: '';
          position: absolute;
          top: 0; left: 16px; right: 16px; height: 2px;
          background: linear-gradient(90deg, transparent, var(--rarity-color, #5b9cf6), transparent);
          border-radius: 99px;
          opacity: 0.7;
        }
        .shadow-card-v2.locked::before { opacity: 0.15; }
        .shadow-card-v2:not(.locked):hover {
          transform: translateY(-5px);
          background: rgba(22, 32, 56, 0.95);
          border-color: var(--rarity-color, rgba(91, 156, 246, 0.4));
          box-shadow: 0 12px 28px rgba(0,0,0,0.45), 0 0 20px rgba(91,156,246,0.08);
        }

        /* Avatar circle */
        .shadow-avatar-v2 {
          width: 68px; height: 68px; border-radius: 50%; margin: 0 auto 18px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(10, 14, 26, 0.9);
          border: 1.5px solid var(--rarity-color, rgba(91,156,246,0.4));
          box-shadow: 0 0 12px rgba(0,0,0,0.6) inset, 0 0 8px var(--rarity-color, rgba(91,156,246,0.1));
          position: relative; z-index: 2;
        }
        .shadow-info { display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .shadow-name { font-size: 1.1rem; font-weight: 800; color: #f1f5f9; margin-bottom: 4px; letter-spacing: -0.01em; }
        .rarity-tag-v2 { font-size: 0.62rem; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 12px; }
        .bonus-pill {
          display: inline-flex; align-items: center; gap: 4px;
          background: rgba(52, 211, 153, 0.08); color: #34d399;
          border: 1px solid rgba(52, 211, 153, 0.2);
          padding: 3px 10px; border-radius: 99px; font-size: 0.72rem; font-weight: 800;
        }

        /* ── Arsenal / Vault items — gray + rarity stripe ── */
        .item-card-v2 {
          background: rgba(17, 24, 39, 0.82);
          border: 1px solid rgba(148, 163, 184, 0.08);
          border-radius: 16px;
          padding: 18px; display: flex; gap: 16px; position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
        }
        .item-card-v2:not(.locked):hover {
          border-color: var(--rarity-color);
          transform: translateX(4px);
          background: rgba(22, 32, 56, 0.92);
          box-shadow: 0 0 20px rgba(0,0,0,0.3);
        }
        .item-rarity-stripe {
          position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
          border-radius: 4px 0 0 4px;
          background: var(--rarity-color, #5b9cf6);
          opacity: 0.85;
        }
        .item-icon-box {
          width: 52px; height: 52px; border-radius: 12px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: rgba(10, 14, 26, 0.8); border: 1px solid rgba(148,163,184,0.1);
        }
        .item-details { flex: 1; min-width: 0; }
        .item-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .item-name-v2 { font-size: 1rem; font-weight: 800; color: #f1f5f9; }
        .rarity-label-v2 {
          font-size: 0.58rem; font-weight: 900; border: 1px solid;
          padding: 2px 7px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.08em;
        }
        .item-desc-v2 { font-size: 0.8rem; color: #64748b; line-height: 1.5; }

        .locked { opacity: 0.42; filter: grayscale(0.6); }
        .lock-icon { position: absolute; top: 12px; right: 12px; color: #475569; }
        .shadow-aura { position: relative; }
      `}</style>"""

# Insert before </section>
content = content.replace('\n    </section>\n  );\n}\n', new_styles + '\n    </section>\n  );\n}\n')
open('src/pages/CollectionPage.tsx', 'wb').write(content.encode('utf-8'))
print('done, total chars:', len(content))
