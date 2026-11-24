// Pomelo's payloads. Provisioning bodies carry wallet secrets: never log them.

export type PomeloApplePayRequest = {
  card_id: string;
  certificates: string[];
  nonce: string;
  nonce_signature: string;
};

export type PomeloApplePayData = {
  activation_data: string;
  encrypted_pass_data: string;
  ephemeral_public_key: string;
};

export type PomeloGooglePayRequest = {
  card_id: string;
  server_session_id: string;
};

export type PomeloGooglePayData = {
  opc: string;
  google_opc: string;
};

export type PomeloTokenResponse = {
  access_token: string;
  expires_in: number;
};

// Webhook bodies arrive unvalidated: every field is optional until the mapper checks it.
export type PomeloTokenLifecyclePayload = {
  event_id?: string;
  card_id?: string;
  user_id?: string;
  token_external_id?: string;
  status?: string;
  origin?: string;
  token_status_reason?: string;
  idempotency_key?: string;
};

export type PomeloTokenNotificationPayload = Omit<
  PomeloTokenLifecyclePayload,
  'status' | 'token_status_reason'
>;
