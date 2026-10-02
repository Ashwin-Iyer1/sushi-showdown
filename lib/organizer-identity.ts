/**
 * Hosting integration point for organizer recovery only.
 * Return an identity only after verifying it with your trusted auth provider.
 * Never trust caller-supplied identity headers on a public Worker.
 * New rooms, participant sessions, private links and emojis do not need this.
 */
export type OrganizerIdentity = { userId: string; email: string };
export async function getVerifiedOrganizer(): Promise<OrganizerIdentity | null> {
  return null;
}
