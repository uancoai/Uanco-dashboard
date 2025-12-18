export const Eligibility = {
  PASS: "Pass",
  FAIL: "Fail",
  REVIEW: "Review"
} as const;

export type Eligibility = typeof Eligibility[keyof typeof Eligibility];

export type FeatureId = 'overview' | 'prescreens' | 'ai-insight' | 'compliance' | 'feedback' | 'analytics';

export type AuthUser = {
  id: string;
  email: string;
};

export type ClinicProfile = {
  id: string;
  name: string;
  active: boolean;
  enabled_features: string[];
};

export type ClinicConfig = {
  id: string;
  name: string;
  logo_initials: string;
  features: string[];
  isActive: boolean;
};

export type UserMeResponse = {
  user: AuthUser;
  clinic: ClinicProfile;
};

export type PreScreenRecord = {
  id: string;
  clinic_id: string;
  created_time: string;
  name: string;
  email: string;
  phone: string;
  eligibility: Eligibility;
  interested_treatments: string[];
  treatment_selected: string;
  manual_review_flag: boolean | null;
  reason: string | null;
  pre_screen_summary: string;
  booking_status?: 'Pending' | 'Booked';
  suitability_next_step?: string;
  age_verified?: boolean;
  pregnant_breastfeeding?: boolean;
  allergies_yesno?: boolean;
  allergies_details?: string;
  policies_ack?: boolean;
  antibiotics_14d?: boolean;
};

export type DropOffRecord = {
  id: string;
  clinic_id: string;
  email: string;
  reason: string;
  created_time: string;
  interested_treatments?: string[];
};

export type AIQuestionRecord = {
  id: string;
  clinic_id: string;
  name: string;
  email: string;
  question: string;
  ai_answer: string;
  timestamp: string;
  weekly_summary: string;
};

export type SystemHeartbeatRecord = {
  id: string;
  clinic_id: string;
  event: string;
  timestamp: string;
  status: 'Success' | 'Error';
  details?: string;
  client_email?: string;
};

export type DashboardMetrics = {
  totalPreScreens: number;
  passRate: number;
  tempFails: number;
  hardFails: number;
  dropOffRate: number;
  incompleteRate: number;
  adminTimeSaved: number;
  funnelData: Array<{ step: string; count: number; conversion: number }>;
  failReasons: Array<{ reason: string; count: number }>;
  treatmentStats: Array<{ name: string; count: number; passRate: number; dropOffRate: number }>;
};

export type ClinicData = {
  config: ClinicConfig;
  metrics: DashboardMetrics;
  preScreens: PreScreenRecord[];
  dropOffs: DropOffRecord[];
  questions: AIQuestionRecord[];
  heartbeats: SystemHeartbeatRecord[];
};

export type AnalyticsResponse = {
  totals: {
    total: number;
    pass: number;
    fail: number;
    review: number;
    dropoffs: number;
  };
  daily: Array<{
    date: string;
    total: number;
  }>;
};

export type DateRange = {
  start: Date;
  end: Date;
};