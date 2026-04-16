type StatCardProps = {
  label: string;
  value: string | number;
  subtitle?: string;
};

export function StatCard({ label, value, subtitle }: StatCardProps) {
  return (
    <article className="stat-card">
      <p className="stat-label">{label}</p>
      <h3 className="stat-value">{value}</h3>
      {subtitle ? <p className="stat-subtitle">{subtitle}</p> : null}
    </article>
  );
}
