import { apiRequest, ApiResponse } from '../client';

export interface BotRegisterPayload {
  username: string;
  wa: string;
  fullname?: string;
}

export interface BotRegisterResult {
  username: string;
  level: string;
  apiKey?: string;
}

export function requestBotRegistration(payload: BotRegisterPayload): Promise<ApiResponse<BotRegisterResult>> {
  return apiRequest<BotRegisterResult>('/api/v1/auth/bot-register', {
    method: 'POST',
    body: {
      username: payload.username,
      wa: payload.wa,
      fullname: payload.fullname,
    },
  });
}
