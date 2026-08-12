import { apiRequest, ApiResponse } from '../client';

export interface ApiValidateResult {
  valid: boolean;
  nickname: string;
  detectedRegionCode: string;
  detectedCountry: string;
}

export function validateAccount(
  apiKey: string,
  payload: { brandId?: number; productId?: number; targetAccount: string; targetZone?: string }
): Promise<ApiResponse<ApiValidateResult>> {
  return apiRequest<ApiValidateResult>('/api/v1/validate-account', {
    method: 'POST',
    apiKey,
    body: {
      brandId: payload.brandId,
      productId: payload.productId,
      targetAccount: payload.targetAccount,
      targetZone: payload.targetZone,
    },
  });
}
