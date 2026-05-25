import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy · LockBox",
  description:
    "How LockBox collects, uses, and protects your information — including SSN handling, Plaid bank data, and analytics.",
  openGraph: {
    title: "Privacy Policy · LockBox",
    description:
      "How LockBox collects, uses, and protects your information.",
    url: "https://www.lockboxfinance.com/privacy",
    siteName: "LockBox",
    type: "article",
  },
  alternates: { canonical: "https://www.lockboxfinance.com/privacy" },
};

const LAST_UPDATED = "May 25, 2026";

export default function PrivacyPage() {
  return (
    <main
      className="min-h-screen w-full"
      style={{ backgroundColor: "#F5F0E8", color: "#1A1A1A" }}
    >
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <nav className="mb-10 flex items-center justify-between text-sm">
          <Link
            href="https://www.lockboxfinance.com"
            className="font-medium hover:underline"
            style={{ color: "#1a6b3a" }}
          >
            ← Back to LockBox
          </Link>
          <Link
            href="/terms"
            className="font-medium hover:underline"
            style={{ color: "#1a6b3a" }}
          >
            Terms of Service →
          </Link>
        </nav>

        <header className="mb-10 border-b pb-8" style={{ borderColor: "#1a6b3a33" }}>
          <p
            className="mb-3 text-xs uppercase tracking-[0.18em]"
            style={{ color: "#1a6b3a" }}
          >
            Legal
          </p>
          <h1
            className="font-serif text-4xl leading-tight sm:text-5xl"
            style={{ color: "#1a6b3a", fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm text-neutral-600">
            Last updated: {LAST_UPDATED}
          </p>
        </header>

        <Prose>
          <P>
            This Privacy Policy explains what information LockBox
            Financial, Inc. (&ldquo;LockBox,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) collects when
            you use our mobile app, our website at lockboxfinance.com,
            and related services (collectively, the &ldquo;Service&rdquo;), how
            we use that information, and the choices you have. We
            collect the minimum amount of information needed to operate
            the Service responsibly and to meet our legal obligations.
          </P>

          <H2 id="information-we-collect">1. Information We Collect</H2>
          <P>
            <strong>Account information.</strong> When you create an
            account we collect your name, email address, phone number,
            password (hashed; we never see the plain text), and the
            time zone of your device.
          </P>
          <P>
            <strong>Identity verification information.</strong> To
            comply with U.S. financial regulations we collect your
            legal name, date of birth, residential address, and Social
            Security number. Your full SSN is transmitted over an
            encrypted connection to our identity-verification provider
            and is not retained in our application database — we keep
            only the last four digits, used for support verification.
          </P>
          <P>
            <strong>Banking data via Plaid.</strong> If you link an
            external bank account, Plaid Inc. provides us with
            information about that account (account and routing
            numbers, balances, and historical transaction metadata).
            We use that data to display your balances, fund and
            withdraw from your boxes, and surface insights from The
            Banker. Plaid&rsquo;s handling of your information is
            governed by Plaid&rsquo;s{" "}
            <A href="https://plaid.com/legal/#end-user-privacy-policy">
              End User Privacy Policy
            </A>
            .
          </P>
          <P>
            <strong>Usage analytics.</strong> We collect technical
            information about how you use the Service — device type,
            operating system, app version, screens visited, and
            in-app events such as creating a box or completing
            onboarding. We use this to improve reliability and to
            understand which features people actually use.
          </P>
          <P>
            <strong>Communications.</strong> When you contact support
            or a Keyholder we keep the contents of those messages so
            we can respond and maintain an audit trail.
          </P>

          <H2 id="how-we-use">2. How We Use Information</H2>
          <Ul>
            <Li>To create and operate your account;</Li>
            <Li>
              To move money in and out of your boxes at your
              direction;
            </Li>
            <Li>
              To verify your identity and prevent fraud, money
              laundering, and unauthorized access;
            </Li>
            <Li>
              To send transactional messages (verification codes,
              unlock notifications, security alerts) and, with your
              consent, occasional product updates;
            </Li>
            <Li>
              To analyze usage and improve the Service;
            </Li>
            <Li>
              To comply with legal obligations and respond to lawful
              requests.
            </Li>
          </Ul>

          <H2 id="service-providers">3. Service Providers</H2>
          <P>
            We share information only with vendors that help us run
            the Service, under contracts that limit their use of your
            data to providing services to us:
          </P>
          <Ul>
            <Li>
              <strong>Plaid</strong> — bank account linking and
              transaction data.
            </Li>
            <Li>
              <strong>Twilio</strong> — sending SMS verification
              codes during signup and unlock flows.
            </Li>
            <Li>
              <strong>Resend</strong> — sending transactional and
              Keyholder-notification email.
            </Li>
            <Li>
              <strong>PostHog</strong> — privacy-respecting product
              analytics; no SSN, bank credentials, or message bodies
              are sent.
            </Li>
            <Li>
              <strong>Vercel</strong> — hosting our web servers and
              edge infrastructure.
            </Li>
            <Li>
              <strong>Neon</strong> — hosting our application
              database.
            </Li>
          </Ul>
          <P>
            We do <strong>not</strong> sell your personal information
            and we do not share it with advertisers.
          </P>

          <H2 id="security">4. Data Security</H2>
          <P>
            We use industry-standard safeguards including encryption
            in transit (TLS) and at rest, hashed passwords, scoped
            access tokens, and least-privilege access for our team.
            No system can be guaranteed completely secure; please
            help us by using a strong, unique password and enabling
            biometric unlock on your device.
          </P>

          <H2 id="retention">5. Retention</H2>
          <P>
            We retain account and transaction data for as long as
            your account is open and for a reasonable period
            afterward to satisfy our legal, accounting, and
            audit-trail obligations (typically seven years for
            financial records). When data is no longer needed we
            delete or anonymize it.
          </P>

          <H2 id="your-rights">6. Your Rights</H2>
          <P>
            You may access, update, or delete your account
            information from within the app or by emailing{" "}
            <A href="mailto:privacy@lockboxfinance.com">
              privacy@lockboxfinance.com
            </A>
            . Depending on where you live, you may have additional
            rights:
          </P>
          <Ul>
            <Li>
              <strong>California residents (CCPA / CPRA).</strong>{" "}
              You have the right to know what personal information we
              collect about you, to request deletion, to correct
              inaccuracies, and to opt out of any &ldquo;sale&rdquo; or
              &ldquo;sharing&rdquo; of personal information for
              cross-context behavioral advertising. We do not sell or
              share personal information for those purposes.
            </Li>
            <Li>
              <strong>Other U.S. states.</strong> Residents of states
              with comparable privacy laws (such as Colorado,
              Virginia, and Connecticut) have similar rights. Submit
              requests to the email address above.
            </Li>
          </Ul>

          <H2 id="children">7. Children&rsquo;s Privacy</H2>
          <P>
            LockBox is not directed to and is not intended for
            children under 18. We do not knowingly collect personal
            information from children under 18. If you believe a
            child has provided us information, contact us and we will
            delete it.
          </P>

          <H2 id="cookies">8. Cookies &amp; Similar Technologies</H2>
          <P>
            Our website uses essential cookies to keep you signed in
            and to remember your preferences, and a small set of
            analytics cookies (via PostHog) to understand how the
            site is used. We do not use third-party advertising
            cookies. You can disable cookies in your browser
            settings; some parts of the site may not work without
            them.
          </P>

          <H2 id="changes">9. Changes to This Policy</H2>
          <P>
            We may update this Policy from time to time. Material
            changes will be announced inside the app or by email at
            least 14 days before they take effect.
          </P>

          <H2 id="contact">10. Contact</H2>
          <P>
            Questions about your privacy or this Policy? Email{" "}
            <A href="mailto:privacy@lockboxfinance.com">
              privacy@lockboxfinance.com
            </A>
            .
          </P>
        </Prose>

        <footer className="mt-16 border-t pt-8 text-sm text-neutral-600"
          style={{ borderColor: "#1a6b3a33" }}>
          <p>
            Last updated: {LAST_UPDATED}. See also our{" "}
            <Link
              href="/terms"
              className="font-medium hover:underline"
              style={{ color: "#1a6b3a" }}
            >
              Terms of Service
            </Link>
            .
          </p>
        </footer>
      </div>
    </main>
  );
}

// ─── Tiny local typography primitives ────────────────────────────

function Prose({ children }: { children: React.ReactNode }) {
  return <div className="space-y-5 text-[15px] leading-relaxed">{children}</div>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="mt-10 mb-2 font-serif text-2xl"
      style={{ color: "#1a6b3a", fontFamily: "Georgia, 'Times New Roman', serif" }}
    >
      {children}
    </h2>
  );
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="ml-5 list-disc space-y-1.5">{children}</ul>;
}

function A({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="font-medium underline-offset-2 hover:underline"
      style={{ color: "#1a6b3a" }}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
    >
      {children}
    </a>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return <li>{children}</li>;
}
