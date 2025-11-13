export interface CampaignReportResponse {
  id: number;
  campaignId: number;
  campaignName: string;
  total: number;
  delivered: number;
  failed: number;
  read: number;
  readCount: number;
  createdAt: string;
  lastUpdated: string;
  deliveryRate: number;
  failureRate: number;
}
