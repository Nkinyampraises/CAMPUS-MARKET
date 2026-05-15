import os

fixes = {
    'src/pages/SellerDashboard.tsx': [
        ('>Loading dashboard...<', '>{t("common.loading", "Loading...")}<'),
        ('>Listings<', '>{t("seller.totalListings", "Listings")}<'),
        ('>Pending Escrow<', '>{t("seller.pendingOrders", "Pending Escrow")}<'),
        ('>Released Orders<', '>{t("order.confirmed", "Released Orders")}<'),
        ('>Pending Balance<', '>{t("payment.summary", "Pending Balance")}<'),
        ('>Available Balance<', '>{t("seller.totalEarnings", "Available Balance")}<'),
        ('>No sales yet<', '>{t("seller.noSales", "No sales yet")}<'),
        ('>1 active<', '>{t("seller.activeListings", "1 active")}<'),
        ('>Awaiting buyer confirmation<', '>{t("seller.awaitingBuyer", "Awaiting buyer confirmation")}<'),
        ('>Escrow released<', '>{t("order.confirmed", "Escrow released")}<'),
        ('>Locked in escrow<', '>{t("seller.lockedEscrow", "Locked in escrow")}<'),
        ('>Ready for withdrawal<', '>{t("seller.readyWithdraw", "Ready for withdrawal")}<'),
        ('>Your buyer orders will appear here.<', '>{t("seller.noOrdersDesc", "Your buyer orders will appear here.")}<'),
    ],
    'src/pages/BuyerDashboard.tsx': [
        ('>Loading your dashboard...<', '>{t("common.loading", "Loading...")}<'),
        ('>Total Orders<', '>{t("buyer.totalOrders", "Total Orders")}<'),
        ('>Pending Delivery<', '>{t("buyer.pendingDelivery", "Pending Delivery")}<'),
        ('>Total Spent<', '>{t("buyer.totalSpent", "Total Spent")}<'),
        ('>Saved Items<', '>{t("buyer.savedItems", "Saved Items")}<'),
        ('>Escrow transactions<', '>{t("buyer.escrowTransactions", "Escrow transactions")}<'),
        ('>Awaiting seller proof/confirmation<', '>{t("buyer.awaitingConfirmation", "Awaiting seller proof/confirmation")}<'),
        ('>Across all order states<', '>{t("buyer.acrossOrders", "Across all order states")}<'),
        ('>Wishlist items<', '>{t("buyer.wishlistItems", "Wishlist items")}<'),
        ('>Escrow Orders<', '>{t("order.escrowOrders", "Escrow Orders")}<'),
        ('>Payment status and delivery confirmation flow.<', '>{t("order.escrowDesc", "Payment status and delivery confirmation flow.")}<'),
        ('>No orders found.<', '>{t("order.noOrders", "No orders found.")}<'),
    ],
    'src/pages/OrderDetails.tsx': [
        ('>Track escrow status, delivery proof, and confirmation steps.<', '>{t("order.trackDesc", "Track escrow status, delivery proof, and confirmation steps.")}<'),
        ('>Pickup Details<', '>{t("checkout.pickupDetails", "Pickup Details")}<'),
        ('>Pickup Location Map<', '>{t("order.pickupMap", "Pickup Location Map")}<'),
        ('>Buyer Information<', '>{t("order.buyerInfo", "Buyer Information")}<'),
        ('>Seller Information<', '>{t("order.sellerInfo", "Seller Information")}<'),
        ('>Confirm Delivery<', '>{t("order.confirmDelivery", "Confirm Delivery")}<'),
        ('>Request Refund<', '>{t("order.requestRefund", "Request Refund")}<'),
        ('>No delivery proof uploaded yet.<', '>{t("order.noProof", "No delivery proof uploaded yet.")}<'),
        ('>Delivery & Escrow Confirmation<', '>{t("order.deliveryEscrow", "Delivery & Escrow Confirmation")}<'),
        ('>I have received this product.<', '>{t("order.receivedProduct", "I have received this product.")}<'),
        ('>I am satisfied with this product.<', '>{t("order.satisfied", "I am satisfied with this product.")}<'),
    ],
    'src/pages/AddListing.tsx': [
        ('>Basic Details<', '>{t("listing.basicDetails", "Basic Details")}<'),
        ('>Tell students what you are listing and why it is worth buying.<', '>{t("listing.basicHint", "Tell students what you are listing and why it is worth buying.")}<'),
        ('>Listing Setup<', '>{t("listing.setup", "Listing Setup")}<'),
        ('>Set category, location, condition, and the best pricing model.<', '>{t("listing.setupHint", "Set category, location, condition, and the best pricing model.")}<'),
        ('>Photos<', '>{t("listing.photos", "Photos")}<'),
        ('>Upload up to five clear images from different angles.<', '>{t("listing.photoHint", "Upload up to five clear images from different angles.")}<'),
        ('>Create Listing<', '>{t("listing.publish", "Create Listing")}<'),
        ('>Completion<', '>{t("listing.completion", "Completion")}<'),
        ('>Listing Preview<', '>{t("listing.preview", "Listing Preview")}<'),
        ('>For Sale<', '>{t("listing.forSale", "For Sale")}<'),
        ('>For Rent<', '>{t("listing.forRent", "For Rent")}<'),
        ('>Quick summary before publishing.<', '>{t("listing.quickSummary", "Quick summary before publishing.")}<'),
    ],
    'src/pages/Checkout.tsx': [
        ('>Order Summary<', '>{t("checkout.orderSummary", "Order Summary")}<'),
        ('>Payment Method<', '>{t("checkout.paymentMethod", "Payment Method")}<'),
        ('>Pickup Details<', '>{t("checkout.pickupDetails", "Pickup Details")}<'),
        ('>Preferred Date<', '>{t("checkout.preferredDate", "Preferred Date")}<'),
        ('>Preferred Time<', '>{t("checkout.preferredTime", "Preferred Time")}<'),
        ('>Meeting Location<', '>{t("checkout.meetingLocation", "Meeting Location")}<'),
        ('>Review Payment<', '>{t("checkout.reviewPayment", "Review Payment")}<'),
        ('>Platform Fee<', '>{t("checkout.platformFee", "Platform Fee")}<'),
        ('>Instant processing<', '>{t("checkout.instantProcessing", "Instant processing")}<'),
        ('>MTN Mobile Money<', '>{t("checkout.mtnMomo", "MTN Mobile Money")}<'),
        ('>Orange Money<', '>{t("checkout.orangeMoney", "Orange Money")}<'),
        ('>Payments are held in escrow until pickup is confirmed.<', '>{t("checkout.escrowNote", "Payments are held in escrow until pickup is confirmed.")}<'),
    ],
    'src/pages/Favorites.tsx': [
        ('>No saved items found.<', '>{t("favorites.noFavorites", "No saved items found.")}<'),
        ('>Save items you like to find them later.<', '>{t("favorites.noFavoritesSub", "Save items you like to find them later.")}<'),
    ],
    'src/pages/SellerManageListings.tsx': [
        ('>Loading listings...<', '>{t("common.loading", "Loading listings...")}<'),
        ('>No listings found.<', '>{t("marketplace.noItems", "No listings found.")}<'),
        ('>Manage Listings<', '>{t("nav.manageListings", "Manage Listings")}<'),
        ('>Edit<', '>{t("common.edit", "Edit")}<'),
        ('>Delete<', '>{t("common.delete", "Delete")}<'),
    ],
    'src/pages/PaymentReview.tsx': [
        ('>Verify the transaction details below before confirming. Funds will be held in escrow until item collection.<',
         '>{t("payment.reviewSubtitle", "Verify the transaction details below before confirming. Funds will be held in escrow until item collection.")}<'),
        ('>Sender<', '>{t("payment.sender", "Sender")}<'),
        ('>Receiver<', '>{t("payment.receiver", "Receiver")}<'),
        ('>Cancel Transaction<', '>{t("payment.cancelBtn", "Cancel Transaction")}<'),
        ('>Payment Summary<', '>{t("payment.summary", "Payment Summary")}<'),
        ('>Item Price<', '>{t("payment.itemPrice", "Item Price")}<'),
        ('>Escrow Protection<', '>{t("payment.escrowProtection", "Escrow Protection")}<'),
        ('>Total Payable<', '>{t("payment.totalPayable", "Total Payable")}<'),
        ('>Buyer Protection Active.<', '>{t("payment.buyerProtection", "Buyer Protection Active.")}<'),
        ('>Your money is safe until you confirm receipt of the item.<', '>{t("payment.safeNote", "Your money is safe until you confirm receipt of the item.")}<'),
    ],
}

