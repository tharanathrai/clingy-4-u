import { Link } from 'react-router-dom'
import {
  LEGAL_CONTACT_EMAIL,
  LegalList,
  LegalPage,
  LegalSection,
} from '../components/legal/LegalPage.tsx'

export default function Terms() {
  return (
    <LegalPage
      title="Terms"
      intro="These terms cover your use of clingy. It is a free side project, not a
      company product — please read the parts about availability and liability, because they
      are the honest ones."
    >
      <LegalSection heading="The agreement">
        <p>
          By signing in to clingy you agree to these terms and to the{' '}
          <Link className="underline" to="/privacy">
            Privacy page
          </Link>
          . clingy is provided by an individual developer, free of charge. Contact:{' '}
          <a className="underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="Who can use it">
        <p>
          You must be at least 13 years old and use your own Google account. You are
          responsible for everything that happens under your account.
        </p>
      </LegalSection>

      <LegalSection heading="How clingy works">
        <LegalList>
          <li>
            Connections are made by scanning a rotating QR code in person. There is no
            search-and-add by name or email.
          </li>
          <li>
            A plan only becomes real when the people on it confirm together. Unconfirmed
            plans expire on their own and move to the graveyard.
          </li>
          <li>
            Plans, posts, and reactions are visible to the people described on the{' '}
            <Link className="underline" to="/privacy">
              Privacy page
            </Link>
            .
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <p>Do not:</p>
        <LegalList>
          <li>Harass, threaten, impersonate, or spam other people.</li>
          <li>Post illegal content, or content you do not have the right to post.</li>
          <li>
            Scrape, bulk-download, or automate access to clingy, or use it through anything
            other than the official app.
          </li>
          <li>
            Try to bypass the QR connection flow, access data belonging to other users, or
            probe, overload, or attack the service.
          </li>
          <li>Resell or commercially exploit clingy or anything in it.</li>
        </LegalList>
        <p>
          If you find a security problem, please report it to the email above instead of
          using it.
        </p>
      </LegalSection>

      <LegalSection heading="Your content">
        <p>
          Your plans, posts, comments, and profile stay yours. You give us permission to
          store them and show them to the people you shared them with, purely so the app can
          work. You are responsible for what you post, and we may remove content or suspend
          an account that breaks these terms.
        </p>
      </LegalSection>

      <LegalSection heading="Availability">
        <p>
          clingy is free and early. There is no uptime guarantee, no support commitment, and
          features can change or disappear. Data can be lost. Keep your own copy of anything
          that matters to you.
        </p>
      </LegalSection>

      <LegalSection heading="Ending it">
        <p>
          You can stop using clingy whenever you like, and can ask us to delete your account
          and data by email. We may suspend or terminate an account that violates these
          terms, or shut the service down entirely with as much notice as we can reasonably
          give.
        </p>
      </LegalSection>

      <LegalSection heading="No warranty">
        <p>
          clingy is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without
          warranties of any kind, express or implied. In particular, clingy does not
          guarantee that a plan will be honoured or that anyone will actually show up. That
          part is between you and your friends.
        </p>
      </LegalSection>

      <LegalSection heading="Limitation of liability">
        <p>
          To the fullest extent permitted by law, the developer is not liable for any
          indirect, incidental, or consequential damages, or for lost data, lost plans, or
          missed events arising from your use of clingy. Because clingy is provided free of
          charge, total liability is limited to the amount you have paid for it, which is
          zero.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to these terms">
        <p>
          These terms may change; the &ldquo;last updated&rdquo; date above will change with
          them. Continuing to use clingy after a change means you accept the new terms.
        </p>
      </LegalSection>

      <LegalSection heading="Governing law">
        <p>
          These terms are governed by the laws of the State of California, United States,
          and the courts there have exclusive jurisdiction, except where local consumer law
          gives you the right to bring a claim where you live.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
