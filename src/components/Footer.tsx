import { Link } from 'react-router-dom';
import { ShoppingBag, Mail, Phone, MapPin } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="relative border-t border-border/70 bg-card/65 py-10 text-muted-foreground backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(14,165,164,0.18),transparent_32%),radial-gradient(circle_at_85%_100%,rgba(56,189,248,0.12),transparent_36%)]" />
      <div className="container relative mx-auto px-4">
        <div className="rounded-3xl border border-border/70 bg-background/75 p-7 shadow-[0_30px_56px_-42px_rgba(8,32,48,0.65)] backdrop-blur">
          <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-4">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-foreground">UNITRADE</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {t(
                  'footer.about',
                  'The trusted student marketplace for Cameroon universities. Buy, sell, and rent household items safely and affordably.',
                )}
              </p>
            </div>

            <div>
              <h4 className="mb-4 font-semibold text-foreground">{t('footer.quickLinks', 'Quick Links')}</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/marketplace" className="transition-colors hover:text-primary">
                    {t('footer.browseMarketplace', 'Browse Marketplace')}
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="transition-colors hover:text-primary">
                    {t('auth.signup', 'Sign Up')}
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="transition-colors hover:text-primary">
                    {t('auth.login', 'Login')}
                  </Link>
                </li>
                <li>
                  <a href="#" className="transition-colors hover:text-primary">
                    {t('footer.howItWorks', 'How It Works')}
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 font-semibold text-foreground">{t('footer.categories', 'Categories')}</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="transition-colors hover:text-primary">
                    Beds & Mattresses
                  </a>
                </li>
                <li>
                  <a href="#" className="transition-colors hover:text-primary">
                    Tables & Chairs
                  </a>
                </li>
                <li>
                  <a href="#" className="transition-colors hover:text-primary">
                    Kitchen Utensils
                  </a>
                </li>
                <li>
                  <a href="#" className="transition-colors hover:text-primary">
                    Electronics
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 font-semibold text-foreground">{t('footer.contactUs', 'Contact Us')}</h4>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>support@UNITRADE.cm</span>
                </li>
                <li className="flex items-start gap-2">
                  <Phone className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>+237 600 000 000</span>
                </li>
                <li className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>{t('footer.servingCameroon', 'Serving all major universities in Cameroon')}</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-border/70 pt-6 text-sm md:flex-row">
            <p className="text-muted-foreground">
              © 2026 UNITRADE. {t('footer.rights', 'All rights reserved.')}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm md:justify-end">
              <a href="#" className="transition-colors hover:text-primary">
                {t('footer.privacy', 'Privacy Policy')}
              </a>
              <a href="#" className="transition-colors hover:text-primary">
                {t('footer.terms', 'Terms of Service')}
              </a>
              <a href="#" className="transition-colors hover:text-primary">
                {t('footer.faq', 'FAQ')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
