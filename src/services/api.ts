import axios from 'axios';
import type { AxiosProgressEvent } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      const { state } = JSON.parse(authStorage);
      if (state?.token) {
        config.headers.Authorization = `Bearer ${state.token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth storage on unauthorized
      localStorage.removeItem('auth-storage');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    credits?: number;
    status?: string;
  };
  token: string;
}

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled';

export type CampaignCtaType = 'URL' | 'PHONE' | 'QUICK_REPLY';

export interface CampaignCtaButton {
  type: CampaignCtaType;
  title: string;
  payload?: string;
  url?: string;
  phoneNumber?: string;
}

export interface CampaignPayload {
  campaign_name: string;
  name?: string;
  templateId?: number;
  caption?: string;
  media_url?: string;
  media_type?: string;
  media_name?: string;
  attachmentUrl?: string;
  ctaButtons?: CampaignCtaButton[];
  status?: CampaignStatus;
  scheduled_start?: string | Date;
  scheduled_end?: string | Date;
}

export interface Campaign extends CampaignPayload {
  id: number;
  user?: { id: number };
  recipientsCount: number;
  sentCount: number;
  successCount: number;
  failedCount: number;
  readCount: number;
  lastRunAt?: string | Date | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface RunCampaignPayload {
  campaignId: number;
  virtualNumberId?: number;
  recipientsCount: number;
  startImmediately?: boolean;
}

export interface RunCampaignResponse {
  campaign: Campaign;
  assignedNumber: VirtualNumber;
  dispatch?: CampaignDispatchSummary;
}

export interface CampaignDispatchBatchSummary {
  id: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  batchIndex: number;
  totalBatches: number;
  size: number;
  startedAt?: string;
  finishedAt?: string;
  attempt: number;
  error?: string;
}

export interface CampaignDispatchSenderSummary {
  virtualNumberId: number;
  virtualNumberLabel?: string;
  businessNumberId?: number;
  businessNumber?: string;
  switchedAt?: string;
  switchReason?: string;
}

export interface CampaignDispatchSummary {
  jobIds: string[];
  totalBatches: number;
  batchSize: number;
  estimatedDurationSeconds: number;
  batches: CampaignDispatchBatchSummary[];
  sender: CampaignDispatchSenderSummary;
}

export interface MediaUploadResponse {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  checksum?: string;
}

export const mediaAPI = {
  upload: async (
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<MediaUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<MediaUploadResponse>('/media', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (event: AxiosProgressEvent) => {
        if (!event.total) return;
        const percent = Math.round((event.loaded * 100) / event.total);
        onProgress?.(percent);
      },
    });

    return response.data;
  },
};

// Real API for PostgreSQL backend authentication
export const authAPI = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    try {
      const response = await api.post<AuthResponse>('/auth/login', credentials);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Invalid credentials');
    }
  },

  register: async (credentials: RegisterCredentials): Promise<AuthResponse> => {
    try {
      const response = await api.post<AuthResponse>('/auth/register', credentials);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Registration failed');
    }
  },
  
  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Ignore logout errors
    }
  },

  verifyToken: async (): Promise<AuthResponse> => {
    try {
      const response = await api.get<AuthResponse>('/auth/verify');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Token verification failed');
    }
  },
};

export type VirtualNumberStatus = 'active' | 'restricted' | 'throttled' | 'banned' | 'disconnected';
export type VirtualNumberQuality = 'high' | 'medium' | 'low' | 'unknown';

export interface BusinessNumber {
  id: number;
  businessName?: string | null;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber?: string | null;
  accessToken: string;
  autoSwitchEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface VirtualNumber {
  id: number;
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  status: VirtualNumberStatus;
  qualityRating: VirtualNumberQuality;
  isPrimary: boolean;
  messageCount24h: number;
  lastUsedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateVirtualNumberPayload {
  businessNumberId?: number;
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  status?: VirtualNumberStatus;
  qualityRating?: VirtualNumberQuality;
  isPrimary?: boolean;
}

export interface UpdateVirtualNumberPayload extends Partial<CreateVirtualNumberPayload> {
  messageCount24h?: number;
  lastUsedAt?: string;
}

export const numbersAPI = {
  getBusinessNumber: async (): Promise<BusinessNumber | null> => {
    try {
      const response = await api.get<BusinessNumber | null>('/admin/business-number');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch business number');
    }
  },

  updateBusinessNumber: async (data: Partial<BusinessNumber>): Promise<BusinessNumber> => {
    try {
      const response = await api.put<BusinessNumber>('/admin/business-number', data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to update business number');
    }
  },

  getVirtualNumbers: async (): Promise<VirtualNumber[]> => {
    try {
      const response = await api.get<VirtualNumber[]>('/admin/virtual-numbers');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch virtual numbers');
    }
  },

  createVirtualNumber: async (data: CreateVirtualNumberPayload): Promise<VirtualNumber> => {
    try {
      const response = await api.post<VirtualNumber>('/admin/virtual-numbers', data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to create virtual number');
    }
  },

  updateVirtualNumber: async (id: number, data: UpdateVirtualNumberPayload): Promise<VirtualNumber> => {
    try {
      const response = await api.put<VirtualNumber>(`/admin/virtual-numbers/${id}`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to update virtual number');
    }
  },

  manualSwitch: async (targetId?: number): Promise<VirtualNumber> => {
    try {
      const response = await api.put<VirtualNumber>('/admin/virtual-numbers/switch', targetId ? { targetId } : {});
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to switch virtual number');
    }
  },
};

// User profile management API
export interface UpdateUserRequest {
  username?: string;
  password?: string;
  currentPassword?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: string;
  credits?: number;
  status?: string;
  createdAt?: string;
}

export const userAPI = {
  getProfile: async (): Promise<UserProfile> => {
    try {
      const response = await api.get<UserProfile>('/users/profile');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch profile');
    }
  },

  updateProfile: async (data: UpdateUserRequest): Promise<UserProfile> => {
    try {
      const response = await api.put<UserProfile>('/users/update', data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to update profile');
    }
  },
};

// Admin API for user management
export interface CreditTransferRequest {
  userId: number;
  amount: number;
}

export interface AdminCampaignStats {
  totalCampaigns: number;
  activeCampaigns: number;
  scheduledCampaigns: number;
}

export interface AdminNumberHealthSummary {
  totalVirtualNumbers: number;
  statusBreakdown: Record<string, number>;
  qualityBreakdown: Record<string, number>;
  primaryNumber?: {
    id: number;
    phoneNumberId: string;
    status: string;
    qualityRating: string;
    lastUsedAt: string | null;
  } | null;
}

export interface AdminStatsResponse {
  totalUsers: number;
  totalCreditsAllocated: number;
  campaignStats: AdminCampaignStats;
  numberHealth: AdminNumberHealthSummary;
}

export interface CampaignReportSummary {
  id: number;
  campaignId: number;
  campaignName: string;
  total: number;
  delivered: number;
  failed: number;
  read: number;
}

export type TemplateApprovalStatus = 'pending' | 'approved' | 'rejected';

export type ProviderValidationStatus =
  | 'not_required'
  | 'pending'
  | 'in_progress'
  | 'approved'
  | 'rejected'
  | 'failed';

export interface TemplateVariable {
  key: string;
  sampleValue?: string | null;
}

export interface TemplateSampleParameter {
  name: string;
  value?: string | null;
}

export interface MessageTemplate {
  id: number;
  name: string;
  category?: string | null;
  language: string;
  body: string;
  header?: string | null;
  footer?: string | null;
  approvalStatus: TemplateApprovalStatus;
  rejectionReason?: string | null;
  metaStatus: ProviderValidationStatus;
  dltStatus: ProviderValidationStatus;
  bspStatus: ProviderValidationStatus;
  metaTemplateId?: string | null;
  dltTemplateId?: string | null;
  bspTemplateId?: string | null;
  attachmentUrl?: string | null;
  variables?: TemplateVariable[] | null;
  sampleParameters: TemplateSampleParameter[];
  createdAt?: string;
  updatedAt?: string;
}

export interface TemplateSyncSummary {
  provider: 'meta' | 'dlt' | 'bsp';
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface TemplatePayloadValidationInput {
  variables?:
    | Record<string, string | number | boolean | null | undefined>
    | TemplateVariable[];
  media?: {
    mediaUrl?: string | null;
    attachmentUrl?: string | null;
    mediaType?: string | null;
    mimeType?: string | null;
    mediaName?: string | null;
    mediaSize?: number | null;
  };
}

export interface TemplateMediaRequirement {
  required: boolean;
  expectedType?: string | null;
  format?: string | null;
}

export interface TemplatePayloadValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredVariables: string[];
  providedVariables: string[];
  templateApprovalStatus: TemplateApprovalStatus;
  mediaRequirement: TemplateMediaRequirement;
}

export const templatesAPI = {
  listAll: async (): Promise<MessageTemplate[]> => {
    const response = await api.get<MessageTemplate[]>('/templates');
    return response.data;
  },

  listApproved: async (): Promise<MessageTemplate[]> => {
    const response = await api.get<MessageTemplate[]>('/templates/approved');
    return response.data;
  },

  sync: async (): Promise<TemplateSyncSummary[]> => {
    const response = await api.post<TemplateSyncSummary[]>('/templates/sync');
    return response.data;
  },

  validate: async (
    id: number,
    payload: TemplatePayloadValidationInput,
  ): Promise<TemplatePayloadValidationResult> => {
    const response = await api.post<TemplatePayloadValidationResult>(
      `/templates/${id}/validate`,
      payload,
    );
    return response.data;
  },
};

export interface CampaignReportsOverview {
  totals: {
    total: number;
    delivered: number;
    failed: number;
    read: number;
    deliveryRate: number;
    failureRate: number;
  };
  campaigns: CampaignReportSummary[];
}

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

export const reportsAPI = {
  getOverview: async (): Promise<CampaignReportsOverview> => {
    try {
      const response = await api.get<CampaignReportsOverview>('/reports/campaign');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch campaign reports');
    }
  },

  getCampaignReport: async (campaignId: number): Promise<CampaignReportResponse> => {
    try {
      const response = await api.get<CampaignReportResponse>(`/reports/campaign/${campaignId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch campaign report');
    }
  },
};

