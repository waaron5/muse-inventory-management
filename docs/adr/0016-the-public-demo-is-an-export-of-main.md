# The public repo and demo are a cleaned export of main

This repo stays private and is the only place work happens. A public copy, `waaron5/muse-inventory-management`, is only ever written by `pnpm publish:public`, run after a merge. It takes committed `main`, never a working tree, and leaves out agent instructions, vendored tools and internal plans. It swaps real client names for made-up ones from `scripts/public-names.json`, which never leaves this repo, and unwraps links into this repo's issues. Then it runs a leak check that refuses to push if any real name, private link or price is left. Each run is one new commit, "Sync with production", from a noreply address. The public repo's Vercel project, on a personal Hobby account with its own free Neon database, deploys every push to `muse-inventory-demo.vercel.app`.

The demo's code lives here, behind `DEMO_MODE=1`. It turns on only when the flag is set and, on Vercel, only in the project whose production address is the demo's (`src/lib/demo.ts`). So setting the flag on Muse's production by mistake changes nothing. In the demo:

- Sign-in is one button that signs a visitor in as a fictional Admin, made whole first in case an earlier visitor demoted or deactivated them. The code is made on the server and never emailed.
- Fictional data is seeded through the same commands people use, with Event dates counted from today and its History and Activity spread over the weeks before. A nightly cron (`/api/demo-reset`) empties every table and seeds it again.
- A banner says the data is fictional and resets nightly. Photo uploads and bug reports are refused, and no email is sent.
- `demo/vercel.json` replaces `vercel.json`: Hobby allows only daily crons, so the 5-minute keep-warm of ADR 0006 is left out.

We chose this so the demo follows every improvement with no upkeep. A copy cleaned by hand couldn't be repeated, and demo code kept only in the public repo would clash with every sync.

## Considered Options

- **Demo code only in the public repo**: production never ships it, but every sync from `main` would overwrite or clash with it.
- **A GitHub Action on each push to main**: no one has to remember, but it spends this repo's capped Actions minutes and needs a token that can write to the public repo.
- **Leaving the ADRs out of the public copy**: no prose to clean, but the code loses its reasoning. The ADRs here carry no prices or private issue titles instead.
- **Force-pushing one fresh commit each time**: a clean history, but a steady record of syncs shows the project is alive.

## Consequences

- A new real client name in code, a test or a doc needs adding to `scripts/public-names.json` first, or the leak check refuses the export.
- Production ships the demo's code switched off. Its sign-in refuses to run outside the demo, and the reset route answers 404 there.
- A leak that gets past the check stays in the public repo's history. Rewriting that history is the fix.
