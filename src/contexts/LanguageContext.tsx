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
  'seller.noSales': 'Aucune vente pour l'instant',
  'seller.awaitingBuyer': 'En attente de confirmation acheteur',
  'seller.lockedEscrow': 'Bloqué en dépôt fiduciaire',
  'seller.readyWithdraw': 'Prêt pour retrait',
  'seller.noOrdersDesc': 'Vos commandes acheteurs apparaîtront ici.',
  'order.trackDesc': 'Suivre le statut du dépôt fiduciaire, les preuves de livraison et les étapes de confirmation.',
  'order.pickupMap': 'Carte du lieu de récupération',
  'order.deliveryEscrow': 'Confirmation de livraison et dépôt fiduciaire',
  'order.noProof': 'Aucune preuve de livraison téléchargée.',
  'order.receivedProduct': 'J'ai reçu ce produit.',
  'order.satisfied': 'Je suis satisfait de ce produit.',
  'order.notFound': 'Commande introuvable',
  'listing.basicDetails': 'Informations de base',
  'listing.basicHint': 'Dites aux étudiants ce que vous listez et pourquoi cela vaut la peine d'être acheté.',
  'listing.setup': 'Configuration de l'annonce',
  'listing.setupHint': 'Définissez la catégorie, le lieu, l'état et le modèle de prix.',
  'listing.photoHint': 'Téléchargez jusqu'à cinq images claires sous différents angles.',
  'listing.quickSummary': 'Aperçu rapide avant publication.',
  'common.yes': 'Oui',
  'common.no': 'Non',
  'common.or': 'ou',
  'common.and': 'et',

  // ── Pre-translated UI strings (from <T> component coverage) ───────────────
  // Admin pages
  'ui.admin_dashboard': 'Tableau de bord administrateur',
  'ui.total_users': 'Total utilisateurs',
  'ui.registered_students': 'Etudiants inscrits',
  'ui.total_listings': 'Total annonces',
  'ui.transactions': 'Transactions',
  'ui.manage_users_listings_and_monitor': 'Gerer les utilisateurs, annonces et surveiller l\'activite',
  'ui.you_are_not_authorized': 'Vous n\'etes pas autorise a voir cette page.',
  'ui.account_approvals': 'Approbations de comptes',
  'ui.review_and_approve_or_deny': 'Examiner et approuver ou refuser les inscriptions',
  'ui.pending_approvals': 'Approbations en attente',
  'ui.loading_pending_approvals': 'Chargement des approbations...',
  'ui.pending': 'En attente',
  'ui.approved': 'Approuve',
  'ui.rejected': 'Refuse',
  'ui.approve': 'Approuver',
  'ui.reject': 'Refuser',
  'ui.platform_settings': 'Parametres de la plateforme',
  'ui.configure_global_platform': 'Configurer le comportement global de la plateforme',
  'ui.platform_name': 'Nom de la plateforme',
  'ui.support_email': 'Email support',
  'ui.loading_settings': 'Chargement des parametres...',
  'ui.send_broadcast': 'Envoyer une diffusion',
  'ui.send_announcements': 'Envoyer des annonces aux acheteurs, vendeurs ou tous les utilisateurs',
  'ui.title': 'Titre',
  'ui.message': 'Message',
  'ui.priority': 'Priorite',
  'ui.normal': 'Normal',
  'ui.high': 'Haute',
  'ui.urgent': 'Urgent',
  'ui.send': 'Envoyer',
  'ui.platform_revenue_wallet': 'Portefeuille de revenus de la plateforme',
  'ui.available_revenue': 'Revenus disponibles',
  'ui.pending_balance': 'Solde en attente',
  'ui.total_withdrawn': 'Total retire',
  'ui.withdrawal_amount': 'Montant du retrait (XAF)',
  'ui.withdraw': 'Retirer',
  'ui.admin_reviews': 'Avis administrateur',
  'ui.loading_reviews': 'Chargement des avis...',
  'ui.no_reviews_found': 'Aucun avis trouve.',
  'ui.reviewer_blocked': 'Reviseur bloque',
  'ui.delete_review': 'Supprimer l\'avis',
  'ui.admin_categories': 'Categories administrateur',
  'ui.add_edit_delete_categories': 'Ajouter, modifier, supprimer ou desactiver les categories d\'annonces.',
  'ui.loading_categories': 'Chargement des categories...',
  'ui.no_categories_found': 'Aucune categorie trouvee.',
  'ui.admin_universities': 'Universites administrateur',
  'ui.add_edit_delete_universities': 'Ajouter, modifier, supprimer ou desactiver les universites.',
  'ui.loading_universities': 'Chargement des universites...',
  'ui.no_universities_found': 'Aucune universite trouvee.',
  'ui.admin_inbox': 'Boite de reception administrateur',
  'ui.all_contact_support': 'Toutes les soumissions de support et signalements.',
  'ui.all_types': 'Tous les types',
  'ui.support': 'Support',
  'ui.report': 'Signalement',
  'ui.refresh': 'Actualiser',
  'ui.user_registry': 'Registre des utilisateurs',
  'ui.total_active': 'Total actif',
  'ui.all_universities': 'Toutes les universites',
  'ui.all_statuses': 'Tous les statuts',
  'ui.loading_user_details': 'Chargement des details utilisateur...',
  'ui.user_not_found': 'Utilisateur introuvable.',
  'ui.full_profile_view': 'Vue profil complet',
  'ui.user_activity_log': 'Journal d\'activite utilisateur',
  'ui.recent_platform_events': 'Evenements recents de la plateforme',
  'ui.no_data_available': 'Aucune donnee disponible.',
  'ui.admin_analytics': 'Analytique administrateur',
  'ui.loading_analytics': 'Chargement de l\'analytique...',
  'ui.daily_listings_posted': 'Annonces publiees quotidiennement',
  'ui.daily_transactions': 'Transactions quotidiennes',

  // Seller pages
  'ui.seller_studio': 'Studio vendeur',
  'ui.withdraw_funds': 'Retirer les fonds',
  'ui.add_new_listing': 'Ajouter une annonce',
  'ui.no_sales_yet': 'Aucune vente pour l\'instant',
  'ui.your_buyer_orders_will_appear': 'Vos commandes acheteurs apparaitront ici.',
  'ui.seller_dispute_center': 'Centre de litiges vendeur',
  'ui.open_disputes_on_orders': 'Ouvrir des litiges sur les commandes et suivre leur statut.',
  'ui.order_or_rental': 'Commande ou location',
  'ui.select_order': 'Selectionner une commande',
  'ui.issue_details': 'Details du probleme',
  'ui.seller_help': 'Aide vendeur',
  'ui.faqs_and_contact_support': 'FAQ et formulaire de contact support.',
  'ui.contact_support': 'Contacter le support',
  'ui.subject': 'Sujet',
  'ui.seller_notifications': 'Notifications vendeur',
  'ui.new_order_alerts': 'Alertes nouvelles commandes - Alertes nouveaux messages - Mises a jour paiements',
  'ui.loading_notifications': 'Chargement des notifications...',
  'ui.no_notifications_yet': 'Aucune notification pour l\'instant.',
  'ui.mark_all_read': 'Tout marquer comme lu',
  'ui.seller_orders': 'Commandes vendeur',
  'ui.show_all_purchase_orders': 'Afficher toutes les commandes d\'achat des acheteurs.',
  'ui.loading_orders': 'Chargement des commandes...',
  'ui.no_purchase_orders_yet': 'Aucune commande d\'achat pour l\'instant.',
  'ui.back_to_orders': 'Retour aux commandes',
  'ui.loading_order_details': 'Chargement des details de la commande...',
  'ui.order_details_not_found': 'Details de la commande introuvables.',
  'ui.order_id': 'ID commande:',
  'ui.seller_rentals': 'Locations vendeur',
  'ui.show_all_rental_transactions': 'Afficher toutes les transactions de location.',
  'ui.loading_rentals': 'Chargement des locations...',
  'ui.no_rental_transactions_found': 'Aucune transaction de location trouvee.',
  'ui.rental_start': 'Debut de location',
  'ui.seller_reports': 'Rapports vendeur',
  'ui.report_buyer_listing_issues': 'Signaler acheteur, problemes d\'annonce ou litiges.',
  'ui.report_type': 'Type de signalement',
  'ui.buyer': 'Acheteur',
  'ui.listing_issue': 'Probleme d\'annonce',
  'ui.seller_settings': 'Parametres vendeur',
  'ui.change_password_and_notifications': 'Modifier le mot de passe et les preferences de notification.',
  'ui.change_password': 'Modifier le mot de passe',
  'ui.current_password': 'Mot de passe actuel',
  'ui.new_password': 'Nouveau mot de passe',
  'ui.add_listing': 'Ajouter une annonce',
  'ui.table_view_of_all_seller_listings': 'Vue tableau de toutes les annonces vendeur avec filtres.',
  'ui.category': 'Categorie',
  'ui.status': 'Statut',
  'ui.no_listings_found': 'Aucune annonce trouvee.',
  'ui.back_to_listings': 'Retour aux annonces',
  'ui.loading_listing': 'Chargement de l\'annonce...',
  'ui.edit_listing': 'Modifier l\'annonce',
  'ui.edit_listing_details': 'Modifier les details, images et statut de l\'annonce.',

  // Buyer pages
  'ui.buyer_dispute_center': 'Centre de litiges acheteur',
  'ui.open_dispute_for_order': 'Ouvrir un litige pour une commande et suivre son statut.',
  'ui.loading_orders_': 'Chargement des commandes...',
  'ui.no_purchase_orders_yet_': 'Aucune commande d\'achat pour l\'instant.',
  'ui.view_order': 'Voir la commande',
  'ui.view_receipt': 'Voir le recu',
  'ui.view_seller': 'Voir le vendeur',
  'ui.payment_history': 'Historique des paiements',
  'ui.all_your_transaction_records': 'Tous vos enregistrements de transactions',
  'ui.filter_by': 'Filtrer par:',
  'ui.mtn_momo': 'MTN MoMo',
  'ui.orange_money': 'Orange Money',
  'ui.payment_receipt': 'Recu de paiement',
  'ui.loading_receipt': 'Chargement du recu...',
  'ui.receipt_not_available': 'Recu non disponible.',
  'ui.receipt_id': 'ID recu:',
  'ui.date': 'Date:',
  'ui.my_rentals': 'Mes locations',
  'ui.loading_rentals_': 'Chargement des locations...',
  'ui.no_rental_orders_found': 'Aucune commande de location trouvee.',
  'ui.details': 'Details',
  'ui.report_problem': 'Signaler un probleme',
  'ui.report_seller_listing_transaction': 'Signaler vendeur, annonce, transaction ou tentative d\'arnaque.',
  'ui.seller_': 'Vendeur',
  'ui.listing_': 'Annonce',

  // Common dashboard
  'ui.loading_order_': 'Chargement de la commande...',
  'ui.order_not_found': 'Commande introuvable',
  'ui.no_image_available': 'Aucune image disponible',
  'ui.posted': 'Publie',
  'ui.verified': 'Verifie',
  'ui.contact_seller': 'Contacter le vendeur',

  // Add listing
  'ui.access_denied': 'Acces refuse',
  'ui.administrators_cannot_create_listings': 'Les administrateurs ne peuvent pas creer d\'annonces.',
  'ui.go_to_admin_dashboard': 'Aller au tableau de bord admin',
  'ui.tell_students_what_you_are_listing': 'Dites aux etudiants ce que vous listez et pourquoi cela vaut.',
  'ui.set_category_location_condition': 'Definissez la categorie, le lieu, l\'etat et le modele de prix.',
  'ui.upload_up_to_five_clear_images': 'Telechargez jusqu\'a cinq images claires sous differents angles.',
  'ui.quick_summary_before_publishing': 'Apercu rapide avant publication.',
  'ui.for_sale': 'A vendre',
  'ui.for_rent': 'A louer',
  'ui.title_and_description': 'Titre et description',
  'ui.category_and_location': 'Categorie et lieu',
  'ui.price_and_condition': 'Prix et etat',
  'ui.at_least_one_photo': 'Au moins une photo',
  'ui.not_set': 'Non defini',
  'ui.not_selected': 'Non selectionne',
  'ui.type_for_sale': 'Type: A vendre',
  'ui.photos_count': 'Photos: 0/5',

  // Checkout / Payment
  'ui.item_not_found': 'Article introuvable',
  'ui.back_to_marketplace': 'Retour au marche',
  'ui.secure_checkout': 'Paiement securise',
  'ui.complete_your_purchase': 'Completez votre achat depuis le marche universitaire.',
  'ui.subtotal': 'Sous-total',
  'ui.payments_are_held_in_escrow': 'Les paiements sont bloques en depot fiduciaire jusqu\'a confirmation.',
  'ui.instant_processing': 'Traitement instantane',
  'ui.allowed_university_campuses': 'Autorise: campus universitaires et ronds-points seulement.',
  'ui.select_from_approved_locations': 'Selectionner parmi les lieux approuves',
  'ui.choose_approved_pickup_point': 'Choisir un point de recuperation approuve',
  'ui.scan_to_pay': 'Scanner pour payer',
  'ui.point_your_phone_camera': 'Pointez la camera de votre telephone sur le code QR ci-dessous',
  'ui.open_your_phone_camera_and_scan': 'Ouvrez la camera de votre telephone et scannez le code QR',
  'ui.tap_the_link_that_appears': 'Appuyez sur le lien qui apparait - votre compose s\'ouvre',
  'ui.tap_call_then_enter': 'Appuyez sur APPELER puis entrez votre code PIN MTN MoMo',
  'ui.come_back_here_and_click': 'Revenez ici et cliquez sur "J\'ai paye"',
  'ui.ive_paid_confirm_order': 'J\'ai paye - Confirmer la commande',

  // Order details
  'ui.track_escrow_status': 'Suivre le statut du depot fiduciaire, les preuves et la confirmation.',
  'ui.pickup_location_map': 'Carte du lieu de recuperation',
  'ui.buyer_information': 'Informations acheteur',
  'ui.seller_information': 'Informations vendeur',
  'ui.delivery_escrow_confirmation': 'Confirmation de livraison et depot fiduciaire',
  'ui.seller_uploads_proof': 'Le vendeur telecharge la preuve, puis l\'acheteur confirme pour liberer.',
  'ui.buyer_confirms_receipt_only': 'L\'acheteur confirme la reception uniquement apres que le vendeur a telecharge la preuve.',
  'ui.no_delivery_proof_uploaded_yet': 'Aucune preuve de livraison telechargee.',
  'ui.i_have_received_this_product': 'J\'ai recu ce produit.',
  'ui.i_am_satisfied_with_this_product': 'Je suis satisfait de ce produit.',
  'ui.issue_refund_reason': 'Raison du probleme/remboursement (si insatisfait)',
  'ui.describe_the_issue': 'Decrivez le probleme pour examen du remboursement...',
  'ui.confirm_delivery': 'Confirmer la livraison',
  'ui.request_refund': 'Demander un remboursement',

  // Profile
  'ui.loading_profile': 'Chargement du profil...',
  'ui.profile_not_available': 'Profil non disponible.',
  'ui.profile_studio': 'Studio profil',
  'ui.profile_strength': 'Force du profil',
  'ui.account_view': 'Vue du compte',
  'ui.edit_profile': 'Modifier le profil',
  'ui.save_changes': 'Enregistrer les modifications',
  'ui.member_since': 'Membre depuis',
  'ui.verified_student': 'Etudiant verifie',
  'ui.seller_rating': 'Note vendeur',
  'ui.total_reviews': 'Total des avis',
  'ui.listings_posted': 'Annonces publiees',

  // Auth pages
  'ui.academic_commerce': 'Commerce academique',
  'ui.redefined': 'Reinvente.',
  'ui.active_students': 'Etudiants actifs',
  'ui.partner_institutions': 'Institutions partenaires',
  'ui.ssl_secured': 'SSL securise',
  'ui.student_verified': 'Etudiant verifie',
  'ui.welcome_back': 'Bon retour',
  'ui.please_enter_your_student_credentials': 'Veuillez entrer vos identifiants etudiants.',
  'ui.institutional_email': 'Email institutionnel',
  'ui.remember_me_on_this_device': 'Se souvenir de moi sur cet appareil',
  'ui.sign_in_to_account': 'Se connecter au compte',
  'ui.new_to_unitrade': 'Nouveau sur UNITRADE?',
  'ui.create_student_account': 'Creer un compte etudiant',
  'ui.didnt_receive_verification': 'Vous n\'avez pas recu la verification?',
  'ui.resend_confirmation': 'Renvoyer la confirmation',
  'ui.ub_verified': 'UB verifie',
  'ui.bit_aes': '256-bit AES',
  'ui.start_selling_and_buying': 'Commencez a vendre et acheter en toute confiance.',
  'ui.student_members': 'Membres etudiants',
  'ui.partner_campuses': 'Campus partenaires',
  'ui.create_account': 'Creer un compte',
  'ui.join_unitrade': 'Rejoindre UNITRADE',
  'ui.reset_your_password': 'Reinitialiser votre mot de passe',
  'ui.reset_link': 'Lien de reinitialisation:',
  'ui.sending': 'Envoi en cours...',
  'ui.back_to_login': 'Retour a la connexion',
  'ui.set_a_new_password': 'Definir un nouveau mot de passe',
  'ui.confirm_password': 'Confirmer le mot de passe',
  'ui.updating': 'Mise a jour...',
  'ui.confirm_your_email': 'Confirmez votre email',
  'ui.go_to_login': 'Aller a la connexion',

  // Settings
  'ui.change_password_notification_privacy': 'Modifier le mot de passe, les notifications et la confidentialite.',
  'ui.confirm_new_password': 'Confirmer le nouveau mot de passe',

  // Favorites / Recently viewed
  'ui.saved_items': 'Articles sauvegardes',
  'ui.all_types': 'Tous les types',
  'ui.for_sale_': 'A vendre',
  'ui.for_rent_': 'A louer',
  'ui.recently_added': 'Ajout recent',
  'ui.clear_history': 'Effacer l\'historique',
  'ui.recently_viewed_items': 'Articles recemment consultes',
  'ui.loading_items': 'Chargement des articles...',
  'ui.no_recently_viewed_items_yet': 'Aucun article consulte recemment.',
  'ui.view_item': 'Voir l\'article',

  // Notifications
  'ui.notifications': 'Notifications',
  'ui.loading_notifications_': 'Chargement des notifications...',
  'ui.no_notifications_yet_': 'Aucune notification pour l\'instant.',
  'ui.mark_all_read_': 'Tout marquer comme lu',

  // Help
  'ui.faqs_and_contact_admin': 'FAQ et formulaire de contact support admin.',
  'ui.contact_support_': 'Contacter le support',
  'ui.subject_': 'Sujet',

  // Review
  'ui.loading_transaction': 'Chargement de la transaction...',
  'ui.go_home': 'Aller a l\'accueil',
  'ui.already_reviewed': 'Deja evalue',
  'ui.you_already_submitted_a_review': 'Vous avez deja soumis un avis pour cette transaction.',
  'ui.leave_a_review': 'Laisser un avis',
  'ui.rate_your_experience': 'Evaluez votre experience',
  'ui.write_your_review': 'Ecrivez votre avis',
  'ui.submit_review': 'Soumettre l\'avis',

  // Rental details
  'ui.back_to_rentals': 'Retour aux locations',
  'ui.rental_details': 'Details de la location',
  'ui.track_rental_status': 'Suivre le statut de la location et demander une extension',
  'ui.loading_rental_details': 'Chargement des details de location...',
  'ui.rental_details_not_found': 'Details de location introuvables.',

  // Subscription
  'ui.choose_your_subscription_plan': 'Choisissez votre plan d\'abonnement',
  'ui.choose_method': 'Choisir la methode',
  'ui.phone_number': 'Numero de telephone',

  // Messages
  'ui.unitrade_messages': 'Messages UNITRADE',
  'ui.all_chats': 'Toutes les conversations',
  'ui.unread': 'Non lu',
  'ui.archived': 'Archive',

  // General
  'ui.loading': 'Chargement...',
  'ui.loading_': 'Chargement...',
  'ui.delete': 'Supprimer',
  'ui.edit': 'Modifier',
  'ui.cancel': 'Annuler',
  'ui.save': 'Enregistrer',
  'ui.back': 'Retour',
  'ui.close': 'Fermer',
  'ui.confirm': 'Confirmer',
  'ui.submit': 'Soumettre',
  'ui.send_': 'Envoyer',
  'ui.name': 'Nom',
  'ui.email': 'Email',
  'ui.amount': 'Montant',
  'ui.created': 'Cree',
  'ui.updated': 'Mis a jour',
  'ui.actions': 'Actions',
  'ui.view_details': 'Voir les details',
  'ui.marketplace': 'Marche',
  'ui.unitrade': 'UNITRADE',
  'ui.sasha': 'Sasha',
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

