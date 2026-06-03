// Authentication Types
export interface LoginCredentials {
  identifier: string; // email or phone
  password: string;
}

export interface RegisterData {
  businessName: string;
  email?: string;
  phoneNumber?: string;
  password: string;
  businessType?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'suspended';

export interface AuthUser {
  _id: string;
  email?: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  businessName: string;
  role: 'vendor' | 'admin';
  isActive: boolean;
  createdAt: string;
  verificationStatus?: VerificationStatus;
  isVerified?: boolean;
}

// Event Types
export interface Event {
  _id: string;
  eventId: string;
  vendorId: string;
  name: string;
  description?: string;
  venue: string;
  eventDate: string; // For single-day: event date. For multi-day: start date
  startTime: string; // For single-day: start time on eventDate. For multi-day: start datetime
  endTime: string; // For single-day: end time on eventDate. For multi-day: end datetime
  isMultiDay?: boolean;
  capacity: number;
  ticketTypes: TicketType[];
  totalTicketsSold: number;
  totalRevenue: number;
  // Media & Images
  posterUrl?: string;
  thumbnailUrl?: string;
  galleryImages?: string[];
  qrCodeUrl?: string;
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface TicketType {
  _id: string;
  name: string; // e.g., "VIP", "General", "Early Bird"
  price: number;
  quantity: number; // Total tickets of this type
  sold: number; // Number sold
  available: number; // quantity - sold
  description?: string;
  isSoldOut?: boolean; // Manual sold-out flag
}

export interface EventFormData {
  name: string;
  description?: string;
  venue: string;
  eventDate: string; // For single-day: event date. For multi-day: start date
  startTime: string; // For single-day: start time. For multi-day: start datetime
  endTime: string; // For single-day: end time. For multi-day: end datetime
  isMultiDay?: boolean;
  capacity: number;
  ticketTypes: {
    name: string;
    price: number;
    quantity: number; // Changed from capacity
    description?: string;
  }[];
}

// Sales Types
export interface TicketSale {
  _id: string;
  eventId: string;
  event?: Event;
  ticketTypeId: string;
  ticketType?: TicketType;
  quantity: number;
  totalAmount: number;
  customerName: string;
  customerPhone: string;
  paymentMethod: 'cash' | 'keshless_wallet';
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'failed';
  tickets: Ticket[];
  vendorId: string;
  soldBy: string;
  soldByName?: string;
  createdAt: string;
  refundedAt?: string;
  refundReason?: string;
}

export interface Ticket {
  _id: string;
  ticketId: string; // QR code ID
  saleId: string;
  eventId: string;
  ticketTypeId: string;
  status: 'valid' | 'used' | 'refunded' | 'cancelled';
  scannedAt?: string;
  scannedBy?: string;
  createdAt: string;
}

export interface SellTicketsRequest {
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  customerName: string;
  customerPhone: string;
  paymentMethod: 'cash' | 'keshless_wallet';
  walletCardNumber?: string;
  walletPin?: string;
}

// Scan Types
export interface ScanRecord {
  _id: string;
  ticketId: string;
  ticket?: Ticket;
  eventId: string;
  event?: Event;
  scannedBy: string;
  scannedByName?: string;
  status: 'success' | 'failed';
  failureReason?: string;
  notes?: string;
  createdAt: string;
}

export interface ValidateTicketRequest {
  ticketId: string;
}

export interface CheckInRequest {
  ticketId: string;
  notes?: string;
}

export interface ValidateTicketResponse {
  valid: boolean;
  ticket?: Ticket;
  event?: Event;
  ticketType?: TicketType;
  message: string;
}

// Analytics Types
export interface DashboardStats {
  totalRevenue: number;
  ticketsSold: number;
  activeEvents: number;
  todayScans: number;
  revenueChange?: number; // percentage change from previous period
  salesChange?: number;
  eventsChange?: number;
  scansChange?: number;
}

export interface SalesStats {
  totalSales: number;
  totalRevenue: number;
  totalRefunds: number;
  refundedAmount: number;
  averageSaleAmount: number;
  salesByPaymentMethod: {
    cash: number;
    keshless_wallet: number;
  };
}

export interface RevenueStats {
  period: string;
  totalRevenue: number;
  ticketsSold: number;
  averageTicketPrice: number;
  revenueByEvent: {
    eventId: string;
    eventName: string;
    revenue: number;
    ticketsSold: number;
  }[];
  revenueByPaymentMethod: {
    method: 'cash' | 'keshless_wallet';
    amount: number;
    count: number;
  }[];
  dailyRevenue?: {
    date: string;
    revenue: number;
    ticketsSold: number;
  }[];
}

export interface EventAnalytics {
  event: {
    id: string;
    name: string;
    venue: string;
    eventDate: string;
    status: string;
  };
  sales: {
    totalSales: number;
    totalRevenue: number;
    ticketsSold: number;
    checkedIn: number;
    checkInRate: number;
  };
  ticketTypes: {
    name: string;
    price: number;
    quantity: number;
    sold: number;
    available: number;
    revenue: number;
  }[];
}

// Query Parameters
export interface EventQueryParams {
  page?: number;
  limit?: number;
  status?: 'draft' | 'published' | 'cancelled' | 'completed';
  search?: string;
}

export interface SalesQueryParams {
  page?: number;
  limit?: number;
  eventId?: string;
  paymentMethod?: 'cash' | 'keshless_wallet';
  paymentStatus?: 'pending' | 'paid' | 'refunded' | 'failed';
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface ScanQueryParams {
  page?: number;
  limit?: number;
  eventId?: string;
  status?: 'success' | 'failed';
  startDate?: string;
  endDate?: string;
}

export interface StatsQueryParams {
  startDate?: string;
  endDate?: string;
  eventId?: string;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// API Error
export interface ApiError {
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
}
