# Functions and database share Oregon, the database sleeps when idle, and each screen has a round-trip budget

Vercel functions are pinned to `pdx1` (Portland) in `vercel.json`, and the Neon Postgres database lives in AWS `us-west-2` (Oregon), the same AWS region. Neon's scale-to-zero stays on (5 minutes idle), so the database costs only for the time it is in use. A Vercel Cron job hits a route that does not touch the database every 5 minutes, all day, so a warm function instance is always waiting. Each screen makes at most 2 sequential database round trips. The app shell is prerendered with Cache Components and never waits on data, and data streams into Suspense boundaries. We chose this because v1's slowness was latency, not data (Why is v1 slow?): cold function starts, Neon resume, and serial round trips stacked up on an app that is idle most of the time. With the shell prerendered and the function kept warm, only Neon's resume is left: a few hundred milliseconds on the first data load after 5 idle minutes, into a frame that is already showing, after which a whole load-out runs warm. That keeps the app fast at any hour and in any time zone without paying for an always-on database (Deployment and cutover). Oregon is the nearest pairing to Muse's Utah users.

## Considered Options

- **Always on (scale-to-zero off) with a `select 1` keep-warm**: never cold, but it costs more and needs a manual compute restart about weekly to pick up Neon's updates. This is the switch to flip if measurements or Muse say the first load is too slow.
- **Scale-to-zero with a working-hours ping**: warm on weekdays but cold in the evenings and at weekends, exactly when load-outs happen.
- **Virginia (`iad1`, v1's default)**: about 35 ms more per browser round trip from Utah, for no benefit.
- **Data caching (`use cache`) from day one**: co-located queries take a few milliseconds, the dataset is tiny, and a cold instance's in-memory cache is empty anyway. Left out until measurements call for it. Every signed-in user sees the same data, so shared caching can be added later with tags, with no risk of one person's data leaking to another.

## Consequences

- New projects default to `iad1`; the region pin and the database region must change together or not at all.
- The database client is a `pg` Pool attached to Fluid compute (`attachDatabasePool`), not Neon's HTTP driver, and it must tolerate the database having suspended between requests.
- The keep-warm route must never query the database, or it would keep Neon awake all day.
- Every foreign key and filter column is indexed, every list is paginated in SQL, and no Server Action calls `router.refresh()`.
- Speed Insights, server and database timing, and a synthetic cold and warm check run from the first deploy, so a regression in this budget, and the cost of a cold first load, is visible.
