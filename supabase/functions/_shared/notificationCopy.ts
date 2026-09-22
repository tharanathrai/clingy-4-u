// Single source of notification wording, shared by the in-app list
// (src/components/notifications/NotificationItem.tsx) and Web Push
// (supabase/functions/send-push). Pure — no Deno or browser imports.

// `name` is the actor's display name, already resolved by the caller. For
// `plan_expired` it is the other member's name on a two-person plan and empty
// on a group plan (run-expiry leaves actor_name null there).
export function getNotificationCopy(type: string, name: string, actorName?: string | null): string {
  if (type === 'plan_expired') {
    return actorName ? `Your plan with ${actorName} expired` : 'Your group plan expired'
  }
  if (type === 'invite_received') {
    return `${name} wants to make a plan with you`
  }
  if (type === 'invite_accepted') {
    return `${name} accepted your plan`
  }
  if (type === 'invite_rejected') {
    return `${name} passed on your plan`
  }
  if (type === 'plan_turned_down') {
    return `${name} turned down a plan`
  }
  if (type === 'member_declined') {
    return `${name} passed on your plan`
  }
  if (type === 'plan_expiring_soon') {
    return 'A plan is expiring soon'
  }
  if (type === 'bridge_formed') {
    return `You formed a bridge with ${name}`
  }
  if (type === 'connection_request') {
    return `${name} wants to connect`
  }
  if (type === 'connection_accepted') {
    return `${name} accepted your connection request`
  }
  if (type === 'post_reaction') {
    return 'Someone reacted to your post'
  }
  if (type === 'post_comment') {
    return `${name} commented on your post`
  }
  if (type === 'plan_edit_proposed') {
    return `${name} proposed a change to a plan`
  }
  if (type === 'plan_edit_accepted') {
    return 'Plan changes were accepted'
  }
  if (type === 'plan_edit_declined') {
    return `${name} declined your proposed change`
  }
  if (type === 'confirmation_started') {
    return `${name} is ready to confirm — tap to complete the plan`
  }

  return 'You have a new notification'
}
