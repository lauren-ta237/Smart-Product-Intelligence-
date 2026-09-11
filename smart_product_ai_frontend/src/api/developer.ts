import { api } from "./client";

export interface APIKeyItem {
  id: string;
  developer_id: string;
  prefix: string;
  tier: string;
  is_active: boolean;
  calls_made: number;
  rate_limit_max: number;
  created_at?: string;
}

export interface CreateKeyResponse extends APIKeyItem {
  api_key?: string;
  raw_key?: string;
}

export interface RevokeApiKeyResponse {
  status: string;
  message: string;
  key_id: string;
  is_active: boolean;
}

/**
 * Fetch API keys belonging to the currently authenticated user.
 */
export const fetchApiKeys = async (): Promise<APIKeyItem[]> => {
  const response = await api.get<APIKeyItem[]>("/developer/api-keys");

  return response.data;
};

/**
 * Create a new API key for the currently authenticated user.
 */
export const createApiKey = async (
  tier: string
): Promise<CreateKeyResponse> => {
  const response = await api.post<CreateKeyResponse>(
    "/developer/api-keys",
    {
      tier,
    }
  );

  return response.data;
};

/**
 * Revoke an API key owned by the currently authenticated user.
 */
export const revokeApiKey = async (
  keyId: string
): Promise<RevokeApiKeyResponse> => {
  const response = await api.post<RevokeApiKeyResponse>(
    `/developer/api-keys/${keyId}/revoke`
  );

  return response.data;
};