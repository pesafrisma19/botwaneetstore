import { apiRequest, ApiResponse } from '../client';

export interface ApiDepositResult {
  refId: string;
  clientRefId: string | null;
  amount: number;
  fee: number;
  uniqueCode: number;
  totalAmount: number;
  paymentMethod: string;
  status: string;
  qrString?: string | null;
  qrImageUrl?: string | null;
  checkoutUrl?: string | null;
  paymentInstructions?: string | null;
  paidAt?: string | null;
  expiredAt?: string | null;
  createdAt?: string;
}

export function createApiDeposit(
  apiKey: string,
  payload: { amount: number; paymentMethod: string; refId?: string }
): Promise<ApiResponse<ApiDepositResult>> {
  return apiRequest<ApiDepositResult>('/api/v1/deposits', {
    method: 'POST',
    apiKey,
    body: payload as Record<string, unknown>,
  });
}

export function fetchApiDepositDetails(
  apiKey: string,
  refId: string
): Promise<ApiResponse<ApiDepositResult>> {
  return apiRequest<ApiDepositResult>(`/api/v1/deposits/${encodeURIComponent(refId)}`, {
    method: 'GET',
    apiKey,
  });
}

export function fetchApiDepositsHistory(
  apiKey: string,
  query?: { page?: number; limit?: number; status?: string }
): Promise<ApiResponse<{ data: ApiDepositResult[]; pagination: Record<string, unknown> }>> {
  return apiRequest<{ data: ApiDepositResult[]; pagination: Record<string, unknown> }>(
    '/api/v1/deposits',
    {
      method: 'GET',
      apiKey,
      query: { page: query?.page, limit: query?.limit, status: query?.status },
    }
  );
}
