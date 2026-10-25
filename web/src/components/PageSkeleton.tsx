/**
 * Lightweight Suspense fallback for lazily loaded routes. Pure markup + CSS (see `.sk-*`
 * in app.css) so it paints instantly, with no JS dependencies of its own.
 */
export function PageSkeleton() {
  return (
    <section className="page sk-page" aria-busy="true" aria-label="Loading">
      <div className="sk-block sk-title" />
      <div className="sk-block sk-sub" />
      <div className="sk-grid">
        <div className="sk-block sk-card" />
        <div className="sk-block sk-card" />
        <div className="sk-block sk-card" />
        <div className="sk-block sk-card" />
      </div>
      <div className="sk-block sk-panel" />
    </section>
  );
}
