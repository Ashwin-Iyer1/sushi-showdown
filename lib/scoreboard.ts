export type Participant = { id: string; name: string; count: number; version: number; created_at: number; claimable?: boolean };
export const EMOJIS = ["🍣", "🔥", "😂", "👏", "😎", "❤️"] as const;
export type Emote = { id: string; participant_id: string; emoji: string; created_at: number };
export type Snapshot = { participants: Participant[]; participant?: Participant; emotes: Emote[]; serverTime: number; room: { code: string } | null; role: "host" | "participant" | "spectator" | "legacy"; participantId: string | null; isOriginalGame?: boolean };
export function mergeParticipants(current: Participant[], incoming: Participant[]): Participant[] {
  const entries = new Map(current.map(p => [p.id, p]));
  for (const p of incoming) {
    const previous = entries.get(p.id);
    if (!previous || p.version >= previous.version) entries.set(p.id, {...p, claimable: previous?.claimable === false ? false : p.claimable});
  }
  return [...entries.values()].sort((a, b) => b.count - a.count || a.created_at - b.created_at || a.id.localeCompare(b.id));
}
