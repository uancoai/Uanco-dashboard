import { DateRange, Eligibility, ClinicData, ClinicConfig } from '../types';
import { generateMockData, MOCK_CLINICS } from './mockData';

export const fetchDashboardData = async (dateRange: DateRange, clinicId: string): Promise<ClinicData> => {
  await new Promise(r => setTimeout(r, 400));
  const rawData = generateMockData();
  const config = MOCK_CLINICS.find(c => c.id === clinicId) || MOCK_CLINICS[0];

  const preScreens = rawData.preScreens.filter(r => r.clinic_id === clinicId);
  const dropOffs = rawData.dropOffs.filter(r => r.clinic_id === clinicId);

  const passed = preScreens.filter(r => r.eligibility === Eligibility.PASS).length;
  const total = preScreens.length;

  return {
    config,
    metrics: {
      totalPreScreens: total,
      passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
      tempFails: preScreens.filter(r => r.eligibility === Eligibility.REVIEW).length,
      hardFails: preScreens.filter(r => r.eligibility === Eligibility.FAIL).length,
      dropOffRate: 15,
      incompleteRate: 10,
      adminTimeSaved: total * 0.2,
      funnelData: [
        { step: "Started", count: total + 20, conversion: 100 },
        { step: "Completed", count: total, conversion: 80 },
        { step: "Qualified", count: passed, conversion: 60 }
      ],
      failReasons: [
        { reason: "Antibiotics", count: 12 },
        { reason: "Underage", count: 5 }
      ],
      treatmentStats: [
        { name: "Lip Fillers", count: 25, passRate: 70, dropOffRate: 10 },
        { name: "Skin Boosters", count: 18, passRate: 85, dropOffRate: 5 }
      ]
    },
    preScreens,
    dropOffs,
    questions: [],
    heartbeats: []
  };
};