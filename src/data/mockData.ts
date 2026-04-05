// Mock data for Cameroon Student Marketplace

export interface University {
  id: string;
  name: string;
  location: string;
}

export interface Location {
  id: string;
  name: string;
  university: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  university: string;
  studentId?: string;
  avatar?: string;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  role: 'student' | 'admin';
  userType: 'buyer' | 'seller';
}

export interface Item {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  type: 'sell' | 'rent';
  rentalPeriod?: 'daily' | 'weekly' | 'monthly';
  images: string[];
  sellerId: string;
  location: string;
  condition: 'new' | 'like-new' | 'good' | 'fair';
  status: 'available' | 'sold' | 'rented';
  createdAt: string;
  views: number;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  itemId?: string;
  content: string;
  timestamp: string;
  read: boolean;
}

export interface Transaction {
  id: string;
  buyerId: string;
  sellerId: string;
  itemId: string;
  amount: number;
  paymentMethod: 'mtn-momo' | 'orange-money';
  status: 'pending' | 'successful' | 'failed';
  transactionRef: string;
  timestamp: string;
}

export interface Review {
  id: string;
  reviewerId: string;
  reviewedUserId: string;
  transactionId: string;
  rating: number;
  comment: string;
  timestamp: string;
}

export interface PendingUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  university: string;
  studentId?: string;
  createdAt: string;
  userType: 'buyer' | 'seller';
}

// Cameroon Universities
export const universities: University[] = [
  { id: '1', name: 'University of Buea', location: 'Buea, South-West Region' },
  { id: '2', name: 'University of Yaoundé I', location: 'Yaoundé, Centre Region' },
  { id: '3', name: 'University of Douala', location: 'Douala, Littoral Region' },
  { id: '4', name: 'University of Dschang', location: 'Dschang, West Region' },
  { id: '5', name: 'University of Bamenda', location: 'Bamenda, North-West Region' },
  { id: '6', name: 'University of Maroua', location: 'Maroua, Far North Region' },
  { id: '7', name: 'University of Ngaoundéré', location: 'Ngaoundéré, Adamawa Region' },
  { id: '8', name: 'University of Yaoundé II (Soa)', location: 'Soa, Centre Region' },
  { id: '9', name: 'ICT University', location: 'Yaoundé, Centre Region' },
  { id: '10', name: 'Catholic University of Central Africa (UCAC)', location: 'Yaoundé, Centre Region' },
  { id: '11', name: 'National Advanced School of Engineering Yaoundé', location: 'Yaoundé, Centre Region' },
  { id: '12', name: 'IRIC - University of Yaoundé II', location: 'Yaoundé, Centre Region' },
  { id: '13', name: 'Université Protestante d’Afrique Centrale', location: 'Yaoundé, Centre Region' },
  { id: '14', name: 'Yaoundé School of Management', location: 'Yaoundé, Centre Region' },
];

// Locations near universities
export const locations: Location[] = [
  { id: '1', name: 'Campus', university: '1' },
  { id: '2', name: 'Molyko', university: '1' },
  { id: '3', name: 'Bomaka', university: '1' },
  { id: '4', name: 'Ngoa-Ekellé', university: '2' },
  { id: '5', name: 'Cité Verte', university: '2' },
  { id: '6', name: 'PK 8', university: '3' },
  { id: '7', name: 'PK 10', university: '3' },
  { id: '8', name: 'Akwa', university: '3' },
  { id: '9', name: 'City Centre', university: '4' },
  { id: '10', name: 'Student Hostels', university: '5' },
  { id: '11', name: 'Soa Campus', university: '8' },
  { id: '12', name: 'Mendong', university: '9' },
  { id: '13', name: 'Messa', university: '10' },
  { id: '14', name: 'Nkolbisson', university: '11' },
  { id: '15', name: 'Bastos', university: '12' },
  { id: '16', name: 'Biyem-Assi', university: '13' },
  { id: '17', name: 'Poste Centrale', university: '14' },
];

// Item Categories
export const categories: Category[] = [
  { id: '1', name: 'Beds & Mattresses', icon: 'Bed' },
  { id: '2', name: 'Tables & Chairs', icon: 'Armchair' },
  { id: '3', name: 'Kitchen Utensils', icon: 'UtensilsCrossed' },
  { id: '4', name: 'Electronics', icon: 'Tv' },
  { id: '5', name: 'Study Furniture', icon: 'BookOpen' },
  { id: '6', name: 'Home Decor', icon: 'Home' },
];

