export default function DashboardLoading() {
  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <div className="sk" style={{ width: 160, height: 32, marginBottom: 8 }} />
        <div className="sk" style={{ width: 240, height: 14 }} />
      </div>
      <div className="skeleton-stats">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-stat-card">
            <div className="sk" style={{ width: 80, height: 12, marginBottom: 12 }} />
            <div className="sk" style={{ width: 48, height: 28 }} />
          </div>
        ))}
      </div>
      <div className="skeleton-sections">
        <div className="skeleton-section">
          <div className="sk" style={{ width: 160, height: 20, marginBottom: 16 }} />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="sk" style={{ width: "100%", height: 44, marginBottom: 8 }} />
          ))}
        </div>
        <div className="skeleton-section">
          <div className="sk" style={{ width: 140, height: 20, marginBottom: 16 }} />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="sk" style={{ width: "100%", height: 44, marginBottom: 8 }} />
          ))}
        </div>
      </div>
      <style>{`
        .sk {
          background: #e5e7eb;
          border-radius: 6px;
          animation: shimmer 1.5s ease-in-out infinite;
        }
        @keyframes shimmer {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .skeleton-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 32px;
        }
        .skeleton-stat-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 20px;
        }
        .skeleton-sections {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        .skeleton-section {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 20px;
        }
      `}</style>
    </>
  );
}
