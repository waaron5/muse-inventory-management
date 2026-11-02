# Dates are calendar dates, and "today" is in one Muse time zone

Event start and end dates and the day a History entry happened are stored as plain calendar dates with no time of day; only "recorded at" is a timestamp. "Today", which decides Upcoming versus Past, when an Event has ended (ADR 0010), and the default day for a backdated entry, is computed in one app-wide time zone, America/Denver, set in config. This holds even for an Event in Cove or New York. Hold Windows are inclusive whole days (ADR 0002), and Muse plans from Utah, so one fixed zone gives every person and every server the same answer to "has this Event ended yet?". Per-Event or per-device time zones would make a day boundary depend on who is looking.

## Consequences

- Never convert a stored date through the server's or browser's local time zone; date arithmetic works on calendar dates.
- Changing the zone later reinterprets every "today" boundary but not stored data. Moving to timestamps would mean migrating data.
