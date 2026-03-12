import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type AppLanguage = 'en' | 'fr';

type TranslationValues = Record<string, string | number>;

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (value: AppLanguage) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string, values?: TranslationValues) => string;
};

const LANGUAGE_STORAGE_KEY = 'campusmarket-language';

const FR_TRANSLATIONS: Record<string, string> = {
  'nav.home': 'Accueil',
  'nav.marketplace': 'Marche',
  'nav.listItem': 'Ajouter article',
  'nav.favorites': 'Favoris',
  'nav.dashboard': 'Tableau de bord',
  'nav.profile': 'Mon profil',
  'nav.orders': 'Mes commandes',
  'nav.rentals': 'Mes locations',
  'nav.paymentHistory': 'Historique paiements',
  'nav.notifications': 'Notifications',
  'nav.recentlyViewed': 'Vus recemment',
  'nav.disputes': 'Centre litiges',
  'nav.reportProblem': 'Signaler probleme',
  'nav.settings': 'Parametres',
  'nav.help': 'Aide et support',
  'nav.manageListings': 'Gerer annonces',
  'nav.accountApprovals': 'Approbations comptes',
  'nav.adminPanel': 'Panneau admin',
  'nav.inbox': 'Boite de reception',
  'nav.reviews': 'Avis',
  'nav.universities': 'Universites',
  'nav.categories': 'Categories',
  'nav.analytics': 'Analytique',
  'nav.logout': 'Deconnexion',
  'auth.login': 'Connexion',
  'auth.signup': 'Inscription',
  'brand.universities': 'Universites du Cameroun',
  'language.en': 'Anglais',
  'language.fr': 'Francais',
  'language.select': 'Choisir la langue',

  'home.badge': 'CampusMarket Selection',
  'home.heroTitle': 'Decouvrez les meilleures offres et locations etudiants.',
  'home.heroSubtitle': 'Parcourez les sections comme votre reference. Chaque carte ouvre le marche avec des resultats lies.',
  'home.exploreMarketplace': 'Explorer le marche',
  'home.trendingNow': 'Tendance',
  'home.rentalsNearYou': 'Locations pres de vous',
  'home.rentalsSubtitle': 'Locations court terme et semestre proches des campus.',
  'home.browseRentals': 'Voir locations',
  'home.recommendedForYou': 'Recommande pour vous',
  'home.recommendedSubtitle': 'Choix populaires selon les tendances.',
  'home.seeRecommendations': 'Voir recommandations',
  'home.featuredSection': 'Section vedette',
  'home.quickCategories': 'Categories rapides',
  'home.shopByCategory': 'Acheter par categorie',
  'home.seeAll': 'Voir tout',
  'home.openRelatedItems': 'Ouvrir articles lies',
  'home.exploreThisCategory': 'Explorer cette categorie',
  'home.exploreAllProducts': 'Explorer tous les produits',
  'home.exploreMore': 'Explorer plus',
  'home.shopThisCategory': 'Acheter dans cette categorie',
  'home.browseLatestPicks': 'Voir derniers choix',
  'home.seeCategoryItems': 'Voir articles categorie',
  'home.discoverMore': 'Decouvrir plus',
  'home.inCategory': 'dans',
  'home.bestSellersCampusElectronics': 'Meilleures ventes en electronique campus',
  'home.bestSellersCampusElectronicsSub': 'Electronique la plus vue des universites proches.',
  'home.popularRentalsThisWeek': 'Locations populaires cette semaine',
  'home.popularRentalsThisWeekSub': 'Options de location flexibles pour le semestre.',
  'home.bestSellersHomeKitchen': 'Meilleures ventes Maison & Cuisine',
  'home.bestSellersHomeKitchenSub': 'Essentiels maison pour appartements partages.',
  'home.localFocus': 'Focus local',
  'home.moreItemsAroundUniversity': 'Plus d articles autour de votre universite',
  'home.keepBrowsing': 'Continuez a parcourir pour voir les nouvelles annonces proches.',
  'home.openMarketplaceFeed': 'Ouvrir le flux marche',
  'home.aboutLabel': 'A propos',
  'home.aboutTitle': 'Concu pour les etudiants, par des etudiants.',
  'home.aboutBody':
    'CampusMarket connecte les etudiants des universites du Cameroun pour acheter, vendre et louer en securite. Notre objectif: rendre la vie etudiante plus abordable, fiable et durable.',
  'home.aboutCta': 'Explorer la communaute du marche',
  'home.aboutPoint1Title': 'Offres abordables',
  'home.aboutPoint1Body': 'Des prix adaptes aux etudiants pour les essentiels du quotidien.',
  'home.aboutPoint2Title': 'Communaute fiable',
  'home.aboutPoint2Body': 'Utilisateurs verifies, annonces claires et avis reels.',
  'home.aboutPoint3Title': 'Oriente campus',
  'home.aboutPoint3Body': 'Concu pour la vie universitaire, les locations et les echanges rapides.',
  'home.noListings': 'Aucune annonce disponible',
  'home.noListingsSub': 'Ajoutez des annonces et la page d accueil se remplira automatiquement.',
  'home.failedLoadListings': 'Echec du chargement des annonces accueil',
  'home.unableReachListings': 'Service annonces indisponible',
  'home.unableLoadData': 'Impossible de charger les donnees accueil',

  'marketplace.title': 'Marche',
  'marketplace.subtitle': 'Parcourez les articles des etudiants des universites du Cameroun',
  'marketplace.section': 'Section',
  'marketplace.searchPlaceholder': 'Rechercher des articles...',
  'marketplace.searchLabel': 'Recherche',
  'marketplace.allCategories': 'Toutes categories',
  'marketplace.allTypes': 'Tous types',
  'marketplace.forSale': 'A vendre',
  'marketplace.forRent': 'A louer',
  'marketplace.sortBy': 'Trier par',
  'marketplace.recent': 'Plus recent',
  'marketplace.priceLow': 'Prix: croissant',
  'marketplace.priceHigh': 'Prix: decroissant',
  'marketplace.itemsFound': '{{count}} article(s) trouve(s)',
  'marketplace.new': 'Neuf',
  'marketplace.viewDetails': 'Voir details',
  'marketplace.noItems': 'Aucun article trouve',
  'marketplace.tryFilters': 'Essayez de modifier la recherche ou les filtres',
  'marketplace.unknownSeller': 'Vendeur inconnu',
  'marketplace.universityNotSpecified': 'Universite non specifiee',
  'marketplace.locationNotSpecified': 'Lieu non specifie',
  'marketplace.failedFetchListings': 'Echec de chargement des annonces',
  'marketplace.unableReachListings': 'Service annonces indisponible',
  'marketplace.unableLoadData': 'Impossible de charger les donnees du marche',
  'marketplace.failedLoadLikes': 'Impossible de charger les likes',
  'marketplace.failedUpdateLike': 'Echec de mise a jour du like',
  'marketplace.loginToLike': 'Connectez-vous pour liker des articles',

  'item.backToMarketplace': 'Retour au marche',
  'item.loading': 'Chargement...',
  'item.notFound': 'Article introuvable',
  'item.forSale': 'A vendre',
  'item.forRent': 'A louer',
  'item.new': 'Neuf',
  'item.description': 'Description',
  'item.sellerInfo': 'Informations vendeur',
  'item.verified': 'Verifie',
  'item.views': 'vues',
  'item.likes': 'likes',
  'item.reviews': 'avis',
  'item.buyNow': 'Acheter',
  'item.rentNow': 'Louer',
  'item.contactSeller': 'Contacter vendeur',
  'item.saveItem': 'Enregistrer',
  'item.saved': 'Enregistre',
  'item.yourListing': 'Ceci est votre annonce',
  'item.safetyTips': 'Conseils de securite',
  'item.tip1': 'Rencontrez-vous dans un lieu public sur le campus',
  'item.tip2': 'Verifiez l etat de l article avant paiement',
  'item.tip3': 'Utilisez seulement des moyens de paiement securises',
  'item.tip4': 'Signalez toute activite suspecte',
  'item.youMayAlsoLike': 'Vous aimerez aussi',
  'item.loadingRelated': 'Chargement des articles lies...',
  'item.noRelated': 'Aucun article lie disponible.',
  'item.loginToContact': 'Connectez-vous pour contacter le vendeur',
  'item.loginToPurchase': 'Connectez-vous pour acheter',
  'item.loginToSave': 'Connectez-vous pour enregistrer les articles',
  'item.messageOpened': 'Messagerie ouverte',
  'item.removeFavoriteFailed': 'Echec suppression favori',
  'item.removedFavorites': 'Retire des favoris',
  'item.addFavoriteFailed': 'Echec ajout favori',
  'item.addedFavorites': 'Ajoute aux favoris',
  'item.updateFavoriteFailed': 'Echec mise a jour favoris',
  'item.fetchDetailsFailed': 'Echec chargement details article',
  'item.fetchDetailsError': 'Erreur lors du chargement des details.',

  'footer.about': 'Le marche etudiant de confiance des universites du Cameroun. Achetez, vendez et louez des articles en securite.',
  'footer.quickLinks': 'Liens rapides',
  'footer.browseMarketplace': 'Parcourir le marche',
  'footer.howItWorks': 'Comment ca marche',
  'footer.categories': 'Categories',
  'footer.contactUs': 'Contactez-nous',
  'footer.servingCameroon': 'Service pour les principales universites du Cameroun',
  'footer.rights': 'Tous droits reserves.',
  'footer.privacy': 'Confidentialite',
  'footer.terms': 'Conditions',
  'footer.faq': 'FAQ',
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const resolveInitialLanguage = (): AppLanguage => {
  if (typeof window === 'undefined') return 'en';
  const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (saved === 'en' || saved === 'fr') return saved;
  const browser = window.navigator.language.toLowerCase();
  return browser.startsWith('fr') ? 'fr' : 'en';
};

const interpolate = (template: string, values?: TranslationValues) => {
  if (!values) return template;
  return Object.entries(values).reduce(
    (result, [name, value]) => result.replace(new RegExp(`{{\\s*${name}\\s*}}`, 'g'), String(value)),
    template,
  );
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>(() => resolveInitialLanguage());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const toggleLanguage = useCallback(() => {
    setLanguage((prev) => (prev === 'en' ? 'fr' : 'en'));
  }, []);

  const t = useCallback(
    (key: string, fallback?: string, values?: TranslationValues) => {
      const translated = language === 'fr' ? FR_TRANSLATIONS[key] : undefined;
      const source = translated || fallback || key;
      return interpolate(source, values);
    },
    [language],
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      t,
    }),
    [language, toggleLanguage, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
