export function TableSkeleton({ columns = 5, rows = 8 }: { columns?: number; rows?: number }) {
  return (
    <>
      <div className="skeleton-toolbar">
        <div className="skeleton-box" style={{ width: 280, height: 36 }} />
        <div className="skeleton-box" style={{ width: 140, height: 36 }} />
      </div>
      <div className="skeleton-table-container">
        <div className="skeleton-header">
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="skeleton-box skeleton-header-cell" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="skeleton-row">
            {Array.from({ length: columns }).map((_, c) => (
              <div key={c} className="skeleton-box skeleton-cell" />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

export function DetailSkeleton() {
  return (
    <>
      <div className="skeleton-detail">
        <div className="skeleton-box" style={{ width: 200, height: 32, marginBottom: 8 }} />
        <div className="skeleton-box" style={{ width: 300, height: 16, marginBottom: 32 }} />
        <div className="skeleton-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-field">
              <div className="skeleton-box" style={{ width: 80, height: 12, marginBottom: 8 }} />
              <div className="skeleton-box" style={{ width: "100%", height: 16 }} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
