import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

const LAST_UPDATED = '18 June 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-foreground sm:text-xl">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export function TermsOfService() {
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
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold sm:text-3xl">Terms of Service</h1>
              <p className="mt-1 text-sm text-white/80">Last updated: {LAST_UPDATED}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
          <p className="text-sm leading-relaxed text-muted-foreground">
            These Terms of Service (&ldquo;Terms&rdquo;) govern your use of UNITRADE, a student marketplace that lets
            university students in Cameroon buy, sell, and rent items. By creating an account or using the platform, you
            agree to these Terms. If you do not agree, please do not use UNITRADE.
          </p>

          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using UNITRADE you confirm that you have read, understood, and agree to be bound by these
              Terms and by our{' '}
              <Link to="/privacy" className="font-semibold text-primary hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </Section>

          <Section title="2. Eligibility">
            <p>
              UNITRADE is intended for students of universities in Cameroon. You must provide accurate registration
              details and, where requested, valid student information for verification. You must be old enough to enter
              into a binding contract.
            </p>
          </Section>

          <Section title="3. Your Account">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>You are responsible for the activity that happens under your account.</li>
              <li>Keep your password confidential and notify us of any unauthorised use.</li>
              <li>
                Accounts may act as a buyer and/or seller. Seller features may require approval and may be subject to
                verification.
              </li>
            </ul>
          </Section>

          <Section title="4. Listings &amp; Prohibited Items">
            <p>
              Sellers are responsible for the accuracy of their listings, including descriptions, photos, condition, and
              price. You may not list items that are illegal, stolen, counterfeit, unsafe, or otherwise prohibited by law
              or by UNITRADE. We may remove listings that violate these Terms.
            </p>
          </Section>

          <Section title="5. Buying, Escrow &amp; Payments">
            <p>
              Prices are shown in FCFA (XAF). Payments are made through mobile money (MTN Mobile Money and Orange Money)
              via our payment partners. When you place an order, your payment is held in <strong className="text-foreground">escrow</strong>.
              Funds are released to the seller after you confirm that you have received the item as described. If
              something goes wrong, you may request a refund before confirming receipt, subject to our dispute process.
            </p>
            <p>
              UNITRADE charges a transaction fee and/or commission on completed sales, which is shown before you confirm
              an order. Some features may also require a subscription.
            </p>
          </Section>

          <Section title="6. Rentals">
            <p>
              For items offered for rent, the rental period, price, and pickup/return arrangements are set by the seller
              and shown on the listing. Buyers and sellers are responsible for agreeing on the condition of rented items
              at handover and return.
            </p>
          </Section>

          <Section title="7. Seller Payouts &amp; Withdrawals">
            <p>
              Released funds are credited to the seller&rsquo;s wallet and may be withdrawn to a supported mobile money
              account. Withdrawals are subject to verification, available balance, applicable fees, and any minimum payout
              amount set by UNITRADE.
            </p>
          </Section>

          <Section title="8. Reviews &amp; Conduct">
            <p>
              Reviews must be honest and based on a genuine transaction. You agree to communicate respectfully and to meet
              in safe, public locations for pickups. Harassment, fraud, and abuse are not tolerated.
            </p>
          </Section>

          <Section title="9. Disputes &amp; Refunds">
            <p>
              If a buyer and seller cannot resolve an issue, either party may open a dispute. While a dispute is open,
              escrowed funds remain on hold. UNITRADE may review the order, messages, and any evidence provided and decide
              whether funds are released or refunded.
            </p>
          </Section>

          <Section title="10. Prohibited Conduct">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Posting false, misleading, or fraudulent listings or reviews.</li>
              <li>Attempting to take payments outside the platform to avoid escrow protection.</li>
              <li>Using the platform to break the law or infringe others&rsquo; rights.</li>
              <li>Interfering with, abusing, or attempting to gain unauthorised access to the service.</li>
            </ul>
          </Section>

          <Section title="11. Intellectual Property">
            <p>
              UNITRADE and its logos, design, and software are owned by us or our licensors. You retain ownership of the
              content you post, but you grant UNITRADE a licence to host and display it for the purpose of operating the
              marketplace.
            </p>
          </Section>

          <Section title="12. Disclaimers &amp; Limitation of Liability">
            <p>
              UNITRADE is a venue that connects buyers and sellers; we are not the seller of listed items. The service is
              provided &ldquo;as is&rdquo; without warranties of any kind. To the maximum extent permitted by law,
              UNITRADE is not liable for indirect or consequential damages arising from your use of the platform or from
              transactions between users.
            </p>
          </Section>

          <Section title="13. Suspension &amp; Termination">
            <p>
              We may suspend, ban, or terminate accounts that violate these Terms or that pose a risk to the community.
              You may stop using UNITRADE at any time and request that your account be deleted.
            </p>
          </Section>

          <Section title="14. Governing Law">
            <p>These Terms are governed by the laws of the Republic of Cameroon.</p>
          </Section>

          <Section title="15. Changes to These Terms">
            <p>
              We may update these Terms from time to time. When we do, we will revise the &ldquo;Last updated&rdquo; date
              above. Continued use of UNITRADE after changes take effect means you accept the updated Terms.
            </p>
          </Section>

          <Section title="16. Contact Us">
            <p>
              Questions about these Terms? Email us at{' '}
              <a href="mailto:support@unitrade.cm" className="font-semibold text-primary hover:underline">
                support@unitrade.cm
              </a>
              .
            </p>
          </Section>

          <p className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
            See also our{' '}
            <Link to="/privacy" className="font-semibold text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
