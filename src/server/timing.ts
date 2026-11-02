// Server and database timing from day one (ADR 0006): every command and loader
// logs one line to the function logs, so a slow screen or a cold database shows.
export async function timed<T>(
  kind: "command" | "loader",
  name: string,
  work: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  let ok = false;
  try {
    const result = await work();
    ok = true;
    return result;
  } finally {
    const ms = Math.round(performance.now() - start);
    if (process.env.NODE_ENV !== "test") {
      console.info(JSON.stringify({ at: kind, name, ms, ok }));
    }
  }
}
