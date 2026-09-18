import { Link } from 'react-router-dom'
import {
  LEGAL_CONTACT_EMAIL,
  LegalList,
  LegalPage,
  LegalSection,
} from '../components/legal/LegalPage.tsx'

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy"
      intro="clingy is a small side project for making plans with people you actually
      know. This page says exactly what it stores, who it goes to, and how to get rid of it.
      No tricks, no ad networks."
    >
      <LegalSection heading="Who runs clingy">
        <p>
          clingy is built and operated by one person, not a company. Contact:{' '}
          <a className="underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="What we collect">
        <LegalList>
          <li>
            <strong className="text-text">Google account basics.</strong> When you sign in
            with Google we receive your name, email address, and profile picture URL. We
            never see or store your Google password.
          </li>
          <li>
            <strong className="text-text">Your profile.</strong> Display name, username,
            bio, and an avatar image if you upload one. Uploaded avatars are stored in a
            public storage bucket, so anyone holding the image URL can view it.
          </li>
          <li>
            <strong className="text-text">Plans and activity.</strong> Plan titles,
            category, planned date, who is involved, confirmation status, posts, reactions,
            comments, and expired-plan (graveyard) records.
          </li>
          <li>
            <strong className="text-text">Connections.</strong> Who you are connected to,
            pending requests, and any snoozes or blocks you set.
          </li>
          <li>
            <strong className="text-text">Connection tokens.</strong> Short-lived,
            single-use QR tokens tied to your account, used only to connect two people.
          </li>
          <li>
            <strong className="text-text">Notifications.</strong> In-app notification
            records. If you turn on push notifications, we also store the push subscription
            your browser issues (an endpoint URL and its encryption keys).
          </li>
          <li>
            <strong className="text-text">Usage analytics.</strong> Event names from a fixed
            allowlist (screen views, taps, scan attempts, confirm start/success/abandon) plus
            the screen path with ids and usernames stripped out. Events are tagged with a
            keyed hash of your user and install id rather than your account id. We hold that
            key, so treat this as pseudonymous, not fully anonymous. Plan titles, messages,
            names, and other free text are rejected server-side before storage.
          </li>
          <li>
            <strong className="text-text">Technical logs.</strong> Our hosting and database
            providers keep standard server logs, which include IP addresses and request
            times.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="What we do not collect">
        <LegalList>
          <li>No background or precise location tracking.</li>
          <li>No access to your contacts, address book, photos, or calendar.</li>
          <li>
            No advertising, no third-party ad or social trackers, and we never sell or rent
            your data.
          </li>
          <li>
            QR scanning happens entirely in your browser. Camera frames are decoded on your
            device and never uploaded — only the scanned token is sent to the server.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="Why we use it">
        <LegalList>
          <li>To run the core product: accounts, connections, plans, confirmations, feed.</li>
          <li>
            To send activity email and push notifications (invites, confirmations, plans
            about to expire).
          </li>
          <li>
            To find bugs and see which parts of the app confuse people, using the
            aggregated analytics described above.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="Who else sees it">
        <p>
          We use a small number of service providers, each processing data only to run
          clingy:
        </p>
        <LegalList>
          <li>
            <strong className="text-text">Supabase</strong> — database, authentication,
            file storage, and server functions.
          </li>
          <li>
            <strong className="text-text">Vercel</strong> — hosting for the web app.
          </li>
          <li>
            <strong className="text-text">Google</strong> — sign-in only.
          </li>
          <li>
            <strong className="text-text">Resend</strong> — sending activity email.
          </li>
          <li>
            <strong className="text-text">Your browser vendor&apos;s push service</strong>{' '}
            (Google, Apple, or Mozilla) — delivering push notifications you opted into.
          </li>
        </LegalList>
        <p>
          We may also disclose data if legally required to. Otherwise, nobody else gets it.
        </p>
      </LegalSection>

      <LegalSection heading="What other people in clingy see">
        <LegalList>
          <li>
            Any signed-in clingy user can look up basic profile information: display name,
            username, avatar, and bio.
          </li>
          <li>
            Plan details, including the title and date, are visible to the people on that
            plan.
          </li>
          <li>Posts, reactions, and comments are visible to your connected network.</li>
          <li>Your email address is never shown to other users.</li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="How long we keep it">
        <p>
          Account, profile, plan, and connection data is kept while your account exists.
          Expired plans move to the graveyard and stay there as history until you ask us to
          delete them. QR tokens expire quickly and are deleted after use. Raw analytics
          events are currently retained indefinitely; they contain no names, titles, or
          message text.
        </p>
      </LegalSection>

      <LegalSection heading="Your choices">
        <LegalList>
          <li>
            <strong className="text-text">Analytics.</strong> Turn off &ldquo;Share
            anonymous usage data&rdquo; in Settings. Nothing further is sent from your
            device once it is off.
          </li>
          <li>
            <strong className="text-text">Push notifications.</strong> Toggle them in
            Settings, or revoke permission in your browser or OS settings.
          </li>
          <li>
            <strong className="text-text">Your profile.</strong> Edit or clear your display
            name, username, bio, and avatar at any time in Settings.
          </li>
          <li>
            <strong className="text-text">Deletion and export.</strong> There is no
            self-serve delete button yet. Email{' '}
            <a className="underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
              {LEGAL_CONTACT_EMAIL}
            </a>{' '}
            from your account address and we will delete your account and its data, or send
            you a copy, within 30 days.
          </li>
          <li>
            <strong className="text-text">Activity email.</strong> To stop transactional
            email entirely, ask at the address above or delete your account.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="Security">
        <p>
          Traffic is served over HTTPS. Database access is restricted per user with
          row-level security, and privileged keys stay on the server. clingy is an early
          project run by one person, though — it comes with no warranty, and you should not
          store anything in it that would hurt to lose or to have exposed.
        </p>
      </LegalSection>

      <LegalSection heading="Children">
        <p>
          clingy is not intended for anyone under 13, and we do not knowingly collect data
          from children. If you believe a child has an account, email us and we will remove
          it.
        </p>
      </LegalSection>

      <LegalSection heading="Where data lives">
        <p>
          Our providers run servers in several countries, so your data may be processed
          outside the country you live in.
        </p>
      </LegalSection>

      <LegalSection heading="Changes">
        <p>
          If this page changes, the &ldquo;last updated&rdquo; date above changes with it.
          Significant changes will be announced in the app. See also the{' '}
          <Link className="underline" to="/terms">
            Terms of Service
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  )
}
