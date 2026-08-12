import { apiRequest, ApiResponse } from '../client';

export interface ApiProfileData {
  id: number;
  username: string;
  level: string;
  balance: number;
}

export async function fetchApiProfile(apiKey: string): Promise<ApiResponse<ApiProfileData>> {
  return apiRequest<ApiProfileData>('/api/v1/profile', {
    method: 'GET',
    apiKey,
  });
}
