export * from './reseller';

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
  // Raw role from the API (e.g. 'tickets_owner', 'tickets_sales'); kept as a
  // string so we don't have to enumerate every TicketsRole on the client.
  role: string;
  isActive: boolean;
  createdAt: string;
  verificationStatus?: VerificationStatus;
  isVerified?: boolean;
  // Account capabilities — used to show/hide nav tabs for restricted accounts
  // (e.g. a sales-only reseller). Full vendor accounts get every permission.
  permissions?: string[];
  userType?: 'vendor' | 'sub-user';
  // True for Keshless platform admins, who approve events and see every
  // vendor's sales/scans. Set from the API's getMe/login payload.
  isSuperAdmin?: boolean;
}

export interface PaymentMethodSettings {
  keshlessWalletEnabled: boolean;
  mtnMomoEnabled: boolean;
  cashEnabled: boolean;
  defaultResellerCommissionPercent: number;
  platformFeePercent: number;
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
  status: 'draft' | 'pending_approval' | 'published' | 'cancelled' | 'completed';
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
  // Optional — total capacity is derived server-side from the sum of ticket
  // quantities, so the create form no longer asks for it.
  capacity?: number;
  ticketTypes: {
    name: string;
    price: number;
    quantity: number; // Changed from capacity
    description?: string;
  }[];
}

// Event creator (organizer) + their event history — powers the admin
// "Creator" panel on the event detail page.
export interface EventCreator {
  _id: string;
  businessName: string;
  email?: string;
  phoneNumber?: string;
  primaryContact?: string;
  businessType?: string;
  verificationStatus?: VerificationStatus;
  verifiedAt?: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface EventCreatorSummary {
  creator: EventCreator;
  stats: {
    totalEvents: number;
    totalTicketsSold: number;
    totalRevenue: number;
  };
  events: Array<{
    _id: string;
    name: string;
    status: Event['status'];
    eventDate: string;
    venue: string;
    totalTicketsSold: number;
    totalRevenue: number;
    capacity: number;
    posterUrl?: string;
    thumbnailUrl?: string;
    createdAt: string;
  }>;
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
  paymentStatus: 'pending' | 'paid' | 'completed' | 'refunded' | 'failed';
  tickets: Ticket[];
  // Individual tickets as populated by the sales list endpoint (each carries
  // its scannable `ticketId` code and `ticketType` name).
  ticketIds?: Ticket[];
  vendorId: string;
  soldBy: string;
  soldByName?: string;
  // "Where bought" — set by the API at sale time.
  channel?: 'online' | 'box_office' | 'reseller_pos';
  // Populated reseller/hub for reseller_pos sales (name only).
  resellerId?: { _id: string; name: string } | string;
  hubId?: { _id: string; name: string } | string;
  createdAt: string;
  refundedAt?: string;
  refundReason?: string;
}

export interface Ticket {
  _id: string;
  ticketId: string; // QR code ID
  saleId: string;
  eventId: string;
  ticketTypeId?: string;
  ticketType?: string; // denormalized ticket type name (e.g. "VIP")
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
  // Populated by the scans endpoint: the scanned Ticket object (carries the
  // scannable `ticketId` code). May be a raw id string if not populated.
  ticketId: string | Ticket;
  ticket?: Ticket;
  eventId: string;
  event?: Event;
  scannedBy: string;
  scannedByName?: string;
  // Normalized two-state status (matches the API's `status` field); the raw
  // outcome stays in `scanResult` for failure-reason display.
  status: 'success' | 'failed';
  scanResult?: 'success' | 'already_scanned' | 'invalid_ticket' | 'wrong_event' | 'cancelled';
  failureReason?: string;
  notes?: string;
  scannedAt?: string;
  createdAt: string;
}

export interface ScanStats {
  totalScans: number;
  successfulScans: number;
  failedScans: number;
  alreadyScannedCount: number;
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
  revenueByChannel?: Array<{ channel: string; amount: number; count: number }>;
  topResellerSources?: Array<{ resellerName: string; hubName: string; amount: number; count: number }>;
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
  paymentStatus?: 'pending' | 'completed' | 'refunded' | 'failed';
  channel?: 'online' | 'box_office' | 'reseller_pos';
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
  channel?: 'online' | 'box_office' | 'reseller_pos';
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
