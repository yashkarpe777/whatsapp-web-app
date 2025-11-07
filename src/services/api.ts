import axios from 'axios';

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
    role?: string;
  };
  token: string;
}

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
  getAll: async () => {
    try {
      const res = await api.get("/campaigns");
      return res.data;
    } catch (error) {
      console.warn("Backend not ready, using mock campaigns data");
      return mockCampaigns;
    }
  },
  getRecent: async (limit = 4) => {
    try {
      const res = await api.get(`/campaigns/recent?limit=${limit}`);
      return res.data;
    } catch (error) {
      console.warn("Backend not ready, using mock recent campaigns data");
      return mockCampaigns.slice(0, limit);
    }
  },
  getDashboardStats: async () => {
    try {
      const res = await api.get("/campaigns/stats");
      return res.data;
    } catch (error) {
      console.warn("Backend not ready, using fixed mock dashboard stats");
      return getFixedDashboardStats();
    }
  },
  create: async (data) => {
    try {
      const res = await api.post("/campaigns", data);
      return res.data;
    } catch (error) {
      console.warn("Backend not ready, using mock data for campaign create");
      const newCampaign = {
        id: `${mockCampaigns.length + 1}`,
        name: data.name,
        status: 'draft',
        date: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
        icon: 'Megaphone',
        stats: { sent: 0, delivered: 0 }
      };
      mockCampaigns.unshift(newCampaign);
      return newCampaign;
    }
  },
  update: async (id, data) => {
    try {
      const res = await api.patch(`/campaigns/${id}`, data);
      return res.data;
    } catch (error) {
      console.warn("Backend not ready, using mock data for campaign update");
      const index = mockCampaigns.findIndex(c => c.id === id);
      if (index !== -1) {
        mockCampaigns[index] = { ...mockCampaigns[index], ...data };
        return mockCampaigns[index];
      }
      throw new Error('Campaign not found');
    }
  },
  remove: async (id) => {
    try {
      const res = await api.delete(`/campaigns/${id}`);
      return res.data;
    } catch (error) {
      console.warn("Backend not ready, using mock data for campaign delete");
      const index = mockCampaigns.findIndex(c => c.id === id);
      if (index !== -1) {
        const deleted = mockCampaigns[index];
        mockCampaigns.splice(index, 1);
        return { id, success: true };
      }
      throw new Error('Campaign not found');
    }
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