// Mock Users (password for all: "password123")
export const users: User[] = [
  {
    id: '1',
    name: 'Amina Ngoma',
    email: 'amina.ngoma@student.ub.cm',
    phone: '+237 670 123 456',
    university: '1',
    studentId: 'UB2024001',
    rating: 4.8,
    reviewCount: 12,
    isVerified: true,
    role: 'student',
    userType: 'seller',
  },
  {
    id: '2',
    name: 'Jean-Paul Fotso',
    email: 'jeanpaul.fotso@student.uy1.cm',
    phone: '+237 655 234 567',
    university: '2',
    studentId: 'UY1-2023-456',
    rating: 4.6,
    reviewCount: 8,
    isVerified: true,
    role: 'student',
    userType: 'seller',
  },
  {
    id: '3',
    name: 'Grace Mbah',
    email: 'grace.mbah@student.uds.cm',
    phone: '+237 678 345 678',
    university: '4',
    rating: 4.9,
    reviewCount: 15,
    isVerified: true,
    role: 'student',
    userType: 'seller',
  },
  {
    id: 'admin1',
    name: 'Admin User',
    email: 'admin@UNITRADE.cm',
    phone: '+237 600 000 000',
    university: '1',
    rating: 5.0,
    reviewCount: 0,
    isVerified: true,
    role: 'admin',
    userType: 'seller',
  },
];

// Mock Items
export const items: Item[] = [
  {
    id: '1',
    title: 'Comfortable Single Bed with Mattress',
    description: 'Good quality single bed frame with a fairly used mattress. Perfect for student accommodation. Used for 1 year only.',
    category: '1',
    price: 45000,
    type: 'sell',
    images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800'],
    sellerId: '1',
    location: '2',
    condition: 'good',
    status: 'available',
    createdAt: '2026-01-15T10:00:00Z',
    views: 124,
  },
  {
    id: '2',
    title: 'Study Desk and Chair Set',
    description: 'Wooden study desk with a comfortable chair. Great for studying. Selling because I\'m graduating.',
    category: '5',
    price: 35000,
    type: 'sell',
    images: ['https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800'],
    sellerId: '2',
    location: '4',
    condition: 'like-new',
    status: 'available',
    createdAt: '2026-01-20T14:30:00Z',
    views: 89,
  },
  {
    id: '3',
    title: 'Mini Fridge - 120L',
    description: 'Small fridge perfect for keeping drinks and snacks cold. Very energy efficient. Available for rent per semester.',
    category: '4',
    price: 15000,
    type: 'rent',
    rentalPeriod: 'monthly',
    images: ['https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800'],
    sellerId: '3',
    location: '9',
    condition: 'good',
    status: 'available',
    createdAt: '2026-01-25T09:15:00Z',
    views: 156,
  },
  {
    id: '4',
    title: 'Complete Kitchen Utensil Set',
    description: 'Pots, pans, plates, cups, spoons, and more. Everything a student needs for cooking. Gently used.',
    category: '3',
    price: 18000,
    type: 'sell',
    images: ['https://images.unsplash.com/photo-1556911220-bff31c812dba?w=800'],
    sellerId: '1',
    location: '2',
    condition: 'good',
    status: 'available',
    createdAt: '2026-01-28T11:00:00Z',
    views: 67,
  },
  {
    id: '5',
    title: 'Standing Fan',
    description: 'Powerful standing fan. Essential for hot weather in Cameroon. Works perfectly.',
    category: '4',
    price: 12000,
    type: 'sell',
    images: ['https://images.unsplash.com/photo-1632207691143-643e2f17ac0e?w=800'],
    sellerId: '2',
    location: '4',
    condition: 'good',
    status: 'available',
    createdAt: '2026-01-30T16:45:00Z',
    views: 92,
  },
  {
    id: '6',
    title: 'Plastic Wardrobe',
    description: 'Large plastic wardrobe with shelves. Good for storing clothes. Lightweight and easy to move.',
    category: '6',
    price: 25000,
    type: 'sell',
    images: ['https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=800'],
    sellerId: '3',
    location: '9',
    condition: 'like-new',
    status: 'available',
    createdAt: '2026-02-01T08:30:00Z',
    views: 78,
  },
  {
    id: '7',
    title: 'Dining Table with 4 Chairs',
    description: 'Solid wood dining table with 4 matching chairs. Great for shared apartments.',
    category: '2',
    price: 55000,
    type: 'sell',
    images: ['https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800'],
    sellerId: '1',
    location: '2',
    condition: 'good',
    status: 'available',
    createdAt: '2026-02-02T13:20:00Z',
    views: 103,
  },
  {
    id: '8',
    title: 'Reading Lamp',
    description: 'Adjustable LED reading lamp. Perfect for late-night studying. Energy saving.',
    category: '5',
    price: 5000,
    type: 'sell',
    images: ['https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800'],
    sellerId: '2',
    location: '4',
    condition: 'like-new',
    status: 'available',
    createdAt: '2026-02-03T10:10:00Z',
    views: 45,
  },
];

