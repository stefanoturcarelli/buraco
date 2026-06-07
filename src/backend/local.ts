import type { GameBackend, GameEvent, NewEvent } from "./types";

// Single-device backend backed by localStorage. Build/verify the rules,
// scoring and persistence here BEFORE any network exists. Cross-tab realtime
// works via the browser "storage" event.

const NEXT_ID_KEY = "buraco:nextId";

function eventsKey(gameId: string): string {
  return `buraco:${gameId}:events`;
}

function nextId(): number {
  const cur = Number(localStorage.getItem(NEXT_ID_KEY) ?? "0");
  const next = cur + 1;
  localStorage.setItem(NEXT_ID_KEY, String(next));
  return next;
}

function readEvents(gameId: string): GameEvent[] {
  const raw = localStorage.getItem(eventsKey(gameId));
  return raw ? (JSON.parse(raw) as GameEvent[]) : [];
}

function writeEvents(gameId: string, events: GameEvent[]): void {
  localStorage.setItem(eventsKey(gameId), JSON.stringify(events));
}

function randomGameId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export const localBackend: GameBackend = {
  async createGame(seed) {
    const gameId = randomGameId();
    const event: GameEvent = {
      id: nextId(),
      gameId,
      type: "game_created",
      actor: "system",
      payload: { seed },
      createdAt: new Date().toISOString(),
    };
    writeEvents(gameId, [event]);
    return { gameId };
  },

  async appendEvent(gameId, e: NewEvent) {
    const events = readEvents(gameId);
    const event: GameEvent = {
      id: nextId(),
      gameId,
      type: e.type,
      actor: e.actor,
      payload: e.payload,
      createdAt: new Date().toISOString(),
    };
    events.push(event);
    writeEvents(gameId, events);
    return event;
  },

  async getEvents(gameId, sinceId) {
    return readEvents(gameId)
      .filter((e) => e.id > sinceId)
      .sort((a, b) => a.id - b.id);
  },

  subscribe(gameId, cb) {
    let lastSeen = Math.max(0, ...readEvents(gameId).map((e) => e.id));
    const handler = (ev: StorageEvent) => {
      if (ev.key !== eventsKey(gameId)) return;
      const events = readEvents(gameId)
        .filter((e) => e.id > lastSeen)
        .sort((a, b) => a.id - b.id);
      for (const e of events) {
        lastSeen = Math.max(lastSeen, e.id);
        cb(e);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  },
};
