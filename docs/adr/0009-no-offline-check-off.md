# No offline check-off

_Superseded by [ADR 0010](0010-plan-and-print-with-automatic-giveaways.md): there is no check-off._

Loading and returning need a connection; there is no service worker, no local queue of check-offs, and no sync. Check-off updates the screen at once, and a save that fails marks its row "Not saved" with a retry. Anything missed at the truck can be entered later from the office, because every entry carries a backdatable "day it happened". We chose this because offline sync means a local queue and conflict rules for two phones checking off the same Line. That is a large cost for a problem nobody has reported, and it would also strain the rule that History is never rewritten.

## Consequences

- Revisit only if a specific warehouse or loading spot turns out to have no signal; the command layer (ADR 0003) is where a sync endpoint would plug in.
