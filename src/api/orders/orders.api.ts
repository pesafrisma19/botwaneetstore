import { apiRequest, ApiResponse } from '../client';

export interface ApiOrderResult {
  isIdempotentReplay?: boolean;
  refId: string;
  invoiceId: string;
  productId?: number;
  sku?: string;
  name?: string;
  targetAccount: string;
  targetZone: string | null;
  price?: number;
  feeAmount?: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  qrString?: string | null;
  qrImageUrl?: string | null;
  checkoutUrl?: string | null;
  serialNumber?: string | null;
  message?: string | null;
  expiredAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateOrderPayload {
  sku?: string;
  productId?: number;
  targetAccount: string;
  targetZone?: string;
  refId: string;
  nickname?: string;
  paymentMethod?: string;
}

export function createApiOrder(
  apiKey: string,
  payload: CreateOrderPayload
): Promise<ApiResponse<ApiOrderResult>> {
  return apiRequest<ApiOrderResult>('/api/v1/orders', {
    method: 'POST',
    apiKey,
    body: { ...payload },
  });
}

export function fetchApiOrderDetails(
  apiKey: string,
  refId: string
): Promise<ApiResponse<ApiOrderResult>> {
  return apiRequest<ApiOrderResult>(`/api/v1/orders/${encodeURIComponent(refId)}`, {
    method: 'GET',
    apiKey,
  });
}

export function fetchApiOrdersHistory(
  apiKey: string,
  query?: { page?: number; limit?: number; status?: string; search?: string }
): Promise<ApiResponse<{ data: ApiOrderResult[]; pagination: Record<string, unknown> }>> {
  return apiRequest<{ data: ApiOrderResult[]; pagination: Record<string, unknown> }>(
    '/api/v1/orders',
    {
      method: 'GET',
      apiKey,
      query: { page: query?.page, limit: query?.limit, status: query?.status, search: query?.search },
    }
  );
}
