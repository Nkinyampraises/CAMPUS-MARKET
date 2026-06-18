import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

const LAST_UPDATED = '18 June 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-foreground sm:text-xl">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export function PrivacyPolicy() {
  return (
    <div className="bg-background">
      {/* Hero band */}
      <div className="bg-gradient-to-br from-forest to-forest-dark text-primary-foreground">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/80 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <div className="mt-6 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold sm:text-3xl">Privacy Policy</h1>
              <p className="mt-1 text-sm text-white/80">Last updated: {LAST_UPDATED}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
          <p className="text-sm leading-relaxed text-muted-foreground">
            UNITRADE (&ldquo;UNITRADE&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is a student marketplace that helps
            university students across Cameroon buy, sell, and rent items safely. This Privacy Policy explains what
            information we collect when you use UNITRADE, how we use it, and the choices you have. By creating an account
            or using the platform, you agree to the practices described below.
          </p>

          <Section title="1. Information We Collect">
            <p>We collect the information you provide and the information generated as you use UNITRADE:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-foreground">Account details</strong> — your name, email address, phone number,
                university, and (where applicable) student verification information.
              </li>
              <li>
                <strong className="text-foreground">Listings &amp; content</strong> — items you post, descriptions,
                photos, prices, condition, and pickup locations.
              </li>
              <li>
                <strong className="text-foreground">Transactions</strong> — orders, escrow records, wallet balances,
                payouts, and withdrawals (amounts are recorded in FCFA).
              </li>
              <li>
                <strong className="text-foreground">Communications</strong> — messages exchanged with other users,
                reviews, reports, and support requests.
              </li>
              <li>
                <strong className="text-foreground">Technical data</strong> — device, browser, and usage information
                needed to operate and secure the service.
              </li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Information">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Create and manage your account and verify student eligibility.</li>
              <li>Publish your listings and connect buyers and sellers.</li>
              <li>Process orders, hold funds in escrow, and release payouts to sellers.</li>
              <li>Enable messaging, reviews, notifications, and our AI assistant.</li>
              <li>Detect fraud, enforce our Terms of Service, and keep the community safe.</li>
              <li>Improve the platform and provide customer support.</li>
            </ul>
          </Section>

          <Section title="3. Payments &amp; Escrow">
            <p>
              Payments are processed through mobile money providers (MTN Mobile Money and Orange Money) via our payment
              partners. When you pay for an order, funds are held in escrow until you confirm receipt, at which point they
              are released to the seller. We store transaction records (such as amount, status, and a provider reference)
              but we do not store your mobile money PIN or full payment credentials.
            </p>
          </Section>

          <Section title="4. How We Share Information">
            <p>We share information only as needed to run the marketplace:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-foreground">With other users</strong> — when you transact, the other party sees
                relevant details such as your name, university, rating, and the listing or order involved.
              </li>
              <li>
                <strong className="text-foreground">With service providers</strong> — payment processors, hosting, and
                email providers that help us operate UNITRADE.
              </li>
              <li>
                <strong className="text-foreground">For legal reasons</strong> — when required by law or to protect the
                rights, safety, and property of our users and UNITRADE.
              </li>
            </ul>
            <p>We do not sell your personal information.</p>
          </Section>

          <Section title="5. Data Retention">
            <p>
              We keep your information for as long as your account is active and as needed to provide the service, comply
              with legal obligations, resolve disputes, and enforce our agreements. You may request deletion of your
              account as described below.
            </p>
          </Section>

          <Section title="6. Security">
            <p>
              We protect accounts using industry practices including hashed passwords, signed access tokens, and optional
              two-factor authentication by email. No system is perfectly secure, so please use a strong password and keep
              your login details confidential.
            </p>
          </Section>

          <Section title="7. Your Rights &amp; Choices">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Access and update your profile information from your account settings.</li>
              <li>Manage notification and language preferences.</li>
              <li>Request a copy or deletion of your personal data by contacting us.</li>
            </ul>
          </Section>

          <Section title="8. Cookies &amp; Local Storage">
            <p>
              We use browser local storage and similar technologies to keep you signed in and to remember preferences
              such as your chosen language. These are required for the app to function correctly.
            </p>
          </Section>

          <Section title="9. Student Eligibility">
            <p>
              UNITRADE is intended for university students in Cameroon. The platform is not directed at children, and you
              must be old enough to enter into a binding agreement to use it.
            </p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. When we do, we will revise the &ldquo;Last
              updated&rdquo; date above. Continued use of UNITRADE after changes take effect means you accept the updated
              policy.
            </p>
          </Section>

          <Section title="11. Contact Us">
            <p>
              Questions about this Privacy Policy? Email us at{' '}
              <a href="mailto:support@unitrade.cm" className="font-semibold text-primary hover:underline">
                support@unitrade.cm
              </a>
              .
            </p>
          </Section>

          <p className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
            See also our{' '}
            <Link to="/terms" className="font-semibold text-primary hover:underline">
              Terms of Service
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
