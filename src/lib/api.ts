import type {
  LoginCredentials,
  RegisterData,
  AuthResponse,
  AuthUser,
  Event,
  EventFormData,
  EventQueryParams,
  EventCreatorSummary,
  TicketSale,
  SellTicketsRequest,
  SalesQueryParams,
  ScanRecord,
  ScanStats,
  ValidateTicketRequest,
  CheckInRequest,
  ValidateTicketResponse,
  ScanQueryParams,
  DashboardStats,
  SalesStats,
  RevenueStats,
  EventAnalytics,
  StatsQueryParams,
  PaginatedResponse,
  PaymentMethodSettings,
  Reseller,
  ResellerHub,
  ResellerOperator,
  ResellerSettlementPreview,
  ResellerSettlement,
  OrganizerPayoutPreview,
  OrganizerPayout,
  HubAnalytics,
  UsersListResponse,
  UserAnalytics,
  Organizer,
  OrganizersListResponse,
  OrganizerVerificationStatus,
  CreateOrganizerData,
  VehicleType,
  VehicleTypeFormData,
  TransportRoute,
  RouteFormData,
  Trip,
  TripFormData,
  TripStatus,
  TripDetail,
  TransportBooking,
} from '@/types';
import type { WristbandDesignDoc } from '@/lib/wristband/design';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const APP_API_KEY = import.meta.env.VITE_APP_API_KEY || '';

export class ApiClient {
  private baseUrl: string;
  private token: string | null;
  private refreshToken: string | null;
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<any> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('keshless_tickets_token');
    this.refreshToken = localStorage.getItem('keshless_tickets_refresh_token');
  }

  private getToken(): string | null {
    const token = localStorage.getItem('keshless_tickets_token');
    this.token = token;
    return token;
  }

  private getRefreshToken(): string | null {
    const refreshToken = localStorage.getItem('keshless_tickets_refresh_token');
    this.refreshToken = refreshToken;
    return refreshToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    if (APP_API_KEY) {
      headers['x-api-key'] = APP_API_KEY;
    }

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log('[ApiClient] Request:', {
      method: options.method || 'GET',
      url,
      hasToken: !!token,
    });

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      console.log('[ApiClient] Response:', {
        status: response.status,
        ok: response.ok,
        url,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: 'An error occurred',
        }));

        const errorMessage = error.message || `HTTP ${response.status}: ${response.statusText}`;
        console.error('[ApiClient] Request failed:', {
          status: response.status,
          message: errorMessage,
          url,
        });

        // Handle token expiry with automatic refresh
        if (
          response.status === 401 &&
          (errorMessage.includes('Token has expired') || errorMessage.includes('expired')) &&
          !endpoint.includes('/tickets/auth/refresh') &&
          !endpoint.includes('/tickets/auth/login') &&
          this.getRefreshToken()
        ) {
          console.log('[ApiClient] Token expired, attempting refresh...');

          try {
            await this.handleTokenRefresh();
            console.log('[ApiClient] Retrying request with refreshed token...');
            return this.request<T>(endpoint, options);
          } catch (refreshError) {
            console.error('[ApiClient] Token refresh failed, redirecting to login');
            throw new Error('Session expired. Please log in again.');
          }
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('[ApiClient] Request successful:', { url });
      return data.data || data;
    } catch (error: any) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('[ApiClient] Network error:', {
          message: 'Failed to connect to server',
          url,
        });
        throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
      }
      throw error;
    }
  }

  setToken(token: string, refreshToken?: string) {
    console.log('[ApiClient] Setting new token', { hasRefreshToken: !!refreshToken });
    this.token = token;
    localStorage.setItem('keshless_tickets_token', token);

    if (refreshToken) {
      this.refreshToken = refreshToken;
      localStorage.setItem('keshless_tickets_refresh_token', refreshToken);
    }
  }

  clearToken() {
    console.log('[ApiClient] Clearing tokens');
    this.token = null;
    this.refreshToken = null;
    localStorage.removeItem('keshless_tickets_token');
    localStorage.removeItem('keshless_tickets_refresh_token');
  }

  private async handleTokenRefresh(): Promise<void> {
    if (this.isRefreshing && this.refreshPromise) {
      console.log('[ApiClient] Refresh already in progress, waiting...');
      await this.refreshPromise;
      return;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      console.error('[ApiClient] No refresh token available');
      throw new Error('No refresh token available');
    }

    this.isRefreshing = true;
    console.log('[ApiClient] Starting token refresh...');

    this.refreshPromise = (async () => {
      try {
        const url = `${this.baseUrl}/tickets/auth/refresh`;
        const refreshHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (APP_API_KEY) refreshHeaders['x-api-key'] = APP_API_KEY;
        const response = await fetch(url, {
          method: 'POST',
          headers: refreshHeaders,
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({
            message: 'Failed to refresh token',
          }));
          throw new Error(error.message || 'Token refresh failed');
        }

        const data = await response.json();
        const tokenData = data.data || data;

        console.log('[ApiClient] Token refresh successful');
        this.setToken(tokenData.accessToken, tokenData.refreshToken);

        this.isRefreshing = false;
        this.refreshPromise = null;
      } catch (error: any) {
        console.error('[ApiClient] Token refresh failed:', error.message);
        this.isRefreshing = false;
        this.refreshPromise = null;

        this.clearToken();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }

        throw error;
      }
    })();

    await this.refreshPromise;
  }

  // Auth endpoints
  auth = {
    login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
      const response = await this.request<AuthResponse>(
        `/tickets/auth/login`,
        {
          method: 'POST',
          body: JSON.stringify(credentials),
        }
      );
      this.setToken(response.accessToken, response.refreshToken);
      return response;
    },

    register: async (data: RegisterData): Promise<AuthResponse> => {
      const response = await this.request<AuthResponse>(
        `/tickets/auth/register`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );
      this.setToken(response.accessToken, response.refreshToken);
      return response;
    },

    /** Mint a one-time handoff to sign into the brand social site seamlessly. */
    socialHandoff: async (): Promise<{ handoff: string }> => {
      return this.request<{ handoff: string }>(`/tickets/auth/handoff`, { method: 'POST' });
    },

    logout: async (): Promise<void> => {
      const refreshToken = this.getRefreshToken();
      await this.request(`/tickets/auth/logout`, {
        method: 'POST',
        body: refreshToken ? JSON.stringify({ refreshToken }) : undefined,
      });
      this.clearToken();
    },

    getMe: async (): Promise<AuthUser> => {
      return this.request<AuthUser>(`/tickets/auth/me`);
    },
  };

  // Events endpoints
  events = {
    getEvents: async (params?: EventQueryParams): Promise<PaginatedResponse<Event>> => {
      const query = new URLSearchParams();
      if (params?.page) query.append('page', params.page.toString());
      if (params?.limit) query.append('limit', params.limit.toString());
      if (params?.status) query.append('status', params.status);
      if (params?.search) query.append('search', params.search);

      return this.request<PaginatedResponse<Event>>(
        `/tickets/events?${query.toString()}`
      );
    },

    getEvent: async (id: string): Promise<Event> => {
      return this.request<Event>(`/tickets/events/${id}`);
    },

    // Creator (organizer) of the event + a roll-up of all their events.
    getEventCreator: async (id: string): Promise<EventCreatorSummary> => {
      return this.request<EventCreatorSummary>(`/tickets/events/${id}/creator`);
    },

    createEvent: async (data: EventFormData): Promise<Event> => {
      return this.request<Event>(`/tickets/events`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    updateEvent: async (id: string, data: Partial<EventFormData>): Promise<Event> => {
      return this.request<Event>(`/tickets/events/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    deleteEvent: async (id: string): Promise<void> => {
      return this.request<void>(`/tickets/events/${id}`, {
        method: 'DELETE',
      });
    },

    publishEvent: async (id: string): Promise<Event> => {
      return this.request<Event>(`/tickets/events/${id}/publish`, {
        method: 'PUT',
      });
    },

    unpublishEvent: async (id: string): Promise<Event> => {
      return this.request<Event>(`/tickets/events/${id}/unpublish`, {
        method: 'PUT',
      });
    },

    // Ticket type management
    addTicketType: async (
      eventId: string,
      ticketType: {
        name: string;
        description?: string;
        price: number;
        quantity: number;
      }
    ): Promise<Event> => {
      return this.request<Event>(`/tickets/events/${eventId}/tickets`, {
        method: 'POST',
        body: JSON.stringify(ticketType),
      });
    },

    updateTicketType: async (
      eventId: string,
      ticketTypeName: string,
      updates: {
        name?: string;
        description?: string;
        price?: number;
        quantity?: number;
      }
    ): Promise<Event> => {
      return this.request<Event>(
        `/tickets/events/${eventId}/tickets/${encodeURIComponent(ticketTypeName)}`,
        {
          method: 'PUT',
          body: JSON.stringify(updates),
        }
      );
    },

    deleteTicketType: async (eventId: string, ticketTypeName: string): Promise<Event> => {
      return this.request<Event>(
        `/tickets/events/${eventId}/tickets/${encodeURIComponent(ticketTypeName)}`,
        {
          method: 'DELETE',
        }
      );
    },

    adjustTicketQuantity: async (
      eventId: string,
      ticketTypeName: string,
      adjustment: number
    ): Promise<Event> => {
      return this.request<Event>(
        `/tickets/events/${eventId}/tickets/${encodeURIComponent(ticketTypeName)}/adjust`,
        {
          method: 'PATCH',
          body: JSON.stringify({ adjustment }),
        }
      );
    },

    markTicketSoldOut: async (
      eventId: string,
      ticketTypeName: string,
      isSoldOut: boolean
    ): Promise<Event> => {
      return this.request<Event>(
        `/tickets/events/${eventId}/tickets/${encodeURIComponent(ticketTypeName)}/sold-out`,
        {
          method: 'PATCH',
          body: JSON.stringify({ isSoldOut }),
        }
      );
    },

    // Media upload methods
    uploadPoster: async (eventId: string, file: File): Promise<Event> => {
      const formData = new FormData();
      formData.append('poster', file);

      const token = this.getToken();
      const uploadHeaders: Record<string, string> = {};
      if (token) uploadHeaders['Authorization'] = `Bearer ${token}`;
      if (APP_API_KEY) uploadHeaders['x-api-key'] = APP_API_KEY;
      const response = await fetch(`${this.baseUrl}/media/events/${eventId}/poster`, {
        method: 'POST',
        headers: uploadHeaders,
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(error.message || 'Failed to upload poster');
      }

      const data = await response.json();
      return data.data;
    },

    uploadThumbnail: async (eventId: string, file: File): Promise<Event> => {
      const formData = new FormData();
      formData.append('thumbnail', file);

      const token = this.getToken();
      const uploadHeaders: Record<string, string> = {};
      if (token) uploadHeaders['Authorization'] = `Bearer ${token}`;
      if (APP_API_KEY) uploadHeaders['x-api-key'] = APP_API_KEY;
      const response = await fetch(`${this.baseUrl}/media/events/${eventId}/thumbnail`, {
        method: 'POST',
        headers: uploadHeaders,
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(error.message || 'Failed to upload thumbnail');
      }

      const data = await response.json();
      return data.data;
    },

    uploadGalleryImages: async (eventId: string, files: File[]): Promise<Event> => {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('gallery', file);
      });

      const token = this.getToken();
      const uploadHeaders: Record<string, string> = {};
      if (token) uploadHeaders['Authorization'] = `Bearer ${token}`;
      if (APP_API_KEY) uploadHeaders['x-api-key'] = APP_API_KEY;
      const response = await fetch(`${this.baseUrl}/media/events/${eventId}/gallery`, {
        method: 'POST',
        headers: uploadHeaders,
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(error.message || 'Failed to upload gallery images');
      }

      const data = await response.json();
      return data.data;
    },

    uploadQRCode: async (eventId: string, file: File): Promise<Event> => {
      const formData = new FormData();
      formData.append('qrcode', file);

      const token = this.getToken();
      const uploadHeaders: Record<string, string> = {};
      if (token) uploadHeaders['Authorization'] = `Bearer ${token}`;
      if (APP_API_KEY) uploadHeaders['x-api-key'] = APP_API_KEY;
      const response = await fetch(`${this.baseUrl}/media/events/${eventId}/qrcode`, {
        method: 'POST',
        headers: uploadHeaders,
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(error.message || 'Failed to upload QR code');
      }

      const data = await response.json();
      return data.data;
    },

    deleteMedia: async (
      eventId: string,
      url: string,
      mediaType: 'poster' | 'thumbnail' | 'gallery' | 'qrcode'
    ): Promise<Event> => {
      return this.request<Event>(`/media/events/${eventId}`, {
        method: 'DELETE',
        body: JSON.stringify({ url, mediaType }),
      });
    },

    listEventMedia: async (eventId: string): Promise<{
      poster: string | null;
      thumbnail: string | null;
      gallery: string[];
      qrcode: string | null;
    }> => {
      const response = await this.request<{
        eventId: string;
        media: {
          poster: string | null;
          thumbnail: string | null;
          gallery: string[];
          qrcode: string | null;
        };
      }>(`/media/events/${eventId}/list`);
      return response.media;
    },
  };

  // Sales endpoints
  sales = {
    sellTickets: async (data: SellTicketsRequest): Promise<TicketSale> => {
      return this.request<TicketSale>(`/tickets/sales/sell`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    getSales: async (params?: SalesQueryParams): Promise<PaginatedResponse<TicketSale>> => {
      const query = new URLSearchParams();
      if (params?.page) query.append('page', params.page.toString());
      if (params?.limit) query.append('limit', params.limit.toString());
      if (params?.eventId) query.append('eventId', params.eventId);
      if (params?.paymentMethod) query.append('paymentMethod', params.paymentMethod);
      if (params?.paymentStatus) query.append('paymentStatus', params.paymentStatus);
      if (params?.startDate) query.append('startDate', params.startDate);
      if (params?.endDate) query.append('endDate', params.endDate);
      if (params?.search) query.append('search', params.search);

      return this.request<PaginatedResponse<TicketSale>>(
        `/tickets/sales?${query.toString()}`
      );
    },

    getSale: async (id: string): Promise<TicketSale> => {
      return this.request<TicketSale>(`/tickets/sales/${id}`);
    },

    refundTicket: async (ticketId: string, reason: string): Promise<TicketSale> => {
      return this.request<TicketSale>(`/tickets/sales/${ticketId}/refund`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    },
  };

  // Scans endpoints
  scans = {
    validateTicket: async (data: ValidateTicketRequest): Promise<ValidateTicketResponse> => {
      return this.request<ValidateTicketResponse>(`/tickets/scans/validate`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    checkIn: async (data: CheckInRequest): Promise<ScanRecord> => {
      return this.request<ScanRecord>(`/tickets/scans/check-in`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    getScans: async (params?: ScanQueryParams): Promise<PaginatedResponse<ScanRecord>> => {
      const query = new URLSearchParams();
      if (params?.page) query.append('page', params.page.toString());
      if (params?.limit) query.append('limit', params.limit.toString());
      if (params?.eventId) query.append('eventId', params.eventId);
      if (params?.status) query.append('status', params.status);
      if (params?.startDate) query.append('startDate', params.startDate);
      if (params?.endDate) query.append('endDate', params.endDate);

      return this.request<PaginatedResponse<ScanRecord>>(
        `/tickets/scans?${query.toString()}`
      );
    },

    getScanStats: async (params?: StatsQueryParams): Promise<ScanStats> => {
      const query = new URLSearchParams();
      if (params?.startDate) query.append('startDate', params.startDate);
      if (params?.endDate) query.append('endDate', params.endDate);
      if (params?.eventId) query.append('eventId', params.eventId);

      return this.request<ScanStats>(
        `/tickets/scans/stats?${query.toString()}`
      );
    },
  };

  // Analytics endpoints
  analytics = {
    getDashboardStats: async (params?: StatsQueryParams): Promise<DashboardStats> => {
      const query = new URLSearchParams();
      if (params?.startDate) query.append('startDate', params.startDate);
      if (params?.endDate) query.append('endDate', params.endDate);
      if (params?.eventId) query.append('eventId', params.eventId);

      return this.request<DashboardStats>(
        `/tickets/stats/dashboard?${query.toString()}`
      );
    },

    getSalesStats: async (params?: StatsQueryParams): Promise<SalesStats> => {
      const query = new URLSearchParams();
      if (params?.startDate) query.append('startDate', params.startDate);
      if (params?.endDate) query.append('endDate', params.endDate);
      if (params?.eventId) query.append('eventId', params.eventId);

      return this.request<SalesStats>(
        `/tickets/stats/sales?${query.toString()}`
      );
    },

    getRevenueStats: async (params?: StatsQueryParams): Promise<RevenueStats> => {
      const query = new URLSearchParams();
      if (params?.startDate) query.append('startDate', params.startDate);
      if (params?.endDate) query.append('endDate', params.endDate);
      if (params?.eventId) query.append('eventId', params.eventId);
      if (params?.channel) query.append('channel', params.channel);

      return this.request<RevenueStats>(
        `/tickets/stats/revenue?${query.toString()}`
      );
    },

    getEventAnalytics: async (eventId: string, params?: StatsQueryParams): Promise<EventAnalytics> => {
      const query = new URLSearchParams();
      if (params?.startDate) query.append('startDate', params.startDate);
      if (params?.endDate) query.append('endDate', params.endDate);

      return this.request<EventAnalytics>(
        `/tickets/stats/events/${eventId}?${query.toString()}`
      );
    },
  };

  // Platform Users endpoints (super-admin or tickets:view_users)
  users = {
    list: async (params?: { search?: string; page?: number; limit?: number }): Promise<UsersListResponse> => {
      const query = new URLSearchParams();
      if (params?.search) query.append('search', params.search);
      if (params?.page) query.append('page', String(params.page));
      if (params?.limit) query.append('limit', String(params.limit));
      return this.request<UsersListResponse>(`/tickets/admin/users?${query.toString()}`);
    },

    analytics: async (): Promise<UserAnalytics> =>
      this.request<UserAnalytics>(`/tickets/admin/users/analytics`),
  };

  // Organizers admin endpoints (super-admin only)
  organizers = {
    list: async (params?: { search?: string; status?: string; operatorType?: string; page?: number; limit?: number }): Promise<OrganizersListResponse> => {
      const query = new URLSearchParams();
      if (params?.search) query.append('search', params.search);
      if (params?.status) query.append('status', params.status);
      if (params?.operatorType) query.append('operatorType', params.operatorType);
      if (params?.page) query.append('page', String(params.page));
      if (params?.limit) query.append('limit', String(params.limit));
      return this.request<OrganizersListResponse>(`/tickets/admin/organizers?${query.toString()}`);
    },

    updateVerification: async (
      id: string,
      data: { status: OrganizerVerificationStatus; rejectionReason?: string },
    ): Promise<Pick<Organizer, 'id' | 'verificationStatus' | 'verifiedAt' | 'rejectionReason'>> =>
      this.request(`/tickets/admin/organizers/${id}/verification`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    create: async (data: CreateOrganizerData): Promise<{ id: string; businessName: string; operatorType: string }> =>
      this.request(`/tickets/admin/organizers`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  // Settings endpoints (super-admin only)
  settings = {
    getPaymentMethods: async (): Promise<PaymentMethodSettings> =>
      this.request<PaymentMethodSettings>(`/tickets/settings/payment-methods`),

    updatePaymentMethods: async (data: PaymentMethodSettings): Promise<PaymentMethodSettings> =>
      this.request<PaymentMethodSettings>(`/tickets/settings/payment-methods`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  };

  // Reseller admin endpoints (super-admin only)
  resellerAdmin = {
    listResellers: async (): Promise<Reseller[]> =>
      this.request<Reseller[]>(`/admin/resellers`),

    createReseller: async (data: {
      businessName: string;
      email?: string;
      phoneNumber?: string;
      commissionPercent?: number | null;
    }): Promise<Reseller> =>
      this.request<Reseller>(`/admin/resellers`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getReseller: async (id: string): Promise<Reseller> =>
      this.request<Reseller>(`/admin/resellers/${id}`),

    updateReseller: async (
      id: string,
      patch: {
        commissionPercent?: number | null;
        status?: 'active' | 'suspended';
        businessName?: string;
        email?: string;
        phoneNumber?: string;
        isActive?: boolean;
      }
    ): Promise<Reseller> =>
      this.request<Reseller>(`/admin/resellers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),

    listHubs: async (resellerId: string): Promise<ResellerHub[]> =>
      this.request<ResellerHub[]>(`/admin/resellers/${resellerId}/hubs`),

    createHub: async (
      resellerId: string,
      data: { name: string; location?: { city?: string; region?: string } }
    ): Promise<ResellerHub> =>
      this.request<ResellerHub>(`/admin/resellers/${resellerId}/hubs`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getHub: async (hubId: string): Promise<ResellerHub> =>
      this.request<ResellerHub>(`/admin/hubs/${hubId}`),

    getHubAnalytics: async (hubId: string, from?: string, to?: string): Promise<HubAnalytics> => {
      const qs = from && to ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : '';
      return this.request<HubAnalytics>(`/admin/hubs/${hubId}/analytics${qs}`);
    },

    listOperators: async (hubId: string): Promise<ResellerOperator[]> =>
      this.request<ResellerOperator[]>(`/admin/hubs/${hubId}/operators`),

    createOperator: async (
      hubId: string,
      data: { fullName: string; phoneNumber?: string; email?: string; role: string; pin?: string }
    ): Promise<{ operator: { _id: string; fullName: string; loginCode: string; role: string }; loginCode: string; pin: string }> =>
      this.request(`/admin/hubs/${hubId}/operators`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    resetOperatorPin: async (operatorId: string, pin?: string): Promise<{ operatorId: string; pin: string }> =>
      this.request(`/admin/operators/${operatorId}/reset-pin`, {
        method: 'POST',
        body: JSON.stringify(pin ? { pin } : {}),
      }),

    getResellerSettlement: async (
      resellerId: string,
      from: string,
      to: string
    ): Promise<ResellerSettlementPreview> => {
      const query = new URLSearchParams({ from, to });
      return this.request<ResellerSettlementPreview>(
        `/admin/resellers/${resellerId}/settlement?${query.toString()}`
      );
    },

    closeResellerSettlement: async (
      resellerId: string,
      from: string,
      to: string
    ): Promise<ResellerSettlement> =>
      this.request<ResellerSettlement>(
        `/admin/resellers/${resellerId}/settlement/close`,
        {
          method: 'POST',
          body: JSON.stringify({ from, to }),
        }
      ),

    markResellerSettlementPaid: async (
      resellerId: string,
      settlementId: string,
      paymentReference?: string
    ): Promise<ResellerSettlement> =>
      this.request<ResellerSettlement>(
        `/admin/resellers/${resellerId}/settlement/${settlementId}/mark-paid`,
        {
          method: 'POST',
          body: JSON.stringify(paymentReference ? { paymentReference } : {}),
        }
      ),

    getVendorPayout: async (
      vendorId: string,
      from: string,
      to: string
    ): Promise<OrganizerPayoutPreview> => {
      const query = new URLSearchParams({ from, to });
      return this.request<OrganizerPayoutPreview>(
        `/admin/vendors/${vendorId}/payout?${query.toString()}`
      );
    },

    closeVendorPayout: async (
      vendorId: string,
      from: string,
      to: string
    ): Promise<OrganizerPayout> =>
      this.request<OrganizerPayout>(`/admin/vendors/${vendorId}/payout/close`, {
        method: 'POST',
        body: JSON.stringify({ from, to }),
      }),

    markVendorPayoutPaid: async (
      vendorId: string,
      payoutId: string,
      paymentReference?: string
    ): Promise<OrganizerPayout> =>
      this.request<OrganizerPayout>(
        `/admin/vendors/${vendorId}/payout/${payoutId}/mark-paid`,
        {
          method: 'POST',
          body: JSON.stringify(paymentReference ? { paymentReference } : {}),
        }
      ),

    // ── Reseller commission withdrawals ──
    listWithdrawals: async (resellerId: string): Promise<ResellerWithdrawal[]> =>
      this.request<ResellerWithdrawal[]>(`/admin/resellers/${resellerId}/withdrawals`),

    approveWithdrawal: async (id: string): Promise<ResellerWithdrawal> =>
      this.request<ResellerWithdrawal>(`/admin/withdrawals/${id}/approve`, { method: 'POST' }),

    markWithdrawalPaid: async (id: string, paymentReference?: string): Promise<ResellerWithdrawal> =>
      this.request<ResellerWithdrawal>(`/admin/withdrawals/${id}/mark-paid`, {
        method: 'POST',
        body: JSON.stringify(paymentReference ? { paymentReference } : {}),
      }),

    rejectWithdrawal: async (id: string, notes?: string): Promise<ResellerWithdrawal> =>
      this.request<ResellerWithdrawal>(`/admin/withdrawals/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify(notes ? { notes } : {}),
      }),
  };

  // Gate Operators endpoints
  gateOperators = {
    list: async (): Promise<GateOperatorRow[]> =>
      this.request<GateOperatorRow[]>(`/tickets/gate-operators`),

    create: async (data: {
      fullName: string;
      phoneNumber?: string;
      scope?: 'platform' | 'organizer';
      vendorId?: string;
    }): Promise<IssuedGateCredentials> =>
      this.request<IssuedGateCredentials>(`/tickets/gate-operators`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    resetPin: async (id: string, pin?: string): Promise<{ operatorId: string; pin: string }> =>
      this.request<{ operatorId: string; pin: string }>(`/tickets/gate-operators/${id}/reset-pin`, {
        method: 'POST',
        body: JSON.stringify(pin ? { pin } : {}),
      }),

    setActive: async (id: string, isActive: boolean): Promise<GateOperatorRow> =>
      this.request<GateOperatorRow>(`/tickets/gate-operators/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }),
  };

  // Wristband design + batch-issue endpoints
  wristbands = {
    listDesigns: async (eventId: string): Promise<WristbandDesignDoc[]> =>
      this.request<WristbandDesignDoc[]>(`/tickets/wristband-designs?eventId=${eventId}`),

    createDesign: async (d: Omit<WristbandDesignDoc, '_id'>): Promise<WristbandDesignDoc> =>
      this.request<WristbandDesignDoc>(`/tickets/wristband-designs`, {
        method: 'POST',
        body: JSON.stringify(d),
      }),

    updateDesign: async (id: string, patch: Partial<WristbandDesignDoc>): Promise<WristbandDesignDoc> =>
      this.request<WristbandDesignDoc>(`/tickets/wristband-designs/${id}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      }),

    deleteDesign: async (id: string): Promise<void> =>
      this.request<void>(`/tickets/wristband-designs/${id}`, { method: 'DELETE' }),

    batchIssue: async (d: {
      eventId: string;
      ticketTypeId: string;
      quantity: number;
    }): Promise<{ tickets: { ticketId: string; ticketType: string }[] }> =>
      this.request<{ tickets: { ticketId: string; ticketType: string }[] }>(
        `/tickets/wristbands/batch-issue`,
        { method: 'POST', body: JSON.stringify(d) }
      ),

    listBatches: async (eventId: string): Promise<WristbandBatch[]> =>
      this.request<WristbandBatch[]>(`/tickets/wristbands/batches?eventId=${eventId}`),

    searchTickets: async (eventId: string, search = ''): Promise<PickerTicket[]> => {
      const query = new URLSearchParams({ eventId, ...(search ? { search } : {}) });
      return this.request<PickerTicket[]>(`/tickets/wristbands/tickets?${query.toString()}`);
    },

    // Bypasses this.request (multipart body) — mirrors events.uploadPoster's fetch/header/envelope pattern.
    uploadArtwork: async (eventId: string, file: File): Promise<{ url: string }> => {
      const formData = new FormData();
      formData.append('artwork', file);

      const token = this.getToken();
      const uploadHeaders: Record<string, string> = {};
      if (token) uploadHeaders['Authorization'] = `Bearer ${token}`;
      if (APP_API_KEY) uploadHeaders['x-api-key'] = APP_API_KEY;
      const response = await fetch(`${this.baseUrl}/media/events/${eventId}/wristband`, {
        method: 'POST',
        headers: uploadHeaders,
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(error.message || 'Failed to upload wristband artwork');
      }

      const data = await response.json();
      return data.data;
    },
  };

  // Community management endpoints (organizer/admin) — channels, announcements,
  // member moderation, and message pins. Mirrors the api's
  // channelAdmin/announcement/moderation controllers 1:1
  // (api/src/controllers/{channelAdmin,announcement,moderation}.controller.ts).
  // All require the vendor JWT + tickets:edit_event permission.
  community = {
    listChannels: async (eventId: string): Promise<ChannelAdminListView> =>
      this.request<ChannelAdminListView>(`/tickets/events/${eventId}/channels`),

    createChannel: async (
      eventId: string,
      data: { name: string; gated?: boolean; postPolicy?: ChannelPostPolicy }
    ): Promise<ChannelAdminView> =>
      this.request<ChannelAdminView>(`/tickets/events/${eventId}/channels`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateChannel: async (
      channelId: string,
      patch: { name?: string; gated?: boolean; postPolicy?: ChannelPostPolicy; archived?: boolean }
    ): Promise<ChannelAdminView> =>
      this.request<ChannelAdminView>(`/tickets/channels/${channelId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),

    // API field is `body` (community.validator.ts announcementSchema), not `text`.
    postAnnouncement: async (eventId: string, body: string): Promise<void> => {
      await this.request<void>(`/tickets/events/${eventId}/announcements`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
    },

    listMembers: async (
      communityId: string,
      params?: { before?: string; limit?: number }
    ): Promise<AdminMemberView[]> => {
      const query = new URLSearchParams();
      if (params?.before) query.append('before', params.before);
      if (params?.limit) query.append('limit', String(params.limit));
      const qs = query.toString();
      return this.request<AdminMemberView[]>(
        `/tickets/communities/${communityId}/members${qs ? `?${qs}` : ''}`
      );
    },

    muteMember: async (
      communityId: string,
      buyerId: string,
      minutes: number
    ): Promise<{ mutedUntil: string }> =>
      this.request(`/tickets/communities/${communityId}/members/${buyerId}/mute`, {
        method: 'POST',
        body: JSON.stringify({ minutes }),
      }),

    unmuteMember: async (communityId: string, buyerId: string): Promise<{ mutedUntil: null }> =>
      this.request(`/tickets/communities/${communityId}/members/${buyerId}/mute`, {
        method: 'DELETE',
      }),

    banMember: async (communityId: string, buyerId: string): Promise<{ banned: true }> =>
      this.request(`/tickets/communities/${communityId}/members/${buyerId}/ban`, {
        method: 'POST',
      }),

    unbanMember: async (communityId: string, buyerId: string): Promise<{ banned: false }> =>
      this.request(`/tickets/communities/${communityId}/members/${buyerId}/ban`, {
        method: 'DELETE',
      }),

    // Not surfaced in this task's UI (message panel deferred — see
    // task-6-report.md), but wired up for completeness so Task 8's message
    // views can call straight into these.
    pinMessage: async (messageId: string): Promise<{ pinned: true }> =>
      this.request(`/tickets/messages/${messageId}/pin`, { method: 'POST' }),

    unpinMessage: async (messageId: string): Promise<{ pinned: false }> =>
      this.request(`/tickets/messages/${messageId}/pin`, { method: 'DELETE' }),

    deleteMessage: async (messageId: string): Promise<{ deleted: true }> =>
      this.request(`/tickets/messages/${messageId}`, { method: 'DELETE' }),
  };

  // Platform social moderation queue (buyer-filed reports against messages/
  // buyers) — mirrors the api's ReportController/ReportService 1:1
  // (api/src/controllers/report.controller.ts, api/src/services/report.service.ts).
  // Requires the vendor JWT + requireSuperAdminOrPermission(tickets:moderate_social).
  reports = {
    list: async (params?: {
      status?: ReportStatus;
      before?: string;
      limit?: number;
    }): Promise<ReportAdminView[]> => {
      const query = new URLSearchParams();
      if (params?.status) query.append('status', params.status);
      if (params?.before) query.append('before', params.before);
      if (params?.limit) query.append('limit', String(params.limit));
      const qs = query.toString();
      return this.request<ReportAdminView[]>(`/tickets/reports${qs ? `?${qs}` : ''}`);
    },

    resolve: async (
      reportId: string,
      body: { action: ReportResolveAction; note?: string }
    ): Promise<ReportAdminView> =>
      this.request<ReportAdminView>(`/tickets/reports/${reportId}/resolve`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  };

  // Organizer "update" composer (short video/image posts into the public
  // Discover feed). Mirrors the api's updates controller 1:1
  // (api/src/controllers/updates.controller.ts). init/finalize require the
  // vendor JWT; getPublic is the same read buyers use to poll transcode
  // status, reused here so the composer can poll without a separate route.
  updates = {
    // Requests a presigned R2 upload slot for the media file.
    init: async (data: {
      kind: 'video' | 'image';
      caption: string;
      eventId?: string;
      ext: string;
      contentType: string;
    }): Promise<{ updateId: string; uploadUrl: string }> =>
      this.request<{ updateId: string; uploadUrl: string }>('/tickets/updates', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Uploads the raw file bytes straight to the presigned R2 URL. This is a
    // BARE fetch — no Authorization/x-api-key headers, those would break the
    // signed URL — so it deliberately does not go through this.request().
    uploadToR2: async (uploadUrl: string, file: File): Promise<void> => {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!response.ok) {
        throw new Error(`Failed to upload media (HTTP ${response.status})`);
      }
    },

    // Tells the api the R2 upload is complete. Images come back ready
    // immediately; videos come back with media.status === 'processing' while
    // the transcoder runs, and the caller polls getPublic until it settles.
    finalize: async (updateId: string): Promise<{ media: { status: string; error?: string } }> =>
      this.request<{ media: { status: string; error?: string } }>(
        `/tickets/updates/${updateId}/finalize`,
        { method: 'POST' }
      ),

    // Public read (same endpoint buyers use) — polled after finalize for
    // videos until media.status is 'ready' or 'failed'.
    getPublic: async (updateId: string): Promise<{ media: { status: string; error?: string } }> =>
      this.request<{ media: { status: string; error?: string } }>(`/public/updates/${updateId}`),
  };

  // Transport (bus) endpoints — mirrors the events group's style. List
  // endpoints return a bare array (controllers call ApiResponseUtil.success
  // with an array, not a paginated envelope), so this.request<T[]>(...)
  // resolves to the array directly after the `.data` unwrap.
  transport = {
    listVehicleTypes: async (): Promise<VehicleType[]> =>
      this.request<VehicleType[]>(`/tickets/transport/vehicle-types`),

    createVehicleType: async (data: VehicleTypeFormData): Promise<VehicleType> =>
      this.request<VehicleType>(`/tickets/transport/vehicle-types`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateVehicleType: async (
      id: string,
      data: Partial<VehicleTypeFormData>
    ): Promise<VehicleType> =>
      this.request<VehicleType>(`/tickets/transport/vehicle-types/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deleteVehicleType: async (id: string): Promise<void> =>
      this.request<void>(`/tickets/transport/vehicle-types/${id}`, {
        method: 'DELETE',
      }),

    listRoutes: async (): Promise<TransportRoute[]> =>
      this.request<TransportRoute[]>(`/tickets/transport/routes`),

    createRoute: async (data: RouteFormData): Promise<TransportRoute> =>
      this.request<TransportRoute>(`/tickets/transport/routes`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateRoute: async (id: string, data: Partial<RouteFormData>): Promise<TransportRoute> =>
      this.request<TransportRoute>(`/tickets/transport/routes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deleteRoute: async (id: string): Promise<void> =>
      this.request<void>(`/tickets/transport/routes/${id}`, {
        method: 'DELETE',
      }),

    listTrips: async (routeId?: string): Promise<Trip[]> =>
      this.request<Trip[]>(
        `/tickets/transport/trips${routeId ? `?routeId=${routeId}` : ''}`
      ),

    getTrip: async (id: string): Promise<TripDetail> =>
      this.request<TripDetail>(`/tickets/transport/trips/${id}`),

    createTrip: async (data: TripFormData): Promise<Trip> =>
      this.request<Trip>(`/tickets/transport/trips`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateTripStatus: async (id: string, status: TripStatus): Promise<Trip> =>
      this.request<Trip>(`/tickets/transport/trips/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),

    setReservedCount: async (id: string, reservedCount: number): Promise<Trip> =>
      this.request<Trip>(`/tickets/transport/trips/${id}/reserved-count`, {
        method: 'PATCH',
        body: JSON.stringify({ reservedCount }),
      }),

    listBookings: async (): Promise<TransportBooking[]> =>
      this.request<TransportBooking[]>(`/tickets/transport/bookings`),
  };

  // Export endpoints
  exports = {
    exportSalesCSV: async (params?: SalesQueryParams): Promise<void> => {
      const query = new URLSearchParams();
      if (params?.eventId) query.append('eventId', params.eventId);
      if (params?.paymentMethod) query.append('paymentMethod', params.paymentMethod);
      if (params?.startDate) query.append('startDate', params.startDate);
      if (params?.endDate) query.append('endDate', params.endDate);

      const url = `${this.baseUrl}/tickets/export/sales?${query.toString()}`;
      const headers: Record<string, string> = {};
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
      if (APP_API_KEY) {
        headers['x-api-key'] = APP_API_KEY;
      }

      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error('Failed to export sales');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `sales-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    },
  };
}

export interface ResellerWithdrawal {
  _id: string;
  resellerId: string;
  amount: number;
  status: 'requested' | 'approved' | 'paid' | 'rejected';
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  paidAt?: string;
  paymentReference?: string;
  notes?: string;
  createdAt: string;
}

export interface GateOperatorRow {
  _id: string;
  fullName: string;
  phoneNumber?: string;
  scope: 'platform' | 'organizer';
  vendorId?: string | null;
  isActive: boolean;
  loginCode: string;
  createdAt: string;
}

export interface IssuedGateCredentials {
  operator: GateOperatorRow;
  loginCode: string;
  pin: string;
}

export interface WristbandBatch {
  _id: string;
  saleId: string;
  quantity: number;
  soldAt: string;
  ticketType: string;
  tickets: { ticketId: string; status: string }[];
}

export interface PickerTicket {
  ticketId: string;
  ticketType: string;
  customerName?: string;
  customerPhone?: string;
  status: string;
}

// ── Community management types ──
// Mirror api/src/services/channelAdmin.service.ts and
// api/src/services/moderation.service.ts view shapes exactly.

export type ChannelPostPolicy = 'all' | 'organizer';

export interface ChannelAdminView {
  id: string;
  name: string;
  slug: string;
  gated: boolean;
  postPolicy: ChannelPostPolicy;
  archived: boolean;
  isDefault: boolean;
  createdAt: string;
}

export interface ChannelAdminListView {
  communityId: string;
  channels: ChannelAdminView[];
}

export interface AdminMemberView {
  id: string;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  role: 'member' | 'moderator' | 'organizer';
  ticketVerified: boolean;
  mutedUntil: string | null;
  bannedAt: string | null;
  joinedAt: string;
  cursor: string;
}

// ── Platform report queue types ──
// Mirror api/src/services/report.service.ts's ReportAdminView/
// ReportAdminMessageView shapes exactly (toAdminView), and
// api/src/utils/buyerSummary.util.ts's BuyerSummary. Pagination has no
// separate `cursor` field like AdminMemberView — the `before` cursor for the
// next page is a report's own `id` (the service sorts/paginates by `_id`).

export type ReportTargetType = 'message' | 'buyer';
export type ReportStatus = 'open' | 'resolved' | 'dismissed';
export type ReportResolveAction = 'delete_message' | 'suspend_buyer' | 'unsuspend_buyer' | 'dismiss';

export interface ReportBuyerSummary {
  id: string;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
}

// Admin-only message context — the body is UNMASKED even when the message
// was already soft-deleted (admins need it as evidence). Never reuse this
// shape for a buyer-facing read.
export interface ReportAdminMessageView {
  id: string;
  channelId: string;
  body: string;
  deleted: boolean;
  senderId: string | null;
  createdAt: string;
  channelName: string | null;
  communityId: string | null;
  eventId: string | null;
  eventName: string | null;
}

export interface ReportAdminView {
  id: string;
  targetType: ReportTargetType;
  reason: string;
  status: ReportStatus;
  reporter: ReportBuyerSummary;
  message: ReportAdminMessageView | null;
  targetBuyer: ReportBuyerSummary | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

export const apiClient = new ApiClient(API_BASE_URL);
