import type { Handler } from '@netlify/functions'

export const handler: Handler = async () => {
  // Minimal valid structure your app expects
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      preScreens: [],
      dropOffs: [],
      questions: [],
      metrics: {
        totalPreScreens: 0,
        passRate: 0,
        dropOffRate: 0,
        hardFails: 0,
        tempFails: 0,
        failReasons: [],
        funnelData: [],
        treatmentStats: [],
      },
    }),
  }
}