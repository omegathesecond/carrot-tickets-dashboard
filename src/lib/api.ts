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
} from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const APP_API_KEY = import.meta.env.VITE_APP_API_KEY || '';

class ApiClient {
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

export const apiClient = new ApiClient(API_BASE_URL);
