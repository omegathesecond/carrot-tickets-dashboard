const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const TOKEN_KEY = 'carrot_reseller_token';
const OPERATOR_KEY = 'carrot_reseller_operator';

/** Decode the `permissions` claim from the stored reseller JWT (its payload
 *  always carries them). Returns null if there is no token or it can't be read. */
function permissionsFromToken(): string[] | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json);
    return Array.isArray(payload?.permissions) ? payload.permissions : null;
  } catch {
    return null;
  }
}

export interface ResellerOperator {
  id: string;
  fullName: string;
  role: string;
  resellerId: string;
  hubId: string;
  permissions: string[];
}

export interface ResellerEvent {
  id: string;
  name: string;
  venue?: string;
  date?: string;
  thumbnailUrl?: string;
}

export interface ResellerTicketType {
  id: string;
  name: string;
  price: number;
  available: number;
}

export type ResellerPaymentMethods = {
  cash?: boolean;
  mtn_momo?: boolean;
  keshless_wallet?: boolean;
};

export interface CreateSalePayload {
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  paymentMethod: string;
  customerName?: string;
  customerPhone?: string;
  momoPhone?: string;
}

export type CreateSaleResponse = {
  saleId: string;
  status: 'completed' | 'pending';
  referenceId?: string;
  expiresAt?: string;
  tickets?: Array<{ ticketId: string }>;
  ticketIds?: string[];
};

export type FinalizeSaleResponse = {
  status: 'completed' | 'pending' | 'failed';
  saleId?: string;
  tickets?: Array<{ ticketId: string }>;
  ticketIds?: string[];
};

export interface ResellerSale {
  id: string;
  eventId: string;
  status: string;
  quantity: number;
  totalAmount: number;
  createdAt: string;
}

async function request<T>(endpoint: string, options: RequestInit = {}, authenticated = true): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authenticated) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: `HTTP ${response.status}: ${response.statusText}` }));
    throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  const responseJson = await response.json();
  return (responseJson.data || responseJson) as T;
}

