import { apiRequest, ApiResponse } from '../client';

export interface ApiProfileData {
  id: number;
  username: string;
  fullname: string | null;
  level: string;
  balance: number;
  phone?: string | null;
}

export async function fetchApiProfile(apiKey: string): Promise<ApiResponse<ApiProfileData>> {
  return apiRequest<ApiProfileData>('/api/v1/profile', {
    method: 'GET',
    apiKey,
  });
}
