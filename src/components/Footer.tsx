import { Link } from 'react-router-dom';
import { ShoppingBag, Mail, Phone, MapPin } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-border bg-card text-muted-foreground pt-12 pb-6">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* About */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 bg-green-600 rounded-lg flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-foreground font-bold text-lg">CampusMarket</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t(
                'footer.about',
                'The trusted student marketplace for Cameroon universities. Buy, sell, and rent household items safely and affordably.',
              )}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-foreground font-semibold mb-4">{t('footer.quickLinks', 'Quick Links')}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/marketplace" className="hover:text-green-400 transition-colors">
                  {t('footer.browseMarketplace', 'Browse Marketplace')}
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-green-400 transition-colors">
                  {t('auth.signup', 'Sign Up')}
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-green-400 transition-colors">
                  {t('auth.login', 'Login')}
                </Link>
              </li>
              <li>
                <a href="#" className="hover:text-green-400 transition-colors">
                  {t('footer.howItWorks', 'How It Works')}
                </a>
              </li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-foreground font-semibold mb-4">{t('footer.categories', 'Categories')}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-green-400 transition-colors">
                  Beds & Mattresses
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-green-400 transition-colors">
                  Tables & Chairs
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-green-400 transition-colors">
                  Kitchen Utensils
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-green-400 transition-colors">
                  Electronics
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-foreground font-semibold mb-4">{t('footer.contactUs', 'Contact Us')}</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <Mail className="h-4 w-4 mt-0.5 text-green-400 flex-shrink-0" />
                <span>support@campusmarket.cm</span>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="h-4 w-4 mt-0.5 text-green-400 flex-shrink-0" />
                <span>+237 600 000 000</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 text-green-400 flex-shrink-0" />
                <span>{t('footer.servingCameroon', 'Serving all major universities in Cameroon')}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © 2026 CampusMarket. {t('footer.rights', 'All rights reserved.')}
          </p>
          <div className="flex gap-6 text-sm">
            <a href="#" className="hover:text-green-400 transition-colors">
              {t('footer.privacy', 'Privacy Policy')}
            </a>
            <a href="#" className="hover:text-green-400 transition-colors">
              {t('footer.terms', 'Terms of Service')}
            </a>
            <a href="#" className="hover:text-green-400 transition-colors">
              {t('footer.faq', 'FAQ')}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
