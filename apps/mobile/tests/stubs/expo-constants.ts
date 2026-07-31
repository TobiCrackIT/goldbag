// Test double for expo-constants so the API client can run under Node.
export default {
  expoConfig: { extra: { apiUrl: process.env.TEST_API_URL ?? "http://localhost:3000" } },
};