export interface WebhookLogEntry {
  id: number;
  source: string;
  eventType?: string | null;
  status?: string | null;
  referenceId?: string | null;
  payload?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export const adminAPI = {
  getAllUsers: async (): Promise<UserProfile[]> => {
    try {
      const response = await api.get<UserProfile[]>('/admin/users');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch users');
    }
  },

  getUserById: async (id: string): Promise<UserProfile> => {
    try {
      const response = await api.get<UserProfile>(`/admin/users/${id}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch user');
    }
  },

  updateUserStatus: async (id: string, status: string): Promise<any> => {
    try {
      const response = await api.put(`/admin/users/${id}/status`, { status });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to update user status');
    }
  },

  transferCredits: async (data: CreditTransferRequest): Promise<any> => {
    try {
      const response = await api.post('/admin/credits/transfer', data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to transfer credits');
    }
  },

  deductCredits: async (data: CreditTransferRequest): Promise<any> => {
    try {
      const response = await api.post('/admin/credits/deduct', data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to deduct credits');
    }
  },

  setUserCredits: async (id: number, credits: number): Promise<any> => {
    try {
      const response = await api.put(`/admin/users/${id}/credits`, { credits });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to set user credits');
    }
  },

  getCreditsInfo: async (): Promise<any> => {
    try {
      const response = await api.get('/admin/credits');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch credits info');
    }
  },

  getStats: async (): Promise<AdminStatsResponse> => {
    try {
      const response = await api.get<AdminStatsResponse>('/admin/stats');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch admin stats');
    }
  },

  getWebhookLogs: async (params?: { source?: string; eventType?: string; limit?: number }): Promise<WebhookLogEntry[]> => {
    try {
      const response = await api.get<WebhookLogEntry[]>('/admin/logs', { params });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch webhook logs');
    }
  },

  registerUser: async (userData: RegisterCredentials): Promise<AuthResponse> => {
    try {
      const response = await api.post<AuthResponse>('/auth/admin/register', userData);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to register user');
    }
  },
};

// Mock campaign data
const mockCampaigns = [
  {
    id: '1',
    name: 'Summer Sale Promotion',
    status: 'active',
    date: '15 June 2024',
    icon: 'Megaphone',
    stats: { sent: 10500, delivered: 10342 }
  },
  {
    id: '2',
    name: 'New Feature Announcement',
    status: 'paused',
    date: '12 June 2024',
    icon: 'Sparkles',
    stats: { sent: 8200, delivered: 8100 }
  },
  {
    id: '3',
    name: 'Holiday Greetings Blast',
    status: 'completed',
    date: '10 June 2024',
    icon: 'Calendar',
    stats: { sent: 15000, delivered: 14850 }
  },
  {
    id: '4',
    name: 'Customer Support Follow-up',
    status: 'active',
    date: '8 June 2024',
    icon: 'Headphones',
    stats: { sent: 3200, delivered: 3180 }
  },
];

// Mock dashboard stats - updated with dynamic values
export const mockDashboardStats = {
  activeCampaigns: 15,
  activeCampaignsTrend: { value: '+2% from last week', isPositive: true },
  sentToday: '1,204',
  sentTodayTrend: { value: '+10% from yesterday', isPositive: true },
  deliveryRate: '98.7%',
  deliveryRateTrend: { value: '-0.2% from last week', isPositive: false },
};

// Fixed dashboard stats with realistic values
const getFixedDashboardStats = () => {
  // Use fixed values for consistent display
  return {
    activeCampaigns: 5,
    activeCampaignsTrend: { 
      value: '+2.5% from last week', 
      isPositive: true 
    },
    sentToday: '1,204',
    sentTodayTrend: { 
      value: '+10.2% from yesterday', 
      isPositive: true 
    },
    deliveryRate: '98.7%',
    deliveryRateTrend: { 
      value: '-0.2% from last week', 
      isPositive: false 
    },
  };
};

export const campaignsAPI = {
  getAll: async (): Promise<Campaign[]> => {
    const res = await api.get<Campaign[]>('/campaigns');
    return res.data;
  },

  getById: async (id: number): Promise<Campaign> => {
    const res = await api.get<Campaign>(`/campaigns/${id}`);
    return res.data;
  },

  getRecent: async (limit = 4): Promise<Campaign[]> => {
    const res = await api.get<Campaign[]>(`/campaigns/recent?limit=${limit}`);
    return res.data;
  },

  getDashboardStats: async () => {
    const res = await api.get('/campaigns/stats');
    return res.data;
  },

  getActive: async (): Promise<Campaign[]> => {
    const res = await api.get<Campaign[]>('/campaigns/active-campaigns');
    return res.data;
  },

  create: async (payload: CampaignPayload): Promise<Campaign> => {
    const res = await api.post<Campaign>('/campaigns/create', payload);
    return res.data;
  },

  run: async (payload: RunCampaignPayload): Promise<RunCampaignResponse> => {
    const res = await api.post<RunCampaignResponse>('/campaigns/run', payload);
    return res.data;
  },

  update: async (id: number, payload: Partial<CampaignPayload>): Promise<Campaign> => {
    const res = await api.patch<Campaign>(`/campaigns/${id}`, payload);
    return res.data;
  },

  updateStatus: async (id: number, status: CampaignStatus): Promise<Campaign> => {
    const res = await api.put<Campaign>(`/campaigns/${id}/status`, { status });
    return res.data;
  },

  remove: async (id: number) => {
    const res = await api.delete(`/campaigns/${id}`);
    return res.data;
  },
};

// Mock data for when backend is not ready
const mockContacts = [
  { id: 1, phone: "+1234567890", source_file: "sample_file_1.csv", is_active: true, created_at: new Date().toISOString() },
  { id: 2, phone: "+2345678901", source_file: "sample_file_1.csv", is_active: true, created_at: new Date().toISOString() },
  { id: 3, phone: "+3456789012", source_file: "sample_file_2.xlsx", is_active: false, created_at: new Date().toISOString() },
  { id: 4, phone: "+4567890123", source_file: "sample_file_2.xlsx", is_active: true, created_at: new Date().toISOString() },
  { id: 5, phone: "+5678901234", source_file: "sample_file_3.txt", is_active: true, created_at: new Date().toISOString() },
];

const mockFiles = [
  { filename: "sample_file_1.csv", count: 2 },
  { filename: "sample_file_2.xlsx", count: 2 },
  { filename: "sample_file_3.txt", count: 1 },
];

export const contactsAPI = {
  getAll: async () => {
    try {
      const res = await api.get("/contacts");
      return res.data;
    } catch (error) {
      console.warn("Backend not ready, using mock contacts data");
      return mockContacts;
    }
  },
  
  create: async (data) => {
    try {
      const res = await api.post("/contacts", data);
      return res.data;
    } catch (error) {
      console.warn("Backend not ready, using mock data for create");
      return { ...data, id: Math.floor(Math.random() * 1000), created_at: new Date().toISOString() };
    }
  },
  update: async (id, data) => {
    try {
      const res = await api.put(`/contacts/${id}`, data);
      return res.data;
    } catch (error) {
      console.warn("Backend not ready, using mock data for update");
      return { id, ...data };
    }
  },
  remove: async (id) => {
    try {
      const res = await api.delete(`/contacts/${id}`);
      return res.data;
    } catch (error) {
      console.warn("Backend not ready, using mock data for remove");
      return { id };
    }
  },
  getFiles: async (queryParams = '') => {
    try {
      const res = await api.get(`/contacts/files${queryParams}`);
      return res.data;
    } catch (error) {
      console.warn("Backend not ready, using mock files data");
      return mockFiles;
    }
  },
  getContactsByFile: async (filename) => {
    try {
      const res = await api.get(`/contacts/file/${encodeURIComponent(filename)}`);
      return res.data;
    } catch (error) {
      console.warn("Backend not ready, using mock data for getContactsByFile");
      return mockContacts.filter(contact => contact.source_file === filename);
    }
  },
  removeContactsByFile: async (filename) => {
    try {
      const res = await api.delete(`/contacts/file/${encodeURIComponent(filename)}`);
      return res.data;
    } catch (error) {
      console.warn("Backend not ready, using mock data for removeContactsByFile");
      const count = mockContacts.filter(contact => contact.source_file === filename).length;
      return { success: true, count, message: `Successfully deleted ${count} contacts from ${filename}` };
    }
  },
  uploadFile: async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await api.post("/contacts/upload", formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        // Increase timeout for large files
        timeout: 30000,
      });
      return res.data;
    } catch (error: any) {
      console.warn("Backend not ready, using mock data for file upload");
      // Create a mock response for file upload
      const filename = file.name;
      const randomCount = Math.floor(Math.random() * 20) + 5; // Random number between 5 and 25
      
      // Add this file to our mock files if it doesn't exist
      const existingFileIndex = mockFiles.findIndex(f => f.filename === filename);
      if (existingFileIndex === -1) {
        mockFiles.push({ filename, count: randomCount });
      } else {
        mockFiles[existingFileIndex].count += randomCount;
      }
      
      // Add mock contacts for this file
      for (let i = 0; i < randomCount; i++) {
        const randomPhone = `+${Math.floor(Math.random() * 10000000000)}`;
        mockContacts.push({
          id: Math.floor(Math.random() * 10000),
          phone: randomPhone,
          source_file: filename,
          is_active: Math.random() > 0.2, // 80% chance of being active
          created_at: new Date().toISOString()
        });
      }
      
      return {
        filename,
        originalname: file.name,
        total: randomCount,
        unique: randomCount
      };
    }
  },
};
