# Buraco — 2-player, event-sourced, mobile web

A working 2-player [Buraco](https://en.wikipedia.org/wiki/Buraco) game you can
play in a phone browser. Two players, two devices, one shared **game code**. The
frontend never mutates shared state — it appends **immutable events** to a log
and derives all game state by reducing them. The other player reads/subscribes
to the same log to play live.

Priorities, in order: **correct rules → correct scoring → reliable persistence**.
The UI is deliberately plain.

## Architecture

- **Event-sourced.** `reduce(events) -> GameState` is a pure function. Nothing
  lives only in memory; reload and the state is rebuilt from the log.
- **Deterministic deal.** The shuffled 108-card deck (2 decks + 4 jokers) is
  computed from a seed via a seeded PRNG (`mulberry32`). Both clients compute
  the identical deck. _This is trust-based_ — a client could read the upcoming
  stock order. Fine for a private game; a server could hide it later.
- **Swappable backend.** The app depends only on the `GameBackend` interface
  (`src/backend/types.ts`). Two implementations:
  - `LocalStorageBackend` — single device (hotseat). Built first so the rules,
    scoring and persistence are solid before any network exists.
  - `SupabaseBackend` — the primary backend for real two-device play.

```
src/
  game/        # pure engine: types, prng, deck, rules, scoring, reducer
  backend/     # GameBackend interface + local & supabase adapters + factory
  ui/          # App, Lobby, Table (minimal, mobile-first)
  game/__tests__/  # vitest: deck, rules, scoring, reducer
```

## Game rules enforced by the reducer

- **Wilds:** jokers and 2s. A 2 in its own slot (e.g. A-2-3) is natural, not wild.
- **Melds:** same-suit runs. Sets (same rank) are behind `config.allowSets`
  (off by default). At most **one wild per meld**.
- **Buraco:** a meld of 7+ cards. **Clean** = no wild, **dirty** = one wild.
- **A turn:** draw one from stock **or** take the **entire** discard pile; meld
  and extend freely; **end the turn by discarding one card**.
- **Go-out gate:** you cannot go out until you have **≥1 buraco** _and_ have
  **taken a morto**. Emptying your hand makes you take a morto first.
- Illegal moves are rejected with a clear message — never silently allowed.

## Scoring (exact)

| Item | Points |
| --- | --- |
| Clean buraco | +200 |
| Dirty buraco | +100 |
| Go out | +100 |
| Did **not** take a morto | −100 |
| Joker | 30 |
| 2 | 20 |
| Ace | 15 |
| 8–K | 10 |
| 3–7 | 5 |

Melded card values are added; cards left in hand are subtracted. Per-round and
running match totals are shown. Play to a configurable target (default **1500**).
The worked example in `src/game/__tests__/scoring.test.ts` verifies the totals.

## Run locally

```bash
npm install
npm test        # 37 tests: deck, rules, scoring, reducer
npm run dev     # open the printed URL
```

By default `VITE_BACKEND=local` (hotseat). Create a game and pass the device
back and forth — reload at any time, nothing is lost.

### Two devices with Supabase (live play)

1. In the Supabase SQL editor, run [`supabase/schema.sql`](supabase/schema.sql).
2. Copy `.env.example` to `.env` and set:

   ```
   VITE_BACKEND=supabase
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

3. `npm run dev`, create a game on one device, share the code/link, join on the
   other. Turns alternate live; reloads converge to the same state.

> **Key safety (hard rule):** the frontend uses **only** the publishable key via
> `VITE_SUPABASE_PUBLISHABLE_KEY`. Never import or hardcode a secret/service_role
> key in client code. Security relies on RLS + an unguessable `game_id`.

## Deploy to GitHub Pages

`vite.config.ts` sets `base` to `/buraco/` (override with `VITE_BASE`).

The included workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
builds and deploys on push to `main`:

1. Repo **Settings → Pages → Source: GitHub Actions**.
2. Repo **Settings → Secrets and variables → Actions → Variables**: add
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (publishable key only).
3. Push to `main`. The site builds with `VITE_BACKEND=supabase` and the correct
   base path.

## Event model

`Event { id, gameId, type, actor, payload, createdAt }`. Ordering/polling cursor
is the global `id` (`getEvents = where game_id = ? and id > lastId order by id`).

Event types (turn-based; only the active player emits moves):
`game_created`, `player_joined`, `draw_stock`, `take_discard_pile`, `meld_new`,
`meld_extend`, `discard`, `take_morto`, `go_out`, `round_scored`.

## Notes / known limitations

- **Going out** is done by melding/discarding down to an empty hand and pressing
  **Go out** (the engine also auto-takes a morto the first time your hand
  empties). Closing strictly with a final discard is supported when eligible.
- If the **stock runs out** before anyone goes out, the round can't continue
  (drawing is rejected) — a rare edge case left unhandled by design.
- The deal is trust-based (see Architecture).
