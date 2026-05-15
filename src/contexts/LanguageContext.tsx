import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { translateText } from '@/lib/translate';

export type AppLanguage = 'en' | 'fr';

type TranslationValues = Record<string, string | number>;

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (value: AppLanguage) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string, values?: TranslationValues) => string;
};

const LANGUAGE_STORAGE_KEY = 'UNITRADE-language';

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

  'home.badge': 'UNITRADE Selection',
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
    'UNITRADE connecte les etudiants des universites du Cameroun pour acheter, vendre et louer en securite. Notre objectif: rendre la vie etudiante plus abordable, fiable et durable.',
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

  // ── Sasha AI Assistant ────────────────────────────────────────────────────
  'assistant.title': 'Assistant IA',
  'assistant.subtitle': 'Discutez avec Sasha pour decouvrir des produits, idees d\'amenagement et essentiels cuisine.',
  'assistant.placeholder': 'Posez une question a Sasha — produits, conseils, science, tech...',
  'assistant.quickPlaceholder': 'Demandez a Sasha rapidement...',
  'assistant.quickChat': 'Chat rapide avec Sasha',
  'assistant.quickEmpty': 'Demandez des recommandations de produits, des conseils de chambre ou posez n\'importe quelle question!',
  'assistant.quickMode': 'Mode rapide',
  'assistant.launch': 'Ouvrir l\'assistant Sasha',
  'assistant.launchLabel': 'Bonjour! Je suis Sasha',
  'assistant.launchQuick': 'Basculer le chat rapide Sasha',
  'assistant.openFull': 'Ouvrir l\'assistant complet',
  'assistant.close': 'Fermer',
  'assistant.loading': 'Chargement de l\'historique...',
  'assistant.newChat': 'Nouvelle conversation',
  'assistant.chatsMenu': 'Historique des conversations',
  'assistant.openChatsMenu': 'Ouvrir l\'historique',
  'assistant.chatTitle': 'Sasha — Assistant IA',
  'assistant.chatHint': 'Posez une question sur les produits, l\'amenagement de chambre ou les essentiels...',
  'assistant.recents': 'Conversations recentes',
  'assistant.noRecents': 'Aucune conversation recente',
  'assistant.clearCurrent': 'Effacer cette conversation',
  'assistant.cleared': 'Conversation effacee',
  'assistant.failedClear': 'Echec de la suppression',
  'assistant.failedReply': 'Echec de la reponse de l\'assistant',
  'assistant.defaultReply': 'Je suis la pour vous aider a trouver les meilleurs articles sur Campus Market.',
  'assistant.backMarketplace': 'Retour au marche',
  'assistant.imageLimit': 'Maximum 3 images par message',
  'assistant.imageMessage': 'Image jointe',
  'assistant.imageOnly': 'Seules les images sont acceptees',
  'assistant.maxImages': 'Limite d\'images atteinte (3 max)',
  'assistant.emptyTranscript': 'Aucun message dans cette conversation',
  'assistant.transcribeFailed': 'Echec de la transcription vocale',
  'assistant.transcribing': 'Transcription en cours...',
  'assistant.voicePermission': 'Permission microphone refusee. Verifiez les parametres de votre navigateur.',
  'assistant.voiceReady': 'Microphone pret — parlez maintenant',
  'assistant.voiceUnsupported': 'La saisie vocale n\'est pas prise en charge sur ce navigateur',

  // ── Marketplace (missing keys) ────────────────────────────────────────────
  'marketplace.allUniversities': 'Toutes les universites',
  'marketplace.category': 'Categorie',
  'marketplace.categoryNotSpecified': 'Categorie non specifiee',
  'marketplace.priceRange': 'Fourchette de prix',
  'marketplace.university': 'Universite',
  'marketplace.clearAll': 'Tout effacer',
  'marketplace.clearFilters': 'Effacer les filtres',
  'marketplace.likes': 'J\'aime',
  'marketplace.noDescription': 'Aucune description disponible.',
  'marketplace.verifiedStudent': 'Etudiant verifie',
  'marketplace.description': 'Description',
  'marketplace.itemsAvailable': 'disponibles',

  // ── Item details (missing keys) ───────────────────────────────────────────
  'item.condition': 'Etat',
  'item.relatedDeals': 'Offres similaires',

  // ── Home (missing keys) ───────────────────────────────────────────────────
  'home.featuredToday': 'A la une aujourd\'hui',
  'home.amazonHero1Title': 'Achats abordables pour etudiants',
  'home.amazonHero1Cta': 'Parcourir le marche',
  'home.amazonHero2Title': 'Locations flexibles pour le semestre',
  'home.amazonHero2Cta': 'Voir les locations',
  'home.amazonHero3Title': 'Articles pres de votre campus',
  'home.amazonHero3Cta': 'Explorer tous les articles',
  'home.amazonCategorySub': 'Parcourez notre selection complete de produits',
  'home.dealOfTheDay': 'Offre du jour',
  'home.dealOfTheDaySub': 'Meilleures offres des vendeurs etudiants verifies',
  'home.freshCampusDeals': 'Nouvelles offres campus',
  'home.grabDeal': 'Saisir l\'offre',
  'home.homeDecorLabel': 'Decoration interieure',
  'home.homeDecorPick': 'Coup de coeur deco',
  'home.nextSlide': 'Diapositive suivante',
  'home.previousSlide': 'Diapositive precedente',
  'home.seeAllDeals': 'Voir toutes les offres',
  'home.seeMore': 'Voir plus',

  // ── Auth ──────────────────────────────────────────────────────────────────
  'auth.forgotPassword': 'Mot de passe oublie',
  'auth.resetPassword': 'Reinitialiser le mot de passe',
  'auth.confirmEmail': 'Confirmer l\'email',
  'auth.email': 'Email',
  'auth.password': 'Mot de passe',
  'auth.name': 'Nom complet',
  'auth.phone': 'Telephone',
  'auth.university': 'Universite',
  'auth.studentId': 'Numero etudiant',
  'auth.userType': 'Type de compte',
  'auth.buyer': 'Acheteur',
  'auth.seller': 'Vendeur',
  'auth.createAccount': 'Creer un compte',
  'auth.alreadyHaveAccount': 'Vous avez deja un compte?',
  'auth.noAccount': 'Pas encore de compte?',
  'auth.rememberMe': 'Se souvenir de moi',
  'auth.sendLink': 'Envoyer le lien',

  // ── Listing / Add listing ─────────────────────────────────────────────────
  'listing.createNew': 'Creer une nouvelle annonce',
  'listing.title': 'Titre de l\'article',
  'listing.description': 'Description',
  'listing.category': 'Categorie',
  'listing.price': 'Prix (FCFA)',
  'listing.condition': 'Etat',
  'listing.type': 'Type d\'annonce',
  'listing.forSale': 'A vendre',
  'listing.forRent': 'A louer',
  'listing.photos': 'Photos',
  'listing.uploadPhotos': 'Ajouter des photos',
  'listing.publish': 'Publier l\'annonce',
  'listing.save': 'Enregistrer',
  'listing.cancel': 'Annuler',
  'listing.location': 'Lieu',
  'listing.new': 'Neuf',
  'listing.good': 'Bon etat',
  'listing.fair': 'Etat correct',
  'listing.poor': 'Mauvais etat',
  'listing.preview': 'Apercu de l\'annonce',
  'listing.completion': 'Avancement',
  'listing.steps.titleDesc': 'Titre et description',
  'listing.steps.categoryLoc': 'Categorie et lieu',
  'listing.steps.priceCondition': 'Prix et etat',
  'listing.steps.photo': 'Au moins une photo',

  // ── Checkout / Payment ────────────────────────────────────────────────────
  'checkout.title': 'Paiement securise',
  'checkout.orderSummary': 'Resume de commande',
  'checkout.paymentMethod': 'Mode de paiement',
  'checkout.pickupDetails': 'Details de recuperation',
  'checkout.preferredDate': 'Date preferee',
  'checkout.preferredTime': 'Heure preferee',
  'checkout.meetingLocation': 'Lieu de rencontre',
  'checkout.reviewPayment': 'Verifier le paiement',
  'checkout.subtotal': 'Sous-total',
  'checkout.platformFee': 'Frais de plateforme',
  'checkout.total': 'Total',
  'checkout.escrowNote': 'Les paiements sont retenus en depot fiduciaire jusqu\'a confirmation de recuperation.',
  'checkout.mtnMomo': 'MTN Mobile Money',
  'checkout.orangeMoney': 'Orange Money',
  'checkout.instantProcessing': 'Traitement instantane',
  'payment.reviewTitle': 'Verifier votre paiement',
  'payment.reviewSubtitle': 'Verifiez les details avant de confirmer. Les fonds seront retenus en depot fiduciaire.',
  'payment.sender': 'Expediteur',
  'payment.receiver': 'Destinataire',
  'payment.confirmBtn': 'Confirmer le paiement',
  'payment.cancelBtn': 'Annuler la transaction',
  'payment.summary': 'Resume du paiement',
  'payment.itemPrice': 'Prix de l\'article',
  'payment.escrowProtection': 'Protection depot fiduciaire',
  'payment.totalPayable': 'Total a payer',
  'payment.buyerProtection': 'Protection acheteur active.',
  'payment.safeNote': 'Votre argent est en securite jusqu\'a confirmation de reception.',

  // ── Orders / Rentals ──────────────────────────────────────────────────────
  'order.title': 'Details de la commande',
  'order.status': 'Statut',
  'order.paid': 'Paye',
  'order.pending': 'En attente',
  'order.delivered': 'Livre',
  'order.confirmed': 'Confirme',
  'order.cancelled': 'Annule',
  'order.pickupDate': 'Date de recuperation',
  'order.pickupTime': 'Heure de recuperation',
  'order.pickupPoint': 'Point de recuperation',
  'order.confirmDelivery': 'Confirmer la livraison',
  'order.requestRefund': 'Demander un remboursement',
  'order.buyerInfo': 'Informations acheteur',
  'order.sellerInfo': 'Informations vendeur',
  'order.escrowOrders': 'Commandes en depot fiduciaire',
  'order.escrowDesc': 'Statut de paiement et flux de confirmation de livraison.',
  'order.noOrders': 'Aucune commande trouvee.',

  // ── Buyer Dashboard ───────────────────────────────────────────────────────
  'buyer.dashboard': 'Tableau de bord acheteur',
  'buyer.totalOrders': 'Total des commandes',
  'buyer.pendingDelivery': 'Livraison en attente',
  'buyer.totalSpent': 'Total depense',
  'buyer.savedItems': 'Articles sauvegardes',
  'buyer.myOrders': 'Mes commandes',
  'buyer.savedItemsTab': 'Articles sauvegardes',
  'buyer.messages': 'Messages',
  'buyer.escrowTransactions': 'Transactions en depot',
  'buyer.awaitingConfirmation': 'En attente de confirmation vendeur',
  'buyer.acrossOrders': 'Sur toutes les commandes',
  'buyer.wishlistItems': 'Articles en liste de souhaits',

  // ── Seller Dashboard ──────────────────────────────────────────────────────
  'seller.dashboard': 'Tableau de bord vendeur',
  'seller.totalListings': 'Total des annonces',
  'seller.activeListings': 'Annonces actives',
  'seller.pendingOrders': 'Commandes en attente',
  'seller.totalEarnings': 'Revenus totaux',
  'seller.myListings': 'Mes annonces',
  'seller.addListing': 'Ajouter une annonce',
  'seller.editListing': 'Modifier l\'annonce',
  'seller.deleteListing': 'Supprimer l\'annonce',
  'seller.publishListing': 'Publier l\'annonce',
  'seller.markSold': 'Marquer comme vendu',

  // ── Messages ──────────────────────────────────────────────────────────────
  'messages.title': 'Messages',
  'messages.search': 'Rechercher des messages...',
  'messages.noMessages': 'Aucun message',
  'messages.typeMessage': 'Tapez un message...',
  'messages.send': 'Envoyer',
  'messages.online': 'En ligne',
  'messages.offline': 'Hors ligne',
  'messages.calling': 'Appel en cours...',
  'messages.videoCall': 'Appel video',
  'messages.voiceCall': 'Appel vocal',

  // ── Profile / Settings ────────────────────────────────────────────────────
  'profile.title': 'Mon profil',
  'profile.editProfile': 'Modifier le profil',
  'profile.save': 'Enregistrer',
  'profile.name': 'Nom',
  'profile.email': 'Email',
  'profile.phone': 'Telephone',
  'profile.university': 'Universite',
  'profile.bio': 'Biographie',
  'profile.listings': 'Annonces',
  'profile.reviews': 'Avis',
  'profile.rating': 'Note',
  'settings.title': 'Parametres',
  'settings.account': 'Compte',
  'settings.notifications': 'Notifications',
  'settings.privacy': 'Confidentialite',
  'settings.language': 'Langue',
  'settings.theme': 'Theme',
  'settings.deleteAccount': 'Supprimer le compte',

  // ── Notifications ─────────────────────────────────────────────────────────
  'notifications.title': 'Notifications',
  'notifications.noNotifications': 'Aucune notification',
  'notifications.markAllRead': 'Tout marquer comme lu',
  'notifications.newOrder': 'Nouvelle commande',
  'notifications.orderUpdate': 'Mise a jour de commande',
  'notifications.newMessage': 'Nouveau message',
  'notifications.paymentReceived': 'Paiement recu',

  // ── Help & Support ────────────────────────────────────────────────────────
  'help.title': 'Aide et support',
  'help.faq': 'Questions frequentes',
  'help.contactSupport': 'Contacter le support',
  'help.reportProblem': 'Signaler un probleme',
  'help.howToBuy': 'Comment acheter',
  'help.howToSell': 'Comment vendre',
  'help.howToRent': 'Comment louer',
  'help.escrowExplained': 'Qu\'est-ce que le depot fiduciaire?',
  'help.safetyTips': 'Conseils de securite',

  // ── Favorites ────────────────────────────────────────────────────────────
  'favorites.title': 'Articles sauvegardes',
  'favorites.noFavorites': 'Aucun article sauvegarde',
  'favorites.noFavoritesSub': 'Cliquez sur le coeur d\'un article pour l\'ajouter a vos favoris.',
  'favorites.remove': 'Retirer',

  // ── Reviews ───────────────────────────────────────────────────────────────
  'review.title': 'Laisser un avis',
  'review.rating': 'Note',
  'review.comment': 'Commentaire',
  'review.submit': 'Soumettre l\'avis',
  'review.thankYou': 'Merci pour votre avis!',

  // ── Common ────────────────────────────────────────────────────────────────
  'common.loading': 'Chargement...',
  'common.error': 'Une erreur s\'est produite',
  'common.retry': 'Reessayer',
  'common.save': 'Enregistrer',
  'common.cancel': 'Annuler',
  'common.confirm': 'Confirmer',
  'common.delete': 'Supprimer',
  'common.edit': 'Modifier',
  'common.close': 'Fermer',
  'common.back': 'Retour',
  'common.next': 'Suivant',
  'common.submit': 'Soumettre',
  'common.search': 'Rechercher',
  'common.filter': 'Filtrer',
  'common.sort': 'Trier',
  'common.viewAll': 'Voir tout',
  'common.seeMore': 'Voir plus',
  'common.noResults': 'Aucun resultat',
  'common.required': 'Obligatoire',
  'common.optional': 'Facultatif',
  'common.yes': 'Oui',
  'common.no': 'Non',
  'common.or': 'ou',
  'common.and': 'et',
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