export const resellerApi = {
  async login(payload: { loginCode: string; pin: string }): Promise<{ accessToken: string; operator: ResellerOperator }> {
    const result = await request<{ accessToken: string; operator: ResellerOperator }>(
      '/reseller/auth/login',
      { method: 'POST', body: JSON.stringify(payload) },
      false
    );
    localStorage.setItem(TOKEN_KEY, result.accessToken);
    localStorage.setItem(OPERATOR_KEY, JSON.stringify(result.operator));
    return result;
  },

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(OPERATOR_KEY);
  },

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  getOperator(): ResellerOperator | null {
    const raw = localStorage.getItem(OPERATOR_KEY);
    if (!raw) return null;
    try {
      const op = JSON.parse(raw) as ResellerOperator;
      // Sessions created before the API returned `permissions` on the operator
      // have a stale cached object without it, which would hide every
      // permission-gated nav item. The JWT always carries permissions, so
      // backfill from the token — keeping nav gating in sync with what the
      // backend actually enforces.
      if (!op.permissions || op.permissions.length === 0) {
        const fromToken = permissionsFromToken();
        if (fromToken) op.permissions = fromToken;
      }
      return op;
    } catch {
      // Corrupt/tampered value — clear it rather than crash the portal on boot.
      localStorage.removeItem(OPERATOR_KEY);
      return null;
    }
  },

  async getEvents(): Promise<ResellerEvent[]> {
    // Backend wraps events in a paginated envelope: { data: <raw event docs>, pagination }.
    // The generic request() strips the outer ApiResponse.data, leaving that envelope —
    // so pull the array out here rather than handing the POS page a non-iterable object.
    // Raw docs are lean Mongo documents (_id / eventDate), so normalize to the fields
    // the POS uses. Mapping _id -> id is critical: without a stable unique id every card
    // matches the (undefined) selected id and they all appear selected at once.
    const result = await request<{ data?: any[] } | any[]>('/reseller/events');
    const list = Array.isArray(result) ? result : result?.data ?? [];
    return list.map((ev: any) => ({
      id: ev.id ?? ev._id,
      name: ev.name,
      venue: ev.venue,
      date: ev.date ?? ev.eventDate,
      thumbnailUrl: ev.thumbnailUrl ?? ev.posterUrl,
    }));
  },

  async getEventTickets(eventId: string): Promise<ResellerTicketType[]> {
    // Backend returns { event, ticketTypes }, and exposes capacity as `remaining`.
    const result = await request<{ ticketTypes?: any[] } | ResellerTicketType[]>(
      `/reseller/events/${eventId}/tickets`
    );
    const list = Array.isArray(result) ? result : result?.ticketTypes ?? [];
    return list.map((tt: any) => ({
      id: tt.id,
      name: tt.name,
      price: tt.price,
      available: tt.available ?? tt.remaining ?? 0,
    }));
  },

  async getPaymentMethods(): Promise<ResellerPaymentMethods> {
    // Backend returns the enabled methods as a string[] under `methods`;
    // the POS expects a boolean map keyed by method id.
    const result = await request<{ methods?: string[] } | ResellerPaymentMethods>(
      '/reseller/payment-methods'
    );
    if (result && Array.isArray((result as { methods?: string[] }).methods)) {
      const methods = (result as { methods: string[] }).methods;
      return {
        cash: methods.includes('cash'),
        mtn_momo: methods.includes('mtn_momo'),
        keshless_wallet: methods.includes('keshless_wallet'),
      };
    }
    return (result ?? {}) as ResellerPaymentMethods;
  },

  async createSale(payload: CreateSalePayload): Promise<CreateSaleResponse> {
    return request<CreateSaleResponse>('/reseller/sales', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async finalizeSale(referenceId: string): Promise<FinalizeSaleResponse> {
    return request<FinalizeSaleResponse>(`/reseller/sales/${referenceId}/finalize`, {
      method: 'POST',
    });
  },

  async sendSaleSms(saleId: string): Promise<{ sent: boolean }> {
    return request<{ sent: boolean }>(`/reseller/sales/${saleId}/send-sms`, {
      method: 'POST',
    });
  },

  async getMySales(): Promise<ResellerSale[]> {
    return request<ResellerSale[]>('/reseller/sales');
  },
};

export interface OperatorAdminRow {
  _id: string;
  fullName: string;
  loginCode: string;
  role: string;
  hubId: string;
  isActive: boolean;
}
export type IssuedCredentials = { operator: OperatorAdminRow; loginCode: string; pin: string };

export const resellerOperatorsApi = {
  list: (hubId?: string) =>
    request<OperatorAdminRow[]>(`/reseller/operators${hubId ? `?hubId=${encodeURIComponent(hubId)}` : ''}`),
  create: (data: { fullName: string; role: string; hubId?: string; pin?: string }) =>
    request<IssuedCredentials>('/reseller/operators', { method: 'POST', body: JSON.stringify(data) }),
  resetPin: (id: string, pin?: string) =>
    request<{ operatorId: string; pin: string }>(`/reseller/operators/${id}/reset-pin`, {
      method: 'POST', body: JSON.stringify(pin ? { pin } : {}),
    }),
  setActive: (id: string, isActive: boolean) =>
    request<OperatorAdminRow>(`/reseller/operators/${id}`, {
      method: 'PATCH', body: JSON.stringify({ isActive }),
    }),
};

export interface HubRow {
  _id: string;
  name: string;
  resellerId: string;
  location?: { city?: string; region?: string };
  isActive: boolean;
}

export interface HubOperatorStat {
  operatorId: string; fullName: string; loginCode: string;
  salesCount: number; revenue: number; ticketsSold: number;
}

export interface HubAnalytics {
  hubId: string; revenue: number; ticketsSold: number; salesCount: number;
  operatorsCount: number; byOperator: HubOperatorStat[];
}

export const resellerHubsApi = {
  list: () => request<HubRow[]>('/reseller/hubs'),
  get: (hubId: string) => request<HubRow>(`/reseller/hubs/${hubId}`),
  analytics: (hubId: string, from?: string, to?: string) => {
    const qs = from && to ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : '';
    return request<HubAnalytics>(`/reseller/hubs/${hubId}/analytics${qs}`);
  },
};

// ---- Manager/admin reporting ----

export interface ManagerSale {
  id: string;
  saleId: string;
  eventName: string;
  operatorName: string;
  hubName: string;
  quantity: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  customerName: string;
  soldAt: string;
}

export interface Paginated<T> {
  data: T[];
  pagination: { total: number; page: number; limit: number; pages: number; hasNext: boolean; hasPrev: boolean };
}

export interface MethodStat { method: string; revenue: number; tickets: number; count: number }
export interface DayStat { date: string; revenue: number; tickets: number; count: number }
export interface OperatorStat { operatorId: string; fullName: string; revenue: number; tickets: number; count: number }
export interface ReportHubStat { hubId: string; name: string; revenue: number; tickets: number; count: number }

export interface ReportSummary {
  totals: { revenue: number; tickets: number; salesCount: number };
  byMethod: MethodStat[];
  byDay: DayStat[];
  byOperator: OperatorStat[];
  byHub: ReportHubStat[];
}

function toQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const resellerReportsApi = {
  managerSales: (params: {
    page?: number; limit?: number; from?: string; to?: string;
    hubId?: string; operatorId?: string; paymentMethod?: string;
  }) => request<Paginated<ManagerSale>>(`/reseller/manager/sales${toQuery(params)}`),

  summary: (params: { from?: string; to?: string; hubId?: string; eventId?: string }) =>
    request<ReportSummary>(`/reseller/reports/summary${toQuery(params)}`),
};

// ---- Commission payouts (admin only) ----

export interface ResellerWithdrawal {
  _id: string;
  amount: number;
  status: 'requested' | 'approved' | 'paid' | 'rejected';
  requestedAt: string;
  paidAt?: string;
  paymentReference?: string;
  createdAt: string;
}

export interface PayoutOverview {
  available: number;
  withdrawals: ResellerWithdrawal[];
}

export const resellerPayoutsApi = {
  overview: () => request<PayoutOverview>('/reseller/payouts'),
  request: () => request<ResellerWithdrawal>('/reseller/payouts', { method: 'POST' }),
};
