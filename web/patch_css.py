content = open('src/app.css', 'rb').read().decode('utf-8')

# Panel — blue-tinted glassmorphism
content = content.replace(
    '.panel {\r\n  background: var(--glass-1);\r\n  backdrop-filter: var(--blur-md);\r\n  -webkit-backdrop-filter: var(--blur-md);\r\n  border: 1px solid var(--border-0);\r\n  border-radius: var(--r-lg);\r\n  padding: 22px;\r\n  box-shadow: var(--shadow-md);\r\n  position: relative;\r\n  overflow: hidden;\r\n  transition: all 0.22s ease;\r\n}',
    '.panel {\n  background: rgba(17, 24, 39, 0.75);\n  backdrop-filter: blur(24px) saturate(180%);\n  -webkit-backdrop-filter: blur(24px) saturate(180%);\n  border: 1px solid rgba(91, 156, 246, 0.08);\n  border-radius: var(--r-lg);\n  padding: 22px;\n  box-shadow: var(--shadow-md);\n  position: relative;\n  overflow: hidden;\n  transition: all 0.22s ease;\n}'
)

# Panel top sheen
content = content.replace(
    'background: linear-gradient(90deg, transparent, rgba(255,255,255,0.20), transparent);',
    'background: linear-gradient(90deg, transparent, rgba(91, 156, 246, 0.12), transparent);'
)

# Panel hover
content = content.replace(
    '.panel:hover {\r\n  background: var(--glass-2);\r\n  border-color: var(--border-2);\r\n  box-shadow: 0 0 25px rgba(168,168,255,0.06), var(--shadow-lg);\r\n}',
    '.panel:hover {\n  background: rgba(22, 33, 62, 0.8);\n  border-color: rgba(91, 156, 246, 0.18);\n  box-shadow: 0 0 30px rgba(91, 156, 246, 0.07), var(--shadow-lg);\n}'
)

# Primary button
content = content.replace(
    '.btn-primary {\r\n  background: rgba(255,255,255,0.10);\r\n  color: var(--t1);\r\n  border: 1px solid rgba(255,255,255,0.22);\r\n  box-shadow: 0 1px 0 rgba(255,255,255,0.12) inset, var(--glow-btn);\r\n  backdrop-filter: var(--blur-sm);\r\n}',
    '.btn-primary {\n  background: rgba(91, 156, 246, 0.15);\n  color: var(--t1);\n  border: 1px solid rgba(91, 156, 246, 0.35);\n  box-shadow: 0 0 14px rgba(91,156,246,0.1) inset;\n  backdrop-filter: var(--blur-sm);\n}'
)
content = content.replace(
    '.btn-primary:hover:not(:disabled) {\r\n  background: rgba(255,255,255,0.16);\r\n  border-color: rgba(255,255,255,0.35);\r\n  box-shadow: 0 1px 0 rgba(255,255,255,0.18) inset, 0 0 24px rgba(255,255,255,0.08);\r\n  transform: translateY(-1px);\r\n}',
    '.btn-primary:hover:not(:disabled) {\n  background: rgba(91, 156, 246, 0.25);\n  border-color: rgba(91, 156, 246, 0.6);\n  box-shadow: 0 0 24px rgba(91,156,246,0.2);\n  transform: translateY(-1px);\n}'
)

# XP bar fill
content = content.replace(
    '.sb-xp-fill {\r\n  height: 100%;\r\n  background: rgba(255,255,255,0.45);\r\n  border-radius: 99px;\r\n  transition: width 0.5s ease;\r\n}',
    '.sb-xp-fill {\n  height: 100%;\n  background: linear-gradient(90deg, #5b9cf6, #818cf8);\n  border-radius: 99px;\n  transition: width 0.5s ease;\n  box-shadow: 0 0 8px rgba(91,156,246,0.5);\n}'
)

# ARISE watermark — subtle blue tint
content = content.replace(
    'color: rgba(255,255,255,0.015);',
    'color: rgba(91, 156, 246, 0.04);'
)

open('src/app.css', 'wb').write(content.encode('utf-8'))
print('done')
