import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  ApplicationServer,
  importVapidKeys,
  PushMessageError,
  Urgency,
} from 'jsr:@negrel/webpush@0.5.0'
import {
  buildPushPayload,
  type PushNotificationRow,
} from '../_shared/pushPayload.ts'

// Called by the `notifications_push_after_insert` trigger (pg_net) with the
// freshly inserted notifications row. Fans out to every push_subscriptions row
// for the recipient. Responds 202 immediately and finishes sending in the
// background — pg_net's timeout is short and a recipient may have several
// devices.
//
// Cost: $0. VAPID means we talk to the browser push services directly; no
// FCM/APNs account, no third-party relay.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

// Supabase edge runtime global; keeps the isolate alive after the response.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

interface SendPushBody {
  notification?: PushNotificationRow & { user_id?: string }
}

interface SubscriptionRow {
  endpoint: string
  p256dh: string
  auth: string
}

const PUSH_TTL_SECONDS = 60 * 60 * 24

let appServerPromise: Promise<ApplicationServer> | null = null

// Key import is per-isolate, not per-request.
function getApplicationServer(): Promise<ApplicationServer> {
  if (!appServerPromise) {
    appServerPromise = (async () => {
      const keysJson = Deno.env.get('VAPID_KEYS_JSON')
      const subject = Deno.env.get('VAPID_SUBJECT')
      if (!keysJson || !subject) {
        throw new Error('VAPID_KEYS_JSON / VAPID_SUBJECT are not configured.')
      }
      const vapidKeys = await importVapidKeys(JSON.parse(keysJson), {
        extractable: false,
      })
      return ApplicationServer.new({ contactInformation: subject, vapidKeys })
    })()
    // Let the next request retry a transient failure instead of caching it.
    appServerPromise.catch(() => {
      appServerPromise = null
    })
  }
  return appServerPromise
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse(500, { error: 'Supabase environment is not configured.' })
    }

    // Same shape as run-expiry: the trigger reads SEND_PUSH_SECRET from Vault
    // (supabase/scripts/setup-send-push.sql); the service-role key also works
    // for manual invocation.
    const sendPushSecret = Deno.env.get('SEND_PUSH_SECRET')
    const authHeader = request.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    const authorized =
      Boolean(token) &&
      (token === supabaseServiceRoleKey ||
        (Boolean(sendPushSecret) && token === sendPushSecret))
    if (!authorized) {
      return jsonResponse(401, { error: 'unauthorized' })
    }

    const body = (await request.json()) as SendPushBody
    const notification = body.notification
    if (
      !notification ||
      typeof notification.user_id !== 'string' ||
      typeof notification.type !== 'string' ||
      typeof notification.reference_id !== 'string'
    ) {
      return jsonResponse(400, { error: 'notification_invalid' })
    }
    const recipientId = notification.user_id

    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)
    const { data: subscriptions, error: subscriptionsError } = await serviceClient
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', recipientId)
      .returns<SubscriptionRow[]>()

    if (subscriptionsError) {
      return jsonResponse(500, { error: subscriptionsError.message })
    }
    if (!subscriptions || subscriptions.length === 0) {
      return jsonResponse(200, { sent: 0 })
    }

    const payload = buildPushPayload(notification)
    const message = JSON.stringify(payload)

    const work = (async () => {
      const appServer = await getApplicationServer()
      await Promise.allSettled(
        subscriptions.map(async (subscription) => {
          try {
            await appServer
              .subscribe({
                endpoint: subscription.endpoint,
                keys: { p256dh: subscription.p256dh, auth: subscription.auth },
              })
              .pushTextMessage(message, {
                ttl: PUSH_TTL_SECONDS,
                urgency: Urgency.High,
                topic: payload.tag,
              })
          } catch (error) {
            const status =
              error instanceof PushMessageError ? error.response.status : null
            // 404/410: the browser dropped the subscription (permission
            // revoked, app uninstalled). Forget it so we stop retrying.
            if (status === 404 || status === 410) {
              await serviceClient
                .from('push_subscriptions')
                .delete()
                .eq('endpoint', subscription.endpoint)
              return
            }
            console.error('send-push delivery failed', {
              notification_id: notification.id,
              status,
              message: error instanceof Error ? error.message : String(error),
            })
          }
        }),
      )
    })()

    EdgeRuntime.waitUntil(work)
    return jsonResponse(202, { queued: subscriptions.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.'
    return jsonResponse(500, { error: message })
  }
})

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
