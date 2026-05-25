import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service · LockBox",
  description:
    "The Terms of Service that govern your use of LockBox — a behavioral accountability fintech app for protecting savings from impulse spending.",
  openGraph: {
    title: "Terms of Service · LockBox",
    description:
      "The Terms of Service that govern your use of LockBox.",
    url: "https://www.lockboxfinance.com/terms",
    siteName: "LockBox",
    type: "article",
  },
  alternates: { canonical: "https://www.lockboxfinance.com/terms" },
};

const LAST_UPDATED = "May 25, 2026";

export default function TermsPage() {
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
            href="/privacy"
            className="font-medium hover:underline"
            style={{ color: "#1a6b3a" }}
          >
            Privacy Policy →
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
            Terms of Service
          </h1>
          <p className="mt-4 text-sm text-neutral-600">
            Last updated: {LAST_UPDATED}
          </p>
        </header>

        <Prose>
          <P>
            Welcome to LockBox. These Terms of Service (&ldquo;Terms&rdquo;)
            are a binding agreement between you and LockBox Financial,
            Inc. (&ldquo;LockBox,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) and govern your access to
            and use of the LockBox mobile and web applications, the
            website at lockboxfinance.com, and any related services
            (collectively, the &ldquo;Service&rdquo;). By creating an account or
            using the Service you agree to be bound by these Terms.
          </P>

          <H2 id="eligibility">1. Eligibility</H2>
          <P>
            You must be at least 18 years old, a resident of the United
            States, and legally able to enter into a binding contract to
            use the Service. By signing up you represent that you meet
            these requirements and that the information you provide is
            accurate and complete.
          </P>

          <H2 id="accounts">2. Your Account</H2>
          <P>
            You are responsible for maintaining the confidentiality of
            your account credentials and for all activity that occurs
            under your account. Notify us immediately at{" "}
            <A href="mailto:support@lockboxfinance.com">
              support@lockboxfinance.com
            </A>{" "}
            if you suspect unauthorized access. You agree to keep your
            contact information current so that we can reach you about
            your account and verify withdrawal activity.
          </P>

          <H2 id="service">3. What LockBox Does</H2>
          <P>
            LockBox helps you protect money from impulse spending by
            letting you place real funds into named &ldquo;boxes&rdquo; with
            different lock types — Flexible (soft), Fully Locked (hard),
            or Keyholder-protected (requires a trusted person&rsquo;s
            approval to release). LockBox is a savings-discipline tool;
            it is not a bank, broker-dealer, or investment advisor.
            Money you deposit is held by our partner financial
            institutions on your behalf.
          </P>

          <H2 id="bank-linking">4. Bank Linking via Plaid</H2>
          <P>
            To fund a box you may link an external bank account through
            our integration with Plaid Inc. By linking a bank you
            authorize Plaid and LockBox to access and use information
            from that account (including balances, transaction history,
            and account and routing numbers) to enable deposits,
            withdrawals, and balance display inside the Service. Your
            use of Plaid is also subject to Plaid&rsquo;s{" "}
            <A href="https://plaid.com/legal/#end-user-privacy-policy">
              End User Privacy Policy
            </A>
            .
          </P>

          <H2 id="identity">5. Identity Verification &amp; SSN</H2>
          <P>
            We are required by law to verify the identity of every
            account holder before moving money on your behalf. During
            onboarding you will be asked to provide your legal name,
            date of birth, address, and Social Security number. Your
            full SSN is transmitted over an encrypted connection,
            verified through our identity provider, and{" "}
            <strong>
              never stored in plain text in LockBox systems
            </strong>
            ; only the last four digits are retained for support
            verification. We may decline to open or may close an
            account that we cannot verify.
          </P>

          <H2 id="keyholders">6. Keyholder Relationships</H2>
          <P>
            A Keyholder is a person you designate to approve early
            unlock requests on specific boxes. By inviting a Keyholder
            you authorize LockBox to share with them the box name, the
            amount you are requesting to release, and any reason you
            provide. Keyholders never see your account balances,
            transaction history, or other boxes. You can revoke a
            Keyholder at any time; revocation does not retroactively
            undo approvals already granted.
          </P>

          <H2 id="prohibited">7. Prohibited Use</H2>
          <P>You agree not to use the Service to:</P>
          <Ul>
            <Li>
              Violate any law, regulation, or third-party right;
            </Li>
            <Li>
              Launder money, finance illegal activity, or facilitate
              fraud;
            </Li>
            <Li>
              Open an account on behalf of another person without
              authorization, or provide false identity information;
            </Li>
            <Li>
              Attempt to bypass lock enforcement, including by
              reverse-engineering the app or interfering with our
              servers;
            </Li>
            <Li>
              Use the Service to harass another person, including a
              Keyholder.
            </Li>
          </Ul>

          <H2 id="fees">8. Fees</H2>
          <P>
            LockBox is currently free to use. We may introduce paid
            features in the future and will give you advance notice
            and the opportunity to decline before any charge is
            applied to your account. Third parties (for example, your
            linked bank) may charge fees for transfers; those are
            outside LockBox&rsquo;s control.
          </P>

          <H2 id="disclaimers">9. Disclaimers</H2>
          <P>
            THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE,&rdquo;
            WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
            INCLUDING THE IMPLIED WARRANTIES OF MERCHANTABILITY,
            FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            LockBox does not guarantee that the Service will be
            uninterrupted, error-free, or that any specific outcome
            (including a financial outcome) will result from your use.
          </P>

          <H2 id="liability">10. Limitation of Liability</H2>
          <P>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, LOCKBOX AND ITS
            OFFICERS, EMPLOYEES, AND AGENTS WILL NOT BE LIABLE FOR ANY
            INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
            DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, ARISING OUT
            OF OR RELATED TO YOUR USE OF THE SERVICE. OUR TOTAL
            LIABILITY FOR ANY CLAIM WILL NOT EXCEED THE GREATER OF
            $100 OR THE AMOUNT YOU PAID US IN THE TWELVE MONTHS BEFORE
            THE CLAIM AROSE.
          </P>

          <H2 id="disputes">11. Dispute Resolution</H2>
          <P>
            Any dispute arising under these Terms will be resolved by
            binding individual arbitration administered by the American
            Arbitration Association under its Consumer Arbitration
            Rules, except that either party may bring an individual
            claim in small-claims court. You and LockBox each waive any
            right to a jury trial and to participate in a class action.
            These Terms are governed by the laws of the State of
            Delaware, without regard to its conflict-of-laws rules.
          </P>

          <H2 id="termination">12. Termination</H2>
          <P>
            You may close your account at any time from within the app.
            We may suspend or terminate your account if you violate
            these Terms, if we are required to do so by law, or if we
            decide to discontinue the Service. Where it is safe and
            lawful to do so, we will give you reasonable notice and a
            chance to retrieve any funds you have on the platform.
          </P>

          <H2 id="changes">13. Changes to These Terms</H2>
          <P>
            We may update these Terms from time to time. Material
            changes will be announced inside the app or by email at
            least 14 days before they take effect; continued use of the
            Service after a change takes effect constitutes acceptance
            of the updated Terms.
          </P>

          <H2 id="contact">14. Contact</H2>
          <P>
            Questions about these Terms? Email{" "}
            <A href="mailto:support@lockboxfinance.com">
              support@lockboxfinance.com
            </A>
            .
          </P>
        </Prose>

        <footer className="mt-16 border-t pt-8 text-sm text-neutral-600"
          style={{ borderColor: "#1a6b3a33" }}>
          <p>
            Last updated: {LAST_UPDATED}. See also our{" "}
            <Link
              href="/privacy"
              className="font-medium hover:underline"
              style={{ color: "#1a6b3a" }}
            >
              Privacy Policy
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

function Li({ children }: { children: React.ReactNode }) {
  return <li>{children}</li>;
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
