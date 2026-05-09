export default function EventsLoading() {
  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            width: 100,
            height: 32,
            background: "#e5e7eb",
            borderRadius: 6,
            marginBottom: 8,
          }}
        />
        <div style={{ width: 300, height: 14, background: "#e5e7eb", borderRadius: 6 }} />
      </div>
      <div className="skeleton-toolbar">
        <div className="skeleton-box" style={{ width: 280, height: 36 }} />
        <div className="skeleton-box" style={{ width: 96, height: 18 }} />
      </div>

      <div className="events-loading-table">
        <div className="events-loading-header">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="skeleton-box"
              style={{ height: 14, width: index === 2 || index === 3 ? "100%" : "72%" }}
            />
          ))}
        </div>

        {Array.from({ length: 6 }).map((_, rowIndex) => (
          <div key={rowIndex} className="events-loading-row">
            <div className="events-loading-line-group">
              <div className="skeleton-box" style={{ height: 16, width: "76%" }} />
              <div className="skeleton-box" style={{ height: 14, width: "52%" }} />
            </div>
            <div className="events-loading-line-group">
              <div className="skeleton-box" style={{ height: 14, width: "78%" }} />
              <div className="skeleton-box" style={{ height: 14, width: "86%" }} />
            </div>

            <div className="events-loading-reservations">
              <div className="events-loading-summary">
                <div className="skeleton-box" style={{ height: 14, width: 110 }} />
                <div
                  className="skeleton-box"
                  style={{ height: 18, width: 84, borderRadius: 999 }}
                />
              </div>
              <div className="events-loading-line-group">
                <div className="skeleton-box" style={{ height: 14, width: "84%" }} />
                <div className="skeleton-box" style={{ height: 14, width: "68%" }} />
              </div>
              <div className="skeleton-box" style={{ height: 28, width: 116, borderRadius: 999 }} />
            </div>

            <div className="events-loading-reservations">
              <div className="events-loading-summary">
                <div className="skeleton-box" style={{ height: 14, width: 96 }} />
                <div
                  className="skeleton-box"
                  style={{ height: 18, width: 84, borderRadius: 999 }}
                />
              </div>
              <div className="events-loading-line-group">
                <div className="skeleton-box" style={{ height: 14, width: "72%" }} />
                <div className="skeleton-box" style={{ height: 14, width: "58%" }} />
              </div>
            </div>

            <div
              className="skeleton-box"
              style={{ height: 30, width: 30, borderRadius: 8, justifySelf: "end" }}
            />
          </div>
        ))}
      </div>
    </>
  );
}
