import re

with open('web/src/pages/DashboardPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'<AreaChart data=\{data\.monthlyHistory\}.*?</AreaChart>', re.DOTALL)

replacement = '''{(() => {
                    const dataMax = Math.max(...data.monthlyHistory.map(d => d.daily_points), 0);
                    const dataMin = Math.min(...data.monthlyHistory.map(d => d.daily_points), 0);
                    const off = dataMax === dataMin ? 1 : dataMax / (dataMax - dataMin);
                    
                    return (
                      <AreaChart data={data.monthlyHistory} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                        <defs>
                          <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                            <stop offset={0} stopColor="var(--accent-primary)" stopOpacity={0.8} />
                            <stop offset={off} stopColor="var(--accent-primary)" stopOpacity={0.05} />
                            <stop offset={off} stopColor="#ef4444" stopOpacity={0.05} />
                            <stop offset={1} stopColor="#ef4444" stopOpacity={0.8} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" stroke="rgba(255,255,255,0.05)" tick={{ fontSize:10, fill:"rgba(255,255,255,0.2)" }} tickLine={false} axisLine={false} interval={Math.floor(data.monthlyHistory.length/6)} />
                        <YAxis stroke="rgba(255,255,255,0.05)" tick={{ fontSize:10, fill:"rgba(255,255,255,0.2)" }} tickLine={false} axisLine={false} />
                        <Tooltip {...TOOLTIP_STYLE} />
                        <Area type="monotone" dataKey="daily_points" stroke="url(#splitColor)" strokeWidth={2} fill="url(#splitColor)" dot={false} activeDot={{ r: 5, fill: "var(--accent-primary)" }} />
                      </AreaChart>
                    );
                  })()}'''

content = pattern.sub(replacement, content)

with open('web/src/pages/DashboardPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
