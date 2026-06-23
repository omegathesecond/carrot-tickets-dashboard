const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const TOKEN_KEY = 'carrot_reseller_token';
const OPERATOR_KEY = 'carrot_reseller_operator';

export interface ResellerOperator {
  id: string;
  fullName: string;
  role: string;
  resellerId: string;
  hubId: string;
}

export interface ResellerEvent {
  id: string;
  name: string;
  venue?: string;
  date?: string;
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
      return JSON.parse(raw) as ResellerOperator;
    } catch {
      // Corrupt/tampered value — clear it rather than crash the portal on boot.
      localStorage.removeItem(OPERATOR_KEY);
      return null;
    }
  },

  async getEvents(): Promise<ResellerEvent[]> {
    // Backend wraps events in a paginated envelope: { data: ResellerEvent[], pagination }.
    // The generic request() strips the outer ApiResponse.data, leaving that envelope —
    // so pull the array out here rather than handing the POS page a non-iterable object.
    const result = await request<{ data?: ResellerEvent[] } | ResellerEvent[]>('/reseller/events');
    return Array.isArray(result) ? result : result?.data ?? [];
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
  list: () => request<OperatorAdminRow[]>('/reseller/operators'),
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