const AUTO_TR_CACHE_KEY = 'unitrade-auto-tr-v2';

const loadAutoCache = (): Record<string, string> => {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(AUTO_TR_CACHE_KEY) : null;
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

const saveAutoCache = (cache: Record<string, string>) => {
  try { window.localStorage.setItem(AUTO_TR_CACHE_KEY, JSON.stringify(cache)); } catch {}
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>(() => resolveInitialLanguage());

  // Auto-translated strings cached from MyMemory API
  const [autoTr, setAutoTr] = useState<Record<string, string>>(loadAutoCache);
  const pending = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
    // Clear pending queue when language changes
    pending.current.clear();
  }, [language]);

  const toggleLanguage = useCallback(() => {
    setLanguage((prev) => (prev === 'en' ? 'fr' : 'en'));
  }, []);

  const t = useCallback(
    (key: string, fallback?: string, values?: TranslationValues) => {
      // English — always return fallback immediately
      if (language !== 'fr') {
        return interpolate(fallback || key, values);
      }

      // French — check hardcoded translations first (instant)
      const hardcoded = FR_TRANSLATIONS[key];
      if (hardcoded) return interpolate(hardcoded, values);

      const text = (fallback || key).trim();

      // Skip very short strings, numbers, URLs, punctuation-only
      const isTranslatable = text.length > 2 && /[a-zA-Z]/.test(text) && !text.startsWith('http');

      // Check auto-translation cache (instant if previously translated)
      const cached = autoTr[text];
      if (cached) return interpolate(cached, values);

      // Queue async translation — show English while it loads
      if (isTranslatable && !pending.current.has(text)) {
        pending.current.add(text);
        translateText(text, 'en', 'fr').then((translated) => {
          pending.current.delete(text);
          if (translated && translated !== text) {
            setAutoTr((prev) => {
              const next = { ...prev, [text]: translated };
              saveAutoCache(next);
              return next;
            });
          }
        });
      }

      return interpolate(text, values); // English while translating
    },
    [language, autoTr],
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