// Mock Messages
export const messages: Message[] = [
  {
    id: '1',
    senderId: '2',
    receiverId: '1',
    itemId: '1',
    content: 'Hi, is the bed still available?',
    timestamp: '2026-02-03T09:00:00Z',
    read: true,
  },
  {
    id: '2',
    senderId: '1',
    receiverId: '2',
    itemId: '1',
    content: 'Yes, it is! Would you like to come see it?',
    timestamp: '2026-02-03T09:15:00Z',
    read: true,
  },
  {
    id: '3',
    senderId: '2',
    receiverId: '1',
    itemId: '1',
    content: 'Great! Can I come by tomorrow afternoon?',
    timestamp: '2026-02-03T09:20:00Z',
    read: false,
  },
];

// Mock Transactions
export const transactions: Transaction[] = [
  {
    id: 'TXN001',
    buyerId: '2',
    sellerId: '3',
    itemId: '3',
    amount: 15000,
    paymentMethod: 'mtn-momo',
    status: 'successful',
    transactionRef: 'MTN-202602-A1B2C3',
    timestamp: '2026-02-01T14:30:00Z',
  },
  {
    id: 'TXN002',
    buyerId: '3',
    sellerId: '2',
    itemId: '5',
    amount: 12000,
    paymentMethod: 'orange-money',
    status: 'successful',
    transactionRef: 'OM-202602-X9Y8Z7',
    timestamp: '2026-02-02T11:20:00Z',
  },
];

// Mock Reviews
export const reviews: Review[] = [
  {
    id: '1',
    reviewerId: '2',
    reviewedUserId: '3',
    transactionId: 'TXN001',
    rating: 5,
    comment: 'Great seller! Item was exactly as described. Smooth transaction.',
    timestamp: '2026-02-01T16:00:00Z',
  },
  {
    id: '2',
    reviewerId: '3',
    reviewedUserId: '2',
    transactionId: 'TXN002',
    rating: 5,
    comment: 'Very responsive and friendly. Highly recommend!',
    timestamp: '2026-02-02T13:45:00Z',
  },
];

// Mock Pending Users (awaiting admin approval)
export const pendingUsers: PendingUser[] = [
  {
    id: 'pending1',
    name: 'Foyeh Nathaniel',
    email: 'foyeh.nathaniel@student.ubea.cm',
    phone: '+237 698 765 432',
    university: '1',
    studentId: 'UB2024234',
    createdAt: '2026-02-02T10:30:00Z',
    userType: 'seller',
  },
  {
    id: 'pending2',
    name: 'Zara Mohammed',
    email: 'zara.mohammed@student.ud.cm',
    phone: '+237 676 543 210',
    university: '3',
    createdAt: '2026-02-03T14:15:00Z',
    userType: 'buyer',
  },
  {
    id: 'pending3',
    name: 'Claude Kengue',
    email: 'claude.kengue@student.undg.cm',
    phone: '+237 655 678 901',
    university: '7',
    studentId: 'UN2024567',
    createdAt: '2026-02-03T16:45:00Z',
    userType: 'seller',
  },
];

// Mock Favorites (wishlist items for each user)
export const favorites: Map<string, string[]> = new Map([
  ['1', ['2', '4', '6']],  // User 1 has items 2, 4, 6 in favorites
  ['2', ['1', '3', '5']],  // User 2 has items 1, 3, 5 in favorites
  ['3', ['2', '7']],       // User 3 has items 2, 7 in favorites
]);

// Helper function to format FCFA currency
export const formatCurrency = (amount: number): string => {
  return `${amount.toLocaleString('fr-FR')} FCFA`;
};

// Helper function to get user by id
export const getUserById = (id: string): User | undefined => {
  return users.find(user => user.id === id);
};

// Helper function to get university by id
export const getUniversityById = (id: string): University | undefined => {
  return universities.find(uni => uni.id === id);
};

// Resolve university label from either an ID or an already-saved name.
export const getUniversityName = (value?: string): string => {
  const raw = String(value || '').trim();
  if (!raw) {
    return 'University not specified';
  }

  const byId = universities.find((uni) => uni.id === raw);
  if (byId) {
    return byId.name;
  }

  const normalizedRaw = raw.toLowerCase();
  const byName = universities.find((uni) => uni.name.toLowerCase() === normalizedRaw);
  if (byName) {
    return byName.name;
  }

  return raw;
};

// Helper function to get category by id
export const getCategoryById = (id: string): Category | undefined => {
  return categories.find(cat => cat.id === id);
};

// Helper function to get location by id
export const getLocationById = (id: string): Location | undefined => {
  return locations.find(loc => loc.id === id);
};

