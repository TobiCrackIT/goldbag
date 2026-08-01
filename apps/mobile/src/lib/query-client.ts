import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { mmkvPersistAdapter } from "./storage.js";
import { ApiError, NetworkError } from "./api/errors.js";

/**
 * Server state lives here and nowhere else (architecture §5.3). The MMKV
 * persister rehydrates the cache at cold start so the app opens with
 * content instead of spinners.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24, // survive a day of app restarts
      retry: (failureCount, error) => {
        // Retrying a 4xx just repeats the same answer; network blips are
        // worth two more tries.
        if (error instanceof ApiError) {
          return error.code === "NETWORK_CONGESTION" && failureCount < 2;
        }
        return error instanceof NetworkError && failureCount < 2;
      },
      refetchOnReconnect: true,
    },
    mutations: { retry: false },
  },
});

export const queryPersister = createSyncStoragePersister({
  storage: mmkvPersistAdapter,
  key: "goldbag.query-cache",
  throttleTime: 1000,
});
