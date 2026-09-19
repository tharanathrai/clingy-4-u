/**
 * Resolving the "x and y stuck" label on a feed card.
 *
 * A post's author is always first-degree (the posts policy limits the feed to
 * your own posts and your active connections'), but the *other* side of the
 * bridge often is not -- it can be someone you have never connected with. Since
 * the user directory is no longer readable row-by-row, that name comes from the
 * get_bridge_participant_names RPC, which returns display names only: no ids,
 * handles or avatars, so it cannot be used to enumerate anyone or to link to a
 * stranger's profile.
 */

export interface BridgeParticipantNames {
  bridge_id: string
  user_a_name: string
  user_b_name: string
}

interface BridgeSides {
  user_a_id: string
  user_b_id: string
}

/** Fallback when the RPC returned nothing for this bridge. */
export const UNKNOWN_PARTICIPANT_NAME = 'someone'

/**
 * Name of the participant who is *not* the post's author.
 *
 * Falls back to "someone" rather than throwing: a missing name degrades the
 * label, it should never drop the post from the feed.
 */
export function pickCounterpartName(
  bridge: BridgeSides,
  authorId: string,
  names: BridgeParticipantNames | null | undefined,
): string {
  if (!names) return UNKNOWN_PARTICIPANT_NAME

  const counterpartName =
    bridge.user_a_id === authorId ? names.user_b_name : names.user_a_name

  return counterpartName?.trim() ? counterpartName : UNKNOWN_PARTICIPANT_NAME
}

/** Index RPC rows by bridge id for lookup while mapping posts. */
export function indexParticipantNames(
  rows: BridgeParticipantNames[] | null | undefined,
): Map<string, BridgeParticipantNames> {
  return new Map((rows ?? []).map((row) => [row.bridge_id, row]))
}
