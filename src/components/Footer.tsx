import { Link } from 'react-router-dom';
import { ShoppingBag, Mail, Phone, MapPin, Sparkles, Heart } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="footer-dark relative overflow-hidden py-14 text-white">
      {/* Subtle top border */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/20" />

      <div className="container relative mx-auto px-4">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">

          {/* Brand */}
          <div className="md:col-span-1">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 shadow-sm">
                <ShoppingBag className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-sora text-xl font-extrabold text-white">UNITRADE</h3>
                <p className="text-[10px] font-medium uppercase tracking-widest text-white/70">Student Marketplace</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-white/80">
              {t('footer.about', 'The trusted student marketplace for Cameroon universities. Buy, sell, and rent items safely and affordably.')}
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-white/80">
              <li className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 flex-shrink-0 text-white" />
                <span>support@unitrade.cm</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 flex-shrink-0 text-white" />
                <span>+237 600 000 000</span>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-white" />
                <span>{t('footer.servingCameroon', 'All major universities in Cameroon')}</span>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-white">
              {t('footer.quickLinks', 'Quick Links')}
            </h4>
            <ul className="space-y-3 text-sm text-white/80">
              {[
                { to: '/marketplace', label: t('footer.browseMarketplace', 'Browse Marketplace') },
                { to: '/ai-assistant', label: 'Sasha AI Assistant' },
                { to: '/register', label: t('auth.signup', 'Sign Up Free') },
                { to: '/login', label: t('auth.login', 'Login') },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="block transition-all duration-200 hover:text-white hover:pl-1">
                    → {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-white">
              {t('footer.categories', 'Categories')}
            </h4>
            <ul className="space-y-3 text-sm text-white/80">
              {['Beds & Mattresses', 'Tables & Chairs', 'Kitchen Utensils', 'Electronics', 'Books & Textbooks', 'Clothing & Fashion'].map((cat) => (
                <li key={cat}>
                  <a href="/marketplace" className="block transition-all duration-200 hover:text-white hover:pl-1">
                    → {cat}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* AI + Universities */}
          <div>
            <h4 className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-white">
              AI Assistant
            </h4>
            <div className="mb-5 rounded-2xl border border-white/25 bg-white/15 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-white" />
                <span className="text-sm font-bold text-white">Meet Sasha</span>
              </div>
              <p className="text-xs leading-relaxed text-white/80">
                Your AI-powered shopping assistant. Ask anything, get product recommendations, room setup advice and more.
              </p>
              <Link
                to="/ai-assistant"
                className="mt-3 inline-block rounded-lg bg-white/25 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-white/35"
              >
                Chat with Sasha →
              </Link>
            </div>

            <h4 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-white">Universities</h4>
            <p className="text-xs leading-relaxed text-white/80">
              Serving UB, UYI, UYII, IUT, IRIC, ESSEC, UBa, UDs, and all major institutions across Cameroon.
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="my-10 h-px bg-white/20" />

        {/* Bottom row */}
        <div className="flex flex-col items-center justify-between gap-4 text-xs text-white/70 md:flex-row">
          <p>© 2026 UNITRADE. {t('footer.rights', 'All rights reserved.')}</p>
          <p className="flex items-center gap-1.5">
            Made with <Heart className="h-3 w-3 fill-white text-white" /> in Cameroon
          </p>
          <div className="flex gap-5">
            {['Privacy Policy', 'Terms of Service', 'FAQ'].map((link) => (
              <a key={link} href="#" className="transition-colors hover:text-white duration-200">
                {link}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
