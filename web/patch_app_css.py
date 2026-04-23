content = open('src/app.css', 'rb').read().decode('utf-8')

# Update sidebar
content = content.replace(
    'background: rgba(13, 17, 23, 0.55);\n  background-image: var(--bg-noise);\n  backdrop-filter: blur(40px) saturate(200%);\n  -webkit-backdrop-filter: blur(40px) saturate(200%);\n  border-right: 1px solid rgba(91, 156, 246, 0.12);',
    'background: rgba(255, 255, 255, 0.03);\n  background-image: var(--bg-noise);\n  backdrop-filter: blur(20px);\n  -webkit-backdrop-filter: blur(20px);\n  border-right: 1px solid rgba(255, 255, 255, 0.06);'
)

# Update panel
content = content.replace(
    'background: rgba(17, 24, 39, 0.75);\n  backdrop-filter: blur(24px) saturate(180%);\n  -webkit-backdrop-filter: blur(24px) saturate(180%);\n  border: 1px solid rgba(91, 156, 246, 0.08);',
    'background: var(--glass-base);\n  backdrop-filter: var(--glass-blur);\n  -webkit-backdrop-filter: var(--glass-blur);\n  border: 1px solid var(--glass-border);'
)

content = content.replace(
    'background: linear-gradient(90deg, transparent, rgba(91, 156, 246, 0.12), transparent);',
    'background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);'
)

content = content.replace(
    'background: rgba(22, 33, 62, 0.8);\n  border-color: rgba(91, 156, 246, 0.18);\n  box-shadow: 0 0 30px rgba(91, 156, 246, 0.07), var(--shadow-lg);',
    'background: var(--glass-1);\n  border-color: rgba(255, 255, 255, 0.12);\n  box-shadow: var(--shadow-lg);'
)

open('src/app.css', 'wb').write(content.encode('utf-8'))
print('app.css patched')
