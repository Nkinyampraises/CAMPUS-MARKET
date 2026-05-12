import { Link } from 'react-router-dom';
import { ShoppingBag, Mail, Phone, MapPin, Sparkles, Heart } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="footer-dark relative overflow-hidden py-14 text-white">
      {/* Decorative glows */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(10,157,143,0.18),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(124,58,237,0.10),transparent_45%)]" />
      {/* Top divider glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/40 to-transparent" />

      <div className="container relative mx-auto px-4">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">

          {/* Brand */}
          <div className="md:col-span-1">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 shadow-lg shadow-teal-900/50">
                <ShoppingBag className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-sora text-xl font-extrabold text-white">UNITRADE</h3>
                <p className="text-[10px] font-medium uppercase tracking-widest text-teal-400/70">Campus Marketplace</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-teal-100/50">
              {t('footer.about', 'The trusted student marketplace for Cameroon universities. Buy, sell, and rent items safely and affordably.')}
            </p>
            {/* Contact */}
            <ul className="mt-5 space-y-2.5 text-sm text-teal-100/50">
              <li className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 flex-shrink-0 text-teal-400" />
                <span>support@unitrade.cm</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 flex-shrink-0 text-teal-400" />
                <span>+237 600 000 000</span>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-teal-400" />
                <span>{t('footer.servingCameroon', 'All major universities in Cameroon')}</span>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-teal-300">
              {t('footer.quickLinks', 'Quick Links')}
            </h4>
            <ul className="space-y-3 text-sm text-teal-100/55">
              {[
                { to: '/marketplace', label: t('footer.browseMarketplace', 'Browse Marketplace') },
                { to: '/ai-assistant', label: 'Sasha AI Assistant' },
                { to: '/register', label: t('auth.signup', 'Sign Up Free') },
                { to: '/login', label: t('auth.login', 'Login') },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="transition-colors hover:text-teal-300 hover:pl-1 duration-200 block">
                    → {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-teal-300">
              {t('footer.categories', 'Categories')}
            </h4>
            <ul className="space-y-3 text-sm text-teal-100/55">
              {['Beds & Mattresses', 'Tables & Chairs', 'Kitchen Utensils', 'Electronics', 'Books & Textbooks', 'Clothing & Fashion'].map((cat) => (
                <li key={cat}>
                  <a href="/marketplace" className="transition-colors hover:text-teal-300 hover:pl-1 duration-200 block">
                    → {cat}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* AI + Universities */}
          <div>
            <h4 className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-teal-300">
              AI Assistant
            </h4>
            <div className="mb-5 rounded-2xl border border-teal-500/20 bg-teal-900/30 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-teal-400" />
                <span className="text-sm font-semibold text-white">Meet Sasha</span>
              </div>
              <p className="text-xs leading-relaxed text-teal-100/60">
                Your AI-powered shopping assistant. Ask anything, get product recommendations, room setup advice and more.
              </p>
              <Link
                to="/ai-assistant"
                className="mt-3 inline-block rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition-all hover:opacity-90"
              >
                Chat with Sasha →
              </Link>
            </div>

            <h4 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Universities</h4>
            <p className="text-xs leading-relaxed text-teal-100/50">
              Serving UB, UYI, UYII, IUT, IRIC, ESSEC, UBa, UDs, and all major institutions across Cameroon.
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="my-10 h-px bg-gradient-to-r from-transparent via-teal-500/25 to-transparent" />

        {/* Bottom row */}
        <div className="flex flex-col items-center justify-between gap-4 text-xs text-teal-100/35 md:flex-row">
          <p>© 2026 UNITRADE. {t('footer.rights', 'All rights reserved.')}</p>
          <p className="flex items-center gap-1.5">
            Made with <Heart className="h-3 w-3 fill-rose-400 text-rose-400" /> in Cameroon
          </p>
          <div className="flex gap-5">
            {['Privacy Policy', 'Terms of Service', 'FAQ'].map((link) => (
              <a key={link} href="#" className="transition-colors hover:text-teal-300 duration-200">
                {link}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