# Also add French translations for new keys
new_fr_translations = {
    'seller.noSales': 'Aucune vente pour l\'instant',
    'seller.activeListings': 'annonces actives',
    'seller.awaitingBuyer': 'En attente de confirmation acheteur',
    'seller.lockedEscrow': 'Bloqué en dépôt fiduciaire',
    'seller.readyWithdraw': 'Prêt pour retrait',
    'seller.noOrdersDesc': 'Vos commandes acheteurs apparaîtront ici.',
    'order.trackDesc': 'Suivre le statut du dépôt fiduciaire, les preuves de livraison et les étapes de confirmation.',
    'order.pickupMap': 'Carte du lieu de récupération',
    'order.deliveryEscrow': 'Confirmation de livraison et dépôt fiduciaire',
    'order.noProof': 'Aucune preuve de livraison téléchargée.',
    'order.receivedProduct': 'J\'ai reçu ce produit.',
    'order.satisfied': 'Je suis satisfait de ce produit.',
    'order.notFound': 'Commande introuvable',
    'listing.basicDetails': 'Informations de base',
    'listing.basicHint': 'Dites aux étudiants ce que vous listez et pourquoi cela vaut la peine d\'être acheté.',
    'listing.setup': 'Configuration de l\'annonce',
    'listing.setupHint': 'Définissez la catégorie, le lieu, l\'état et le modèle de prix.',
    'listing.photoHint': 'Téléchargez jusqu\'à cinq images claires sous différents angles.',
    'listing.quickSummary': 'Aperçu rapide avant publication.',
    'checkout.total': 'Total',
    'checkout.subtotal': 'Sous-total',
    'order.escrowOrders': 'Commandes en dépôt fiduciaire',
    'order.escrowDesc': 'Statut de paiement et flux de confirmation de livraison.',
}

# Apply fixes to pages
for fpath, replacements in fixes.items():
    if not os.path.exists(fpath):
        print(f'SKIP (not found): {fpath}')
        continue
    content = open(fpath, encoding='utf-8').read()
    changed = 0
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new)
            changed += 1
    open(fpath, 'w', encoding='utf-8').write(content)
    print(f'Fixed {changed} strings: {fpath}')

# Add new French translations to LanguageContext
lang_path = 'src/contexts/LanguageContext.tsx'
lang_content = open(lang_path, encoding='utf-8').read()
marker = "  'common.yes': 'Oui',"
new_entries = '\n'.join(f"  '{k}': '{v}'," for k, v in new_fr_translations.items() if k not in lang_content)
if new_entries:
    lang_content = lang_content.replace(marker, f"{new_entries}\n  'common.yes': 'Oui',")
    open(lang_path, 'w', encoding='utf-8').write(lang_content)
    print(f'Added {len(new_fr_translations)} FR translations to LanguageContext')

print('Done!')
