import { sql } from "drizzle-orm";
import type { Db } from "@/db/types";

type OffLedger = { itemId: string; locationId: string; balance: number; ledger: number };

/**
 * Every Stock balance that disagrees with the sum of its History entries
 * (ADR 0004): what moved to a Location minus what moved from it. Empty when
 * every command kept the two together.
 */
export async function stockOffLedger(db: Db): Promise<OffLedger[]> {
  const result = await db.execute<OffLedger>(sql`
    with moves as (
      select item_id, to_location_id as location_id, count from history_entry where to_location_id is not null
      union all
      select item_id, from_location_id, -count from history_entry where from_location_id is not null
    ),
    ledger as (
      select item_id, location_id, sum(count)::int as total from moves group by item_id, location_id
    )
    select
      coalesce(s.item_id, l.item_id) as "itemId",
      coalesce(s.location_id, l.location_id) as "locationId",
      coalesce(s.count, 0) as balance,
      coalesce(l.total, 0) as ledger
    from stock s
    full join ledger l on l.item_id = s.item_id and l.location_id = s.location_id
    where coalesce(s.count, 0) <> coalesce(l.total, 0)
  `);
  return (result as unknown as { rows: OffLedger[] }).rows;
}
