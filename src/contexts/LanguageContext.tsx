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
  'ui.academic_authenticated': 'Authentifié académique',  // Academic Authenticated
  'ui.academic_commerce': 'Commerce académique',  // Academic Commerce
  'ui.accept': 'Accepter',  // Accept
  'ui.accept_order': 'Valider la commande',  // Accept Order
  'ui.accept_rental': '[Accepter la location]',  // Accept Rental
  'ui.access_denied': 'Accès refusé',  // Access Denied
  'ui.account_approvals': 'Approbations de compte',  // Account Approvals
  'ui.account_view': 'Vue du compte',  // Account View
  'ui.actions': 'Interventions',  // Actions
  'ui.active_students': 'Étudiants actifs',  // Active students
  'ui.add_edit_delete_or_disable_listing_categories': 'Ajoutez, modifiez, supprimez ou désactivez des catégories d\'annonces.',  // Add, edit, delete, or disable listing ca
  'ui.add_edit_delete_or_disable_universities': 'Ajoutez, modifiez, supprimez ou désactivez des universités.',  // Add, edit, delete, or disable universiti
  'ui.add_listing': 'Proposer votre salle de sport',  // Add Listing
  'ui.add_new_listing': 'Ajouter une annonce',  // Add New Listing
  'ui.admin_categories': 'Catégories d\'administration',  // Admin Categories
  'ui.admin_dashboard': 'Tableau de bord administrateur',  // Admin Dashboard
  'ui.admin_inbox': 'Boîte de réception de l\'administrateur',  // Admin Inbox
  'ui.admin_reviews': 'Avis de l\'administrateur',  // Admin Reviews
  'ui.admin_universities': 'Universités d\'administration',  // Admin Universities
  'ui.administrators_cannot_create_listings': 'Les administrateurs ne peuvent pas créer d\'annonces.',  // Administrators cannot create listings.
  'ui.all_buyer_seller_reports_and_support_requests_rece': 'Tous les rapports d\'acheteur/vendeur et les demandes d\'assistance reçus par l\'administrateur.',  // All buyer/seller reports and support req
  'ui.all_caught_up': 'Tous rattrapés !',  // All Caught Up!
  'ui.all_contact_support_and_report_problem_submissions': 'Tous les contacts de l\'assistance et les soumissions de problèmes de rapport.',  // All contact support and report problem s
  'ui.all_statuses': 'Tous les Statuts',  // All Statuses
  'ui.all_time': 'Tout le temps',  // All time
  'ui.all_types': 'Tous les types',  // All Types
  'ui.all_universities': 'Toutes les universités',  // All Universities
  'ui.all_users': 'Tous les utilisateurs/utilisatrices',  // All users
  'ui.all_your_transaction_records': 'Tous vos enregistrements de transactions',  // All your transaction records
  'ui.allow_new_registrations': 'Destination',  // Allow New Registrations
  'ui.allowed_university_campuses_and_roundabouts_only': 'Autorisé : campus universitaires et ronds-points uniquement.',  // Allowed: university campuses and roundab
  'ui.already_paid': 'Déjà payé',  // Already Paid
  'ui.already_reviewed': 'Vous avez déjà donné votre avis.',  // Already Reviewed
  'ui.amount': 'Montant :',  // Amount:
  'ui.apply_filters': 'Appliquer les filtres',  // Apply Filters
  'ui.approve': 'Approuver',  // Approve
  'ui.approved': 'Approuvé',  // Approved
  'ui.auto_payout_to_mtn_on_release': 'Paiement automatique à MTN à la libération',  // Auto Payout to MTN on Release
  'ui.available_balance': 'Solde disponible ',  // Available Balance
  'ui.available_revenue': 'recettes disponibles',  // Available Revenue
  'ui.back_to_listings': 'Retour à la liste',  // Back to Listings
  'ui.back_to_login': 'Retour écran connexion',  // Back to login
  'ui.back_to_marketplace': 'Retour à la place de marché',  // Back to Marketplace
  'ui.back_to_orders': 'Retour aux Commandes',  // Back to Orders
  'ui.back_to_rentals': 'Retour aux locations',  // Back to Rentals
  'ui.banned': 'Banni',  // Banned
  'ui.base_amount': 'Montant de base',  // Base Amount:
  'ui.block_reviewer': 'Bloquer le réviseur',  // Block Reviewer
  'ui.broadcast_history': 'Historique de diffusion,',  // Broadcast History
  'ui.broadcasts': 'Messages généraux',  // Broadcasts
  'ui.browse_and_purchase_from_sellers': 'Parcourir et acheter auprès des vendeurs',  // Browse and purchase from sellers
  'ui.browse_marketplace': 'Parcourir la Marketplace',  // Browse Marketplace
  'ui.buy_items': 'Acheter des articles',  // Buy Items
  'ui.buyer_confirmation': 'Confirmation de l\'acheteur',  // Buyer Confirmation
  'ui.buyer_info': 'Info Client',  // Buyer Info
  'ui.buyer_information': 'Information sur l\'acheteur ',  // Buyer Information
  'ui.buyer_orders': 'Commandes de l\'acheteur',  // Buyer Orders
  'ui.buyer_protection_active': 'Protection de l\'acheteur active.',  // Buyer Protection Active.
  'ui.buyer_user_id_optional': 'Acheteur/ID utilisateur (facultatif)',  // Buyer/User ID (optional)
  'ui.buyers_only': 'Acheteurs uniquement',  // Buyers only
  'ui.cancel': 'Annuler',  // Cancel
  'ui.cancel_transaction': 'Annuler la transaction',  // Cancel Transaction
  'ui.category': 'Catégorie : ',  // Category:
  'ui.change_password': 'Modifier le mot de passe',  // Change Password
  'ui.change_password_and_notification_preferences': 'Modifier le mot de passe et les préférences de notification.',  // Change password and notification prefere
  'ui.change_password_notification_preferences_and_priva': 'Modifier le mot de passe, les préférences de notification et les options de confidentialité.',  // Change password, notification preference
  'ui.chat_buyer': 'Acheteur de chat',  // Chat Buyer
  'ui.chat_with_buyers': 'Discutez avec les acheteurs.',  // Chat with buyers.
  'ui.chat_with_sellers_about_your_orders': 'Discutez de vos commandes avec les vendeurs.',  // Chat with sellers about your orders.
  'ui.checkout': 'Départ',  // Checkout
  'ui.choose_method': 'Choisissez la méthode',  // Choose Method
  'ui.choose_your_subscription_plan': 'Choisissez votre abonnement',  // Choose Your Subscription Plan
  'ui.clear_filters': 'Effacer filtres',  // Clear Filters
  'ui.clear_history': 'Histoire claire',  // Clear History
  'ui.come_back_here_and_click': 'Revenez ici et cliquez',  // Come back here and click
  'ui.complete_your_purchase_from_the_university_of_buea': 'Terminez votre achat sur le marché de l\'Université de Buea.',  // Complete your purchase from the Universi
  'ui.configure_global_platform_behavior_and_payout_rule': 'Configurez le comportement de la plateforme mondiale et les règles de versement.',  // Configure global platform behavior and p
  'ui.confirm_new_password': 'Confirmer le nouveau mot de passe',  // Confirm New Password
  'ui.confirm_only_if_you_have_received_the_item_and_are': 'Confirmez uniquement si vous avez reçu l\'article et que vous êtes satisfait.',  // Confirm only if you have received the it
  'ui.confirm_password': 'Confirmer le mot de passe',  // Confirm Password
  'ui.confirm_your_email': 'Confirme ton adresse email.',  // Confirm your email
  'ui.contact_seller': 'Contact Vendeur',  // Contact Seller
  'ui.contact_support': 'Contacter le support',  // Contact Support
  'ui.continue_to_payment_review': 'Passer à l\'examen du paiement',  // Continue to Payment Review
  'ui.create_a': 'Créer un ',  // Create a
  'ui.create_account': 'Créer compte',  // Create Account
  'ui.create_student_account': 'Créer un compte étudiant',  // Create Student Account
  'ui.created': 'Créé :',  // Created:
  'ui.creating': 'Création en cours...',  // Creating...
  'ui.creating_account': 'Création du compte…',  // Creating Account...
  'ui.current_password': 'Mot de passe actuel',  // Current Password
  'ui.current_plan': 'Forfait actuel',  // Current plan
  'ui.daily': 'Tous les jours',  // Daily
  'ui.daily_listings_posted': 'Annonces quotidiennes publiées',  // Daily Listings Posted
  'ui.daily_transactions': 'Transactions quotidiennes',  // Daily Transactions
  'ui.dashboard': 'Tableau de bord',  // Dashboard
  'ui.date': 'Date :',  // Date:
  'ui.delete': 'Effacer',  // Delete
  'ui.delete_review': 'Supprimer l’avis',  // Delete Review
  'ui.delivery_escrow_confirmation': 'Confirmation de livraison et d\'entiercement',  // Delivery & Escrow Confirmation
  'ui.delivery_proof': 'PREUVE DE LIVRAISON',  // Delivery Proof
  'ui.details': 'Détails',  // Details
  'ui.disable_normal_operations_during_maintenance': 'Désactiver les opérations normales pendant la maintenance.',  // Disable normal operations during mainten
  'ui.dispute_center': 'Centre de règlement des litiges',  // Dispute Center
  'ui.download_receipt': 'Télécharger votre reçu fiscal ',  // Download Receipt
  'ui.edit_listing': 'Modifier l\'annonce',  // Edit Listing
  'ui.edit_listing_details_images_and_status': 'Modifiez les détails, les images et le statut de l\'annonce.',  // Edit listing details, images, and status
  'ui.email': 'Adresse électronique:',  // Email:
  'ui.email_address': 'Adresse e-mail',  // Email address
  'ui.email_cannot_be_changed_here': 'L\'e-mail ne peut pas être modifié ici.',  // Email cannot be changed here.
  'ui.enable_or_disable_new_user_signups': 'Activez ou désactivez les nouvelles inscriptions d\'utilisateurs.',  // Enable or disable new user signups.
  'ui.faqs_and_contact_admin_support_form': 'FAQ et formulaire de soutien administratif de contact.',  // FAQs and contact admin support form.
  'ui.faqs_and_contact_support': 'FAQ et contactez l\'assistance.',  // FAQs and contact support.
  'ui.fill_in_your_details_to_create_a_verified_student_': 'Remplissez vos coordonnées pour créer un compte de marché étudiant vérifié.',  // Fill in your details to create a verifie
  'ui.filter_by': 'Filtrer par :',  // Filter by:
  'ui.finding_more_items': 'Vous trouvez d\'autres articles ?',  // Finding more items?
  'ui.for_rent': 'Ancien',  // For Rent
  'ui.for_sale': 'Neuf',  // For Sale
  'ui.forgot_password': 'Vous avez oublié votre mot de passe ?',  // Forgot Password?
  'ui.full_name': 'Nom complet',  // Full name
  'ui.full_profile_view': 'Voir le profil',  // Full Profile View
  'ui.go_home': 'Retour à la page principale',  // Go Home
  'ui.go_to_admin_dashboard': 'Accéder au tableau de bord d\'administration',  // Go to Admin Dashboard
  'ui.go_to_login': 'Accéder à connexion',  // Go to login
  'ui.gross': 'Brute',  // Gross
  'ui.gross_volume': 'Volume Brut',  // Gross Volume
  'ui.help_support': 'Aide / Assistance',  // Help / Support
  'ui.i_want_to': 'Je souhaite :',  // I want to:
  'ui.incl_vat_where_applicable': 'TTC le cas échéant',  // Incl. VAT where applicable
  'ui.instant': 'Immédiat',  // Instant
  'ui.institutional_email': 'E-mail institutionnel',  // Institutional Email
  'ui.issue_details': 'Détails ISSUE',  // Issue Details
  'ui.issue_refund_reason_if_not_satisfied': 'Raison du problème / remboursement (si non satisfait)',  // Issue / Refund reason (if not satisfied)
  'ui.item': 'Rubrique :',  // Item:
  'ui.item_not_found': 'Élément introuvable',  // Item not found
  'ui.join_unitrade': 'Rejoindre UNITRADE',  // Join UNITRADE
  'ui.jpg_png_or_webp_up_to_5mb': 'JPG, PNG ou WEBP jusqu\'à 5 Mo',  // JPG, PNG, or WEBP up to 5MB
  'ui.latest_announcements_sent_from_admin_dashboard': 'Dernières annonces envoyées depuis le tableau de bord d\'administration.',  // Latest announcements sent from admin das
  'ui.leave_a_review': 'Laisser un Avis',  // Leave a Review
  'ui.like_new': 'Comme Neuve!',  // Like New
  'ui.list_products_and_serve_student_buyers': 'Répertorier les produits et servir les étudiants acheteurs',  // List products and serve student buyers
  'ui.listing': 'Classement',  // Listing
  'ui.listing_id_optional': 'Identifiant de l\'annonce (facultatif)',  // Listing ID (optional)
  'ui.listing_issue': 'Problème d\'annonce',  // Listing Issue
  'ui.listing_management': 'Gestion des annonces',  // Listing Management
  'ui.listings': 'Contenus',  // Listings
  'ui.loading_analytics': 'Chargement des analyses...',  // Loading analytics...
  'ui.loading_broadcasts': 'Chargement des diffusions...',  // Loading broadcasts...
  'ui.loading_categories': 'Chargement des categories...',  // Loading categories...
  'ui.loading_disputes': 'Chargement des litiges...',  // Loading disputes...
  'ui.loading_inbox': 'Chargement de la boîte de réception',  // Loading inbox...
  'ui.loading_items': 'Chargement des éléments',  // Loading items...
  'ui.loading_listing': 'Chargement de l\'annonce...',  // Loading listing...
  'ui.loading_notifications': 'Chargement des notifications',  // Loading notifications...
  'ui.loading_order': 'Chargement de la commande ...',  // Loading order...
  'ui.loading_order_details': 'Chargement des détails de la commande',  // Loading order details...
  'ui.loading_orders': 'Chargement des commandes ...',  // Loading orders...
  'ui.loading_payouts': 'Chargement des versements...',  // Loading payouts...
  'ui.loading_pending_approvals': 'Chargement des approbations en attente...',  // Loading pending approvals...
  'ui.loading_profile': 'Chargement du profile en cours…',  // Loading profile...
  'ui.loading_receipt': 'Chargement du reçu...',  // Loading receipt...
  'ui.loading_rental_details': 'Chargement des détails de la location...',  // Loading rental details...
  'ui.loading_rentals': 'Chargement des locations...',  // Loading rentals...
  'ui.loading_reports': 'Chargement des rapports...',  // Loading reports...
  'ui.loading_reviews': 'Chargement des avis...',  // Loading reviews...
  'ui.loading_settings': 'Chargement de la configuration…',  // Loading settings...
  'ui.loading_transaction': 'Chargement de la transaction...',  // Loading transaction...
  'ui.loading_transactions': 'Chargement des opérations...',  // Loading transactions...
  'ui.loading_universities': 'Chargement des universités...',  // Loading universities...
  'ui.loading_user_details': 'Chargement des détails de l\'utilisateur...',  // Loading user details...
  'ui.location': 'Emplacement:',  // Location:
  'ui.logging_in': 'Connexion...',  // Logging in...
  'ui.login': 'Connexion',  // Login
  'ui.maintenance_mode': 'Mode maintenance',  // Maintenance Mode
  'ui.manage_institutional_accounts_and_marketplace_perm': 'Gérez les comptes institutionnels et les autorisations de marché sur tous les campus.',  // Manage institutional accounts and market
  'ui.manage_student_accounts_and_verifications': 'Gérer les comptes étudiants et les vérifications',  // Manage student accounts and verification
  'ui.manage_users_listings_and_monitor_platform_activit': 'Gérer les utilisateurs, les annonces et surveiller l\'activité de la plateforme',  // Manage users, listings, and monitor plat
  'ui.mark_all_read': 'Tout marquer comme lu',  // Mark All Read
  'ui.mark_delivered': 'Marqué comme livré',  // Mark Delivered
  'ui.mark_rented': 'Marquer comme loué',  // Mark Rented
  'ui.mark_resolved': 'Marquer résolu',  // Mark Resolved
  'ui.mark_returned': 'Marquer comme retourné',  // Mark Returned
  'ui.mark_reviewed': 'Marqué comme révisée',  // Mark Reviewed
  'ui.mark_sold': 'Marquer comme Vendu',  // Mark Sold
  'ui.marketplace': 'Place de marché',  // Marketplace
  'ui.marketplace_snapshot': 'Aperçu du marché',  // Marketplace snapshot
  'ui.messages': 'Messagerie',  // Messages
  'ui.method': 'Méthode :',  // Method:
  'ui.minimum_payout_amount': 'Montant minimum du paiement',  // Minimum Payout Amount
  'ui.mobile_money_authorization': 'Autorisation d\'argent mobile',  // Mobile Money Authorization
  'ui.mobile_money_number': 'Numéro de compte Mobile Money',  // Mobile Money Number
  'ui.monitor_all_platform_transactions': 'Surveiller toutes les transactions de la plateforme',  // Monitor all platform transactions
  'ui.monitor_communication_between_users': 'Surveiller la communication entre les utilisateurs',  // Monitor communication between users
  'ui.monthly': 'Mensuellement',  // Monthly
  'ui.mtn_mobile_money': 'MTN Mobile Money ',  // MTN Mobile Money
  'ui.mtn_momo_pin': 'CODE PIN MTN MoMo',  // MTN MoMo PIN
  'ui.my_disputes': 'Mes litiges',  // My Disputes
  'ui.my_rentals': 'Mes locations',  // My Rentals
  'ui.name': 'Nom :',  // Name:
  'ui.net_payouts': 'Versements nets',  // Net Payouts
  'ui.new_listing': 'Nouvelle annonce',  // New Listing
  'ui.new_message_alerts': 'Alertes de nouveaux messages',  // New message alerts
  'ui.new_message_received': 'Nouveau message reçu',  // New message received
  'ui.new_order_alerts': 'Alertes de nouvelle commande',  // New order alerts
  'ui.new_order_alerts_new_message_alerts_payout_status_': 'Alertes de nouvelle commande - Alertes de nouveau message - Mises à jour du statut des versements',  // New order alerts - New message alerts - 
  'ui.new_password': 'Nouveau mot passe',  // New Password
  'ui.new_to_unitrade': 'Nouveau sur UNITRADE ?',  // New to UNITRADE?
  'ui.no_activity_log_entries': 'Aucune entrée dans le journal d\'activité.',  // No activity log entries.
  'ui.no_broadcasts_yet': 'Pas encore de diffusion.',  // No broadcasts yet.
  'ui.no_categories_found': 'Aucune catégorie trouvée.',  // No categories found.
  'ui.no_conversations_found': 'Aucune conversation trouvée',  // No conversations found
  'ui.no_data_available': 'Aucune donnée disponible.',  // No data available.
  'ui.no_delivery_proof_uploaded_yet': 'Aucune preuve de livraison n\'a encore été téléchargée.',  // No delivery proof uploaded yet.
  'ui.no_disputes_yet': 'Aucun litige pour l\'instant.',  // No disputes yet.
  'ui.no_image_available': 'Aucune image disponible',  // No image available
  'ui.no_items_match_your_search': 'Aucun élément ne correspond à votre recherche',  // No items match your search
  'ui.no_listings': 'Pas d\'annonce',  // No listings.
  'ui.no_listings_found_for_current_filters': 'Aucune annonce trouvée pour les filtres actuels.',  // No listings found for current filters.
  'ui.no_listings_yet': 'Pas d\'annonce',  // No listings yet
  'ui.no_notifications_yet': 'Pas encore de notifications',  // No notifications yet.
  'ui.no_orders_yet': 'Pas encore de commandes',  // No orders yet
  'ui.no_payout_data_yet': 'Aucune donnée de versement pour le moment.',  // No payout data yet.
  'ui.no_pending_account_approvals_at_the_moment': 'Aucune approbation de compte en attente pour le moment',  // No pending account approvals at the mome
  'ui.no_platform_withdrawals_yet': 'Aucun retrait de plateforme pour le moment.',  // No platform withdrawals yet.
  'ui.no_purchase_orders_yet': 'Pas encore de bons de commande.',  // No purchase orders yet.
  'ui.no_recently_viewed_items_yet': 'Aucun élément récemment consulté pour le moment.',  // No recently viewed items yet.
  'ui.no_rental_orders_found': 'Aucune commande de location trouvée.',  // No rental orders found.
  'ui.no_rental_transactions_found': 'Aucune transaction de location trouvée.',  // No rental transactions found.
  'ui.no_reports_against_this_user': 'Aucun rapport contre cet utilisateur.',  // No reports against this user.
  'ui.no_reports_yet': 'Aucun signalement pour l’instant.',  // No reports yet.
  'ui.no_reviews_found': 'Aucune revue trouvée.',  // No reviews found.
  'ui.no_reviews_received': 'Aucun commentaire reçu.',  // No reviews received.
  'ui.no_saved_items': 'Aucun élément enregistré',  // No saved items
  'ui.no_saved_items_yet': 'Aucun élément enregistré pour le moment',  // No saved items yet
  'ui.no_seller_analytics_available': 'Aucune analyse de vendeur disponible.',  // No seller analytics available.
  'ui.no_submissions_found': 'Aucun envoi trouvé.',  // No submissions found.
  'ui.no_transactions': 'Aucune opération.',  // No transactions.
  'ui.no_transactions_found_for_this_filter': 'Aucune transaction trouvée pour ce filtre.',  // No transactions found for this filter.
  'ui.no_universities_found': 'Aucune université trouvée.',  // No universities found.
  'ui.normal': 'Normale',  // Normal
  'ui.notification_preferences': 'Préférences de notification',  // Notification Preferences
  'ui.only_available_balance_can_be_withdrawn_to_mobile_': 'Seul le solde disponible peut être retiré vers l\'argent mobile.',  // Only available balance can be withdrawn 
  'ui.open_confirmation_link': 'Lien de confirmation',  // Open confirmation link
  'ui.open_dispute_for_an_order_and_track_dispute_status': 'Litige ouvert pour une commande et suivi du statut du litige.',  // Open dispute for an order and track disp
  'ui.open_disputes_on_orders_or_rentals_and_track_dispu': 'Litiges ouverts sur les commandes ou les locations et suivi de l\'état des litiges.',  // Open disputes on orders or rentals and t
  'ui.open_messages': 'Messages ouverts',  // Open Messages
  'ui.open_order': 'Ordre à révocation',  // Open Order
  'ui.open_your_phone_camera_and_scan_the_qr_code': 'Ouvrez l\'appareil photo de votre téléphone et scannez le code QR',  // Open your phone camera and scan the QR c
  'ui.order': 'Ordre',  // Order
  'ui.order_details': 'Détails de la commande',  // Order Details
  'ui.order_details_not_found': 'Détails de la commande introuvables.',  // Order details not found.
  'ui.order_id': 'Numéro de commande :',  // Order ID:
  'ui.order_id_optional': 'Numéro de commande (facultatif)',  // Order ID (optional)
  'ui.order_not_found': 'Commande introuvable',  // Order not found
  'ui.order_or_rental': 'Commande ou location',  // Order or Rental
  'ui.order_summary': 'Récapitulatif de demande de devis',  // Order Summary
  'ui.order_updates': 'Mises à jour des commandes',  // Order updates
  'ui.orders': 'Commandes',  // Orders
  'ui.partner_campuses': 'Campus partenaires',  // Partner campuses
  'ui.partner_institutions': 'Institutions partenaires',  // Partner institutions
  'ui.password': 'Mot de passe',  // Password
  'ui.payment': 'Paiement',  // Payment
  'ui.payment_alerts': 'Alertes de paiement',  // Payment alerts
  'ui.payment_history': 'Historique de paiement',  // Payment History
  'ui.payment_info': 'Info du payement',  // Payment Info
  'ui.payment_method': 'Mode de paiement:',  // Payment Method:
  'ui.payment_receipt': 'Reçu',  // Payment Receipt
  'ui.payments_are_held_in_escrow_until_pickup_is_confir': 'Les paiements sont retenus en entiercement jusqu\'à ce que la prise en charge soit confirmée.',  // Payments are held in escrow until pickup
  'ui.payout_queue': 'File d\'attente de versement',  // Payout Queue
  'ui.payout_status_updates': 'Mises à jour du statut de versement',  // Payout status updates
  'ui.payouts': 'Paiements',  // Payouts
  'ui.pending': 'En attente',  // Pending
  'ui.pending_approvals': 'Approbations en attente ',  // Pending Approvals
  'ui.pending_balance': 'Montant en attente',  // Pending Balance
  'ui.pending_funds_cannot_be_withdrawn': 'Les fonds en attente ne peuvent pas être retirés.',  // Pending funds cannot be withdrawn.
  'ui.pending_payout': 'Paiement en attente',  // Pending Payout
  'ui.personal_profile': 'Profil personnel',  // Personal Profile
  'ui.phone': 'Téléphone :',  // Phone:
  'ui.phone_number': 'Numéro de téléphone',  // Phone number
  'ui.photos': 'Photos :',  // Photos:
  'ui.pickup': 'Départ: ',  // Pickup:
  'ui.pickup_date': 'Date du retrait',  // Pickup Date
  'ui.pickup_details': 'Détails du Pickup',  // Pickup Details
  'ui.pickup_point': 'Point de Relais',  // Pickup Point
  'ui.pickup_time': 'Heure du retrait',  // Pickup Time
  'ui.platform_commission_percent': 'Pourcentage de commission de la plateforme',  // Platform Commission Percent
  'ui.platform_fee': 'Frais de plateforme',  // Platform Fee
  'ui.platform_messages': 'Messages de la plateforme',  // Platform Messages
  'ui.platform_name': 'Název platformy',  // Platform Name
  'ui.platform_revenue': 'Revenus de la plateforme',  // Platform Revenue
  'ui.platform_revenue_wallet': 'Portefeuille de revenus de la plateforme',  // Platform Revenue Wallet
  'ui.platform_settings': 'Paramètres de Plateforme',  // Platform Settings
  'ui.platform_wide': 'Plateforme large',  // Platform wide
  'ui.please_enter_your_student_credentials_to_access_yo': 'Veuillez saisir vos informations d\'identification d\'étudiant pour accéder à votre compte.',  // Please enter your student credentials to
  'ui.point_your_phone_camera_at_the_qr_code_below': 'Pointez l\'appareil photo de votre téléphone sur le code QR ci-dessous',  // Point your phone camera at the QR code b
  'ui.posted': 'Posté',  // Posted
  'ui.price': 'Prix',  // Price:
  'ui.price_high_to_low': 'Prix : décroissant',  // Price: High to Low
  'ui.price_low_to_high': 'Prix : croissant',  // Price: Low to High
  'ui.print_save_pdf': 'Imprimer/enregistrer',  // Print / Save PDF
  'ui.priority': 'Priorité',  // Priority
  'ui.privacy_options': 'Options de confidentialité',  // Privacy Options
  'ui.privacy_policy': 'Politique confidentialité',  // Privacy policy
  'ui.process_payouts_from_seller_available_wallet_balan': 'Traiter les versements à partir des soldes des portefeuilles disponibles du vendeur.',  // Process payouts from seller available wa
  'ui.processing': 'Traitement...',  // Processing...
  'ui.profile_details': 'Détails du profil',  // Profile details
  'ui.profile_not_available': 'Profil non disponible.',  // Profile not available.
  'ui.profile_photo': 'Photo de profil',  // Profile photo
  'ui.profile_picture_optional': 'Photo de profil (facultatif)',  // Profile Picture (Optional)
  'ui.profile_strength': 'Profil complété',  // Profile Strength
  'ui.profile_visibility': 'Paramètres de visibilité du profil',  // Profile visibility
  'ui.provider': 'Prestataire',  // Provider
  'ui.public': 'Partenariat public-privé',  // Public
  'ui.qty_1': 'Quantité : 1',  // Qty: 1
  'ui.rating': 'Notation:',  // Rating:
  'ui.reason': 'Raison',  // Reason
  'ui.receipt_id': 'Reçu N°:',  // Receipt ID:
  'ui.receipt_not_available': 'Reçu non disponible',  // Receipt not available.
  'ui.recent_platform_events': 'Événements récents de la plateforme',  // Recent platform events
  'ui.recent_platform_withdrawals': 'Retraits récents de la plateforme',  // Recent Platform Withdrawals
  'ui.recently_added': 'Récemment ajouté',  // Recently Added
  'ui.recently_viewed_items': 'Éléments récemment consultés',  // Recently Viewed Items
  'ui.redefined': 'Redéfinie.',  // Redefined.
  'ui.reference': 'Référence :',  // Reference:
  'ui.refresh': 'Renouvellement',  // Refresh
  'ui.registered_students': 'Nombre d&apos;étudiants inscrits',  // Registered students
  'ui.reject': 'Rejeter',  // Reject
  'ui.reject_order': 'Rejeter l\'ordre',  // Reject Order
  'ui.related_deals': 'Offres Similaires',  // Related Deals
  'ui.remember_me_on_this_device': 'Se souvenir de moi sur ce dispositif',  // Remember me on this device
  'ui.remove': 'Supprimer',  // Remove
  'ui.rental_details': 'Détails Location',  // Rental Details
  'ui.rental_details_not_found': 'Détails de la location introuvables.',  // Rental details not found.
  'ui.rental_end': 'Fin de location',  // Rental end:
  'ui.rental_period': 'Période locative :',  // Rental period:
  'ui.rental_reminders': 'Rappels de location',  // Rental reminders
  'ui.rental_start': 'Début de la location',  // Rental start:
  'ui.report_buyer': 'Signaler l\'acheteur',  // Report Buyer
  'ui.report_buyer_listing_issues_or_transaction_dispute': 'Signaler l\'acheteur, les problèmes liés à l\'annonce ou les litiges liés aux transactions.',  // Report buyer, listing issues, or transac
  'ui.report_problem': 'Signaler un Problème',  // Report Problem
  'ui.report_seller_listing_transaction_or_scam_attempt': 'Signaler un vendeur, une annonce, une transaction ou une tentative d\'escroquerie.',  // Report seller, listing, transaction, or 
  'ui.report_type': 'Type de rapport',  // Report Type
  'ui.reports': 'Rapports',  // Reports
  'ui.reports_against_user': 'Rapports contre l\'utilisateur',  // Reports Against User
  'ui.reports_inbox': 'Boîte de réception des rapports',  // Reports Inbox
  'ui.request_extension': 'Demande de prolongation du délai',  // Request Extension
  'ui.request_refund': 'Demande Remboursement',  // Request Refund
  'ui.reset_link': 'Lien de réinitialisation:',  // Reset link:
  'ui.return_tracking': 'Suivi des retours :',  // Return tracking:
  'ui.review_and_approve_or_deny_student_account_registr': 'Examiner et approuver ou refuser les inscriptions au compte étudiant',  // Review and approve or deny student accou
  'ui.review_and_moderate_marketplace_listings': 'Examiner et modérer les annonces sur le marché',  // Review and moderate marketplace listings
  'ui.review_payment': 'Examen du paiement',  // Review Payment
  'ui.review_your': 'Vérifier votre adhésion',  // Review your
  'ui.reviewer_blocked': 'Réviseur bloqué',  // Reviewer Blocked
  'ui.reviews_received': 'Evaluations reçus',  // Reviews Received
  'ui.role': 'Rôle :',  // Role:
  'ui.save_changes': 'Enregistrer les changements',  // Save changes
  'ui.save_items_while_browsing': 'Enregistrez les éléments pendant que vous naviguez.',  // Save items while browsing.
  'ui.saved_items': 'Ma liste',  // Saved Items
  'ui.saving': 'Enreg...',  // Saving...
  'ui.scam_attempt': 'Tentative d\'escroquerie',  // Scam Attempt
  'ui.scan_to_pay': 'Scannez pour payer',  // Scan to Pay
  'ui.secure': 'Sécuriser',  // Secure
  'ui.select_a_pickup_point_to_preview_the_map': 'Sélectionnez un point de prise en charge pour prévisualiser la carte.',  // Select a pickup point to preview the map
  'ui.select_from_approved_locations': 'Sélectionner parmi les emplacements approuvés',  // Select from approved locations
  'ui.select_order': 'Sélectionner commande',  // Select order
  'ui.sell_items': 'Mise en Vente',  // Sell Items
  'ui.seller': 'Vendeur :',  // Seller:
  'ui.seller_actions': 'Actions du vendeur',  // Seller Actions
  'ui.seller_delivery_confirmation': 'Confirmation de livraison du vendeur',  // Seller Delivery Confirmation
  'ui.seller_dispute_center': 'Centre de règlement des litiges du vendeur',  // Seller Dispute Center
  'ui.seller_help': 'Aide aux publications du vendeur',  // Seller Help
  'ui.seller_information': 'Information du vendeur',  // Seller Information
  'ui.seller_notifications': 'Notifications du vendeur',  // Seller Notifications
  'ui.seller_orders': 'Commandes du vendeur',  // Seller Orders
  'ui.seller_rentals': 'Locations du vendeur',  // Seller Rentals
  'ui.seller_reports': 'Rapports du vendeur',  // Seller Reports
  'ui.seller_settings': 'Paramètres du vendeur ',  // Seller Settings
  'ui.seller_studio': 'Studio vendeur',  // Seller Studio
  'ui.seller_uploads_proof_then_buyer_confirms_to_releas': 'Le vendeur télécharge une preuve, puis l\'acheteur confirme qu\'il libère l\'entiercement.',  // Seller uploads proof, then buyer confirm
  'ui.seller_user_id_optional': 'ID vendeur/utilisateur (facultatif)',  // Seller/User ID (optional)
  'ui.seller_wallet': 'Portefeuille du vendeur',  // Seller Wallet
  'ui.sellers_only': 'Vendeurs uniquement',  // Sellers only
  'ui.send_announcements_to_buyers_sellers_or_all_users': 'Envoyez des annonces aux acheteurs, aux vendeurs ou à tous les utilisateurs.',  // Send announcements to buyers, sellers, o
  'ui.send_broadcast': 'Envoyer la diffusion',  // Send Broadcast
  'ui.sending': 'Envoi...',  // Sending...
  'ui.set_a_new_password': 'Définir un nouveau mot de passe',  // Set a new password
  'ui.settings': 'Réglages',  // Settings
  'ui.share_your_experience_with_this_seller': 'Partagez votre expérience avec ce vendeur',  // Share your experience with this seller
  'ui.show_all_purchase_orders_from_buyers': 'Afficher tous les bons de commande des acheteurs.',  // Show all purchase orders from buyers.
  'ui.show_all_rental_transactions_with_actions': 'Afficher toutes les transactions de location avec des actions.',  // Show all rental transactions with action
  'ui.show_email_on_profile': 'Afficher l\'e-mail sur le profil',  // Show email on profile
  'ui.show_phone_on_profile': 'Afficher le téléphone sur le profil',  // Show phone on profile
  'ui.signals_that_build_confidence': 'Des signaux qui renforcent la confiance',  // Signals that build confidence
  'ui.ssl_secured': 'Sécurisation SSL',  // SSL secured
  'ui.start_browsing_and_save_items_that_match_what_you_': 'Commencez à naviguer et enregistrez les éléments qui correspondent à ce dont vous avez besoin pour la vie sur le campus.',  // Start browsing and save items that match
  'ui.start_selling_and_buying_with_confidence': 'Commencez à vendre et à acheter en toute confiance.',  // Start Selling and Buying with Confidence
  'ui.start_shopping_to_create_your_first_escrow_protect': 'Commencez à magasiner pour créer votre première commande protégée par un compte séquestre.',  // Start shopping to create your first escr
  'ui.status': 'Statut :',  // Status:
  'ui.student_id': 'Numéro d\'étudiant:',  // Student ID:
  'ui.student_id_optional': 'Identifiant de l\'étudiant (facultatif)',  // Student ID (Optional)
  'ui.student_members': 'Membres étudiants :',  // Student members
  'ui.student_verified': 'Étudiant vérifié',  // Student verified
  'ui.subject': 'Objet',  // Subject
  'ui.submitting': 'Envoi en cours…',  // Submitting...
  'ui.subtotal': 'Sous-total',  // Subtotal
  'ui.support_email': 'Email du support',  // Support Email
  'ui.sur_toutes_les_commandes': '5% sur toutes les commandes',  // Sur toutes les commandes
  'ui.table_view_of_all_seller_listings_with_filters_and': 'Vue en tableau de toutes les annonces de vendeurs avec filtres et actions.',  // Table view of all seller listings with f
  'ui.target': 'Cibles',  // Target
  'ui.terms_of_service': 'Conditions d\'utilisation',  // Terms of service
  'ui.title': 'Titre :',  // Title:
  'ui.top_categories': 'Catégories Principales',  // Top Categories
  'ui.top_sellers': 'Meilleures ventes',  // Top Sellers
  'ui.top_universities': 'Meilleures universités',  // Top Universities
  'ui.total_active': 'Total actif',  // Total Active
  'ui.total_charged': 'TOTAL facturé',  // Total Charged:
  'ui.total_listings': 'Nombre d\'annonces',  // Total Listings
  'ui.total_messages': 'Total des Messages',  // Total Messages
  'ui.total_paid': 'Montant total : ',  // Total Paid:
  'ui.total_rental_cost': 'Coût de location total',  // Total rental cost:
  'ui.total_users': 'Total des utilisateurs',  // Total Users
  'ui.total_withdrawn': 'Total retiré',  // Total Withdrawn
  'ui.track_rental_status_and_request_extension': 'Suivre l\'état de la location et l\'extension de la',  // Track rental status and request extensio
  'ui.transaction': 'Opération',  // Transaction
  'ui.transaction_dispute': 'Litige de transaction',  // Transaction Dispute
  'ui.transaction_fee': 'Frais de transaction ',  // Transaction Fee:
  'ui.transaction_history': 'Historique des transactions',  // Transaction History
  'ui.transactions_history': 'Historique des transactions',  // Transactions History
  'ui.trust_markers': 'Marqueurs de confiance',  // Trust Markers
  'ui.try_a_different_keyword_or_reset_your_filters_to_s': 'Essayez un autre mot-clé ou réinitialisez vos filtres pour voir tous vos éléments enregistrés.',  // Try a different keyword or reset your fi
  'ui.ub_verified': 'UB vérifié',  // UB verified
  'ui.university': 'Université :',  // University:
  'ui.university_email': 'E-mail de l\'université',  // University Email
  'ui.updating': 'Mise à jour...',  // Updating...
  'ui.upload_buyer_handover_proof_to_enable_buyer_confir': 'Téléchargez la preuve de transfert de l\'acheteur pour permettre la confirmation de l\'acheteur.',  // Upload buyer handover proof to enable bu
  'ui.upload_delivery_proof_from_each_order_page_to_unlo': 'Téléchargez une preuve de livraison à partir de chaque page de commande pour déverrouiller la confirmation.',  // Upload delivery proof from each order pa
  'ui.uploading_profile_picture': 'Téléchargement de la photo de profil...',  // Uploading profile picture...
  'ui.user_activity_log': 'Journal d’activité de l’utilisateur',  // User Activity Log
  'ui.user_listings': 'Listes d’utilisateurs',  // User Listings
  'ui.user_management': 'Gestion des utilisateurs',  // User Management
  'ui.user_not_found': 'Utilisateur non trouvé.',  // User not found.
  'ui.user_registry': '• Gestion locaux',  // User Registry
  'ui.users': 'Utilisateurs',  // Users
  'ui.verified': 'Vérifié',  // Verified
  'ui.verify': 'Vérifier',  // Verify
  'ui.view_all': 'Tout afficher',  // View All
  'ui.view_all_reviews_delete_abusive_reviews_and_block_': 'Affichez tous les commentaires, supprimez les commentaires abusifs et bloquez les spammeurs.',  // View all reviews, delete abusive reviews
  'ui.view_details': 'Voir les détails',  // View Details
  'ui.view_order': 'Voir la réservation',  // View Order
  'ui.view_receipt': 'Voir le relevé de paiement',  // View Receipt
  'ui.view_seller': 'Voir le vendeur',  // View Seller
  'ui.views': 'Vues',  // Views
  'ui.visibility': 'Visibilité',  // Visibility
  'ui.weekly': 'Hebdomadaire',  // Weekly
  'ui.welcome_back': 'Bienvenu à nouveau',  // Welcome Back
  'ui.when_enabled_released_mtn_escrow_payments_are_auto': 'Lorsqu\'ils sont activés, les paiements séquestres MTN libérés sont automatiquement envoyés à l\'argent mobile du vendeur.',  // When enabled, released MTN escrow paymen
  'ui.withdraw_funds': 'Retirer des fonds',  // Withdraw Funds
  'ui.withdraw_platform_revenue_directly_to_the_admin_mo': 'Retirez les revenus de la plateforme directement sur le compte d\'argent mobile de l\'administrateur.',  // Withdraw platform revenue directly to th
  'ui.withdraw_revenue': 'Retirer des revenus',  // Withdraw Revenue
  'ui.withdrawal_amount_xaf': 'Montant du retrait (XAF)',  // Withdrawal Amount (XAF)
  'ui.you_already_have_the_key_ingredients_for_a_trustwo': 'Vous avez déjà les ingrédients clés pour un profil de campus digne de confiance.',  // You already have the key ingredients for
  'ui.you_already_submitted_a_review_for_this_transactio': 'Vous avez déjà envoyé un avis pour cette transaction.',  // You already submitted a review for this 
  'ui.you_are_not_authorized_to_view_this_page': 'Vous n\'êtes pas autorisé à voir cette page.',  // You are not authorized to view this page
  'ui.your_money_is_safe_until_you_confirm_receipt_of_th': 'Votre argent est en sécurité jusqu\'à ce que vous confirmiez la réception de l\'article.',  // Your money is safe until you confirm rec
  'ui.your_review': 'Votre avis',  // Your Review
  'ui.your_trial_has_ended_continue_with_secure_mobile_m': 'Votre essai est terminé. Continuez avec le paiement mobile sécurisé.',  // Your trial has ended. Continue with secu
  'ui.your_university_stays_fixed_so_your_campus_identit': 'Votre université reste fixe afin que votre identité de campus reste cohérente.',  // Your university stays fixed so your camp
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

