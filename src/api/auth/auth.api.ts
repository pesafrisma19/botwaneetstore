import { apiRequest, ApiResponse } from '../client';
import { botSecret } from '../../config';

export interface BotRegisterPayload {
  username: string;
  wa: string;
  fullname?: string;
}

export interface BotRegisterResult {
  alreadyRegistered: boolean;
  username: string;
  phone: string;
  password?: string;
  apiKey?: string;
  level: string;
  whitelistedIp?: string;
}

export function requestBotRegistration(payload: BotRegisterPayload): Promise<ApiResponse<BotRegisterResult>> {
  return apiRequest<BotRegisterResult>('/api/bot/register', {
    method: 'POST',
    botKey: botSecret,
    body: {
      username: payload.username,
      wa: payload.wa,
      fullname: payload.fullname,
    },
  });
}
