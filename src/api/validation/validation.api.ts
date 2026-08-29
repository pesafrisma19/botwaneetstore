import { apiRequest, ApiResponse } from '../client';

export interface FirstTopupTier {
  id?: string;
  name?: string;
  diamonds?: number;
  bonus?: number;
  available?: boolean;
  statusText?: string;
}

export interface ApiValidateResult {
  valid: boolean;
  nickname: string;
  detectedRegionCode: string;
  detectedCountry: string;
  firstTopupAvailable?: boolean;
  firstTopupTiers?: FirstTopupTier[];
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
