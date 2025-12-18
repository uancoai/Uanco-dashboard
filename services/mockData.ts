import { PreScreenRecord, DropOffRecord, AIQuestionRecord, SystemHeartbeatRecord, Eligibility, ClinicConfig, EligibilityType } from '../types';

const TREATMENT_OPTIONS = ["Lip Fillers", "Anti-Wrinkle Injections", "Dermal Fillers", "Skin Boosters", "Microneedling"];
const FAIL_REASONS = ["Antibiotics in last 14 days", "Pregnancy / breastfeeding", "Did not accept clinic policies", "Client self-assessed not suitable", "Underage", "Active infection"];

export const MOCK_CLINICS: ClinicConfig[] = [
  { id: 'rec_uanco_pilot_alpha_89s7d', name: 'Lerae Medical Aesthetics', logo_initials: 'LM', features: ['overview', 'prescreens', 'ai-insight', 'compliance', 'feedback'], isActive: true },
  { id: 'rec_uanco_pilot_beta_x9d8f', name: 'Skin & Glow Co', logo_initials: 'SG', features: ['overview', 'prescreens', 'feedback'], isActive: true }
];

const randomDate = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  return date.toISOString();
};

export const generateMockData = () => {
  const preScreens: PreScreenRecord[] = [];
  const dropOffs: DropOffRecord[] = [];
  const questions: AIQuestionRecord[] = [];
  const heartbeats: SystemHeartbeatRecord[] = [];

  MOCK_CLINICS.forEach(clinic => {
    for (let i = 0; i < 50; i++) {
      const isPass = Math.random() > 0.3;
      preScreens.push({
        id: `rec-${clinic.id}-${i}`,
        clinic_id: clinic.id,
        name: `Client ${i}`,
        email: `client${i}@example.com`,
        phone: `+447000000${i}`,
        eligibility: isPass ? Eligibility.PASS : Eligibility.FAIL,
        interested_treatments: [TREATMENT_OPTIONS[Math.floor(Math.random() * TREATMENT_OPTIONS.length)]],
        treatment_selected: TREATMENT_OPTIONS[Math.floor(Math.random() * TREATMENT_OPTIONS.length)],
        manual_review_flag: Math.random() > 0.9,
        reason: isPass ? null : FAIL_REASONS[Math.floor(Math.random() * FAIL_REASONS.length)],
        pre_screen_summary: "AI analysis complete.",
        created_time: randomDate(30),
        booking_status: isPass && Math.random() > 0.5 ? 'Booked' : 'Pending'
      });
    }
    for (let i = 0; i < 15; i++) {
        dropOffs.push({
            id: `drop-${clinic.id}-${i}`,
            clinic_id: clinic.id,
            email: `drop${i}@test.com`,
            reason: "Policy step",
            created_time: randomDate(30)
        });
    }
  });

  return { preScreens, dropOffs, questions, heartbeats };
};