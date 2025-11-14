import { Injectable } from '@nestjs/common';

export interface WhatsAppSendPayload {
  to: string;
  campaignId: number;
  jobId: string;
  caption?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  media_name?: string | null;
  cta?: Record<string, any>[] | null;
}

export interface WhatsAppSendResult {
  status: 'sent' | 'failed';
  errorCode?: string;
  errorMessage?: string;
}

export interface WhatsAppAdapter {
  send(payload: WhatsAppSendPayload): Promise<WhatsAppSendResult>;
}

export const WHATSAPP_ADAPTER = Symbol('WHATSAPP_ADAPTER');

@Injectable()
export class MockWhatsAppAdapter implements WhatsAppAdapter {
  async send(payload: WhatsAppSendPayload): Promise<WhatsAppSendResult> {
    // Placeholder implementation until real WhatsApp integration is available.
    const success = Math.random() > 0.1;

    if (success) {
      return { status: 'sent' };
    }

    return {
      status: 'failed',
      errorCode: 'MOCK_FAIL',
      errorMessage: `Simulated failure delivering to ${payload.to}`,
    };
  }
}
