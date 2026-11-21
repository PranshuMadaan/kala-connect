// Shared types between client and server

export type UserRole = 'artisan' | 'buyer' | 'admin';
export type Language = 'en' | 'hi' | 'mr' | 'bn' | 'te';
export type ProductStatus = 'draft' | 'processing' | 'review' | 'published' | 'archived';
export type EnquiryStatus = 'pending' | 'accepted' | 'rejected' | 'counter_offered' | 'closed';
export type OrderStatus = 'enquiry_received' | 'price_agreed' | 'order_confirmed' | 'preparing' | 'shipped' | 'delivered';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  language: Language;
  createdAt: string;
}

export interface ArtisanProfile {
  id: number;
  userId: number;
  displayName: string;
  bio: string;
  village: string;
  district: string;
  state: string;
  craftCategories: string[];
  yearsExperience: number;
  phoneNumber?: string;
  whatsappNumber?: string;
  allowWhatsApp: boolean;
  profileImageUrl?: string;
  isVerified: boolean;
  totalSales: number;
  rating: number;
  createdAt: string;
}

export interface Product {
  id: number;
  artisanId: number;
  artisanName: string;
  artisanVillage: string;
  artisanState: string;
  title: string;
  description: string;
  category: CraftCategory;
  materials: string[];
  dimensions?: { height?: string; width?: string; depth?: string; weight?: string; diameter?: string };
  timeTakenDays: number;
  stockCount: number;
  makerPrice: number;
  suggestedPrice: number;
  finalPrice: number;
  priceBreakdown?: PriceBreakdown;
  tags: string[];
  images: ProductImage[];
  coverImageUrl: string;
  status: ProductStatus;
  isGITagged: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductImage {
  id: number;
  productId: number;
  url: string;
  isCover: boolean;
  sortOrder: number;
}

export interface PriceBreakdown {
  materialCost: number;
  labourCost: number;
  packagingCost: number;
  otherCosts: number;
  platformFee: number;
  suggestedArtisanPrice: number;
  estimatedBuyerPrice: number;
  artisanPayout: number;
}

export type CraftCategory =
  | 'textiles'
  | 'pottery'
  | 'jewellery'
  | 'woodwork'
  | 'paintings'
  | 'home_decor'
  | 'traditional_crafts'
  | 'other';

export interface Enquiry {
  id: number;
  productId: number;
  productTitle: string;
  productImageUrl: string;
  buyerId: number;
  buyerName: string;
  artisanId: number;
  artisanName: string;
  status: EnquiryStatus;
  initialMessage: string;
  offeredPrice?: number;
  agreedPrice?: number;
  messages: EnquiryMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface EnquiryMessage {
  id: number;
  enquiryId: number;
  senderId: number;
  senderName: string;
  senderRole: UserRole;
  message: string;
  offerPrice?: number;
  createdAt: string;
}

export interface Order {
  id: number;
  enquiryId: number;
  productId: number;
  productTitle: string;
  productImageUrl: string;
  buyerId: number;
  buyerName: string;
  artisanId: number;
  artisanName: string;
  agreedPrice: number;
  platformFee: number;
  artisanPayout: number;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; timestamp: string; note?: string }[];
  shippingAddress?: string;
  trackingNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDraft {
  id: string;
  artisanId: number;
  step: 1 | 2 | 3 | 4 | 5;
  // Step 1 fields
  title?: string;
  category?: CraftCategory;
  materials?: string[];
  timeTakenDays?: number;
  dimensions?: Product['dimensions'];
  stockCount?: number;
  makerPrice?: number;
  careInstructions?: string;
  // Step 2 fields
  uploadedImages?: string[];
  videoUrl?: string;
  // Step 3-5 fields (AI generated)
  aiTitle?: string;
  aiDescription?: string;
  aiTags?: string[];
  aiCategory?: CraftCategory;
  priceBreakdown?: PriceBreakdown;
  selectedImages?: string[];
  coverImageIndex?: number;
  status: 'draft' | 'ai_processing' | 'ai_complete' | 'published';
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface SearchFilters {
  query?: string;
  category?: CraftCategory;
  minPrice?: number;
  maxPrice?: number;
  state?: string;
  sortBy?: 'newest' | 'price_asc' | 'price_desc' | 'rating';
  page?: number;
  pageSize?: number;
}

export interface DashboardStats {
  totalProducts: number;
  publishedProducts: number;
  draftProducts: number;
  newEnquiries: number;
  totalOrders: number;
  totalEarnings: number;
  pendingPayout: number;
}

export interface AIGenerationResult {
  title: string;
  description: string;
  tags: string[];
  category: CraftCategory;
  priceBreakdown: PriceBreakdown;
  missingInfo: string[];
  confidence: number;
  isDemo: boolean;
}
