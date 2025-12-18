export const Eligibility = {
  PASS: "Pass" as const,
  FAIL: "Fail" as const,
  REVIEW: "Review" as const
};

export type EligibilityType = typeof Eligibility[keyof typeof Eligibility];

export type FeatureId = 'overview' | 'prescreens' | 'ai-insight' | 'compliance' | 'feedback' | 'analytics';

export interface AuthUser {
  id: string;
  email: string;
}

export interface ClinicProfile {
  id: string;
  name: string;
  active: boolean;
  enabled_features: string[];
}

export interface UserMeResponse {
  user: AuthUser;
  clinic: ClinicProfile;
}

export interface PreScreenRecord {
  id: string;
  clinic_id: string;
  created_time: string;
  name: string;
  email: string;
  phone: string;
  eligibility: EligibilityType;
  interested_treatments: string[];
  treatment_selected: string;
  manual_review_flag: boolean | null;
  reason?: string | null;
  pre_screen_summary: string;
  booking_status?: 'Pending' | 'Booked';
  suitability_next_step?: string;
  age_verified?: boolean;
  pregnant_breastfeeding?: boolean;
  allergies_yesno?: boolean;
  allergies_details?: string;
  policies_ack?: boolean;
  antibiotics_14d?: boolean;
}

export interface DropOffRecord {
  id: string;
  clinic_id: string;
  email: string;
  reason: string;
  created_time: string;
  interested_treatments?: string[];
}

export interface AIQuestionRecord {
  id: string;
  clinic_id: string;
  name: string;
  email: string;
  question: string;
  ai_answer: string;
  timestamp: string;
  weekly_summary: string;
}

export interface SystemHeartbeatRecord {
  id: string;
  clinic_id: string;
  event: string;
  timestamp: string;
  status: 'Success' | 'Error';
  details?: string;
  client_email?: string;
}

export interface ClinicConfig {
  id: string;
  name: string;
  logo_initials: string;
  features: string[];
  isActive: boolean;
}

export interface DashboardMetrics {
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
}

export interface ClinicData {
  config: ClinicConfig;
  metrics: DashboardMetrics;
  preScreens: PreScreenRecord[];
  dropOffs: DropOffRecord[];
  questions: AIQuestionRecord[];
  heartbeats: SystemHeartbeatRecord[];
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface AnalyticsResponse {
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
}