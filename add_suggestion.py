import re

with open('web/src/pages/DashboardPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''                  ]}
                  height={240}
                />
              </div>
            </div>'''

replacement = '''                  ]}
                  height={240}
                />
              </div>
              <div style={{ 
                marginTop: '15px', 
                padding: '12px 16px', 
                background: 'rgba(var(--accent-primary-rgb), 0.1)', 
                borderLeft: '4px solid var(--accent-primary)',
                borderRadius: '4px',
                fontSize: '0.8rem',
                color: 'var(--t2)'
              }}>
                {(() => {
                  if (!data) return null;
                  const stats = [
                    { name: "Physical", value: data.domain_physical || 0, action: "Go for a run, hit the gym, or do some home workouts." },
                    { name: "Mind", value: data.domain_mind || 0, action: "Read a chapter of a book, study a new concept, or solve a puzzle." },
                    { name: "Soul", value: data.domain_soul || 0, action: "Take 10 minutes to meditate, journal your thoughts, or relax." },
                    { name: "Execution", value: data.domain_execution || 0, action: "Clear your errands, do chores, or knock out pending tasks." },
                    { name: "Builder", value: data.domain_builder || 0, action: "Work on a side project, write some code, or build something." },
                  ];
                  const lowest = stats.reduce((min, curr) => curr.value < min.value ? curr : min, stats[0]);
                  return (
                    <div>
                      <strong style={{ color: 'var(--accent-primary)', display: 'block', marginBottom: '4px' }}>
                        ??? SYSTEM SUGGESTION
                      </strong>
                      Your <strong>{lowest.name}</strong> domain is lagging behind. {lowest.action}
                    </div>
                  );
                })()}
              </div>
            </div>'''

if target in content:
    content = content.replace(target, replacement)
    with open('web/src/pages/DashboardPage.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced successfully")
else:
    print("Target not found")
