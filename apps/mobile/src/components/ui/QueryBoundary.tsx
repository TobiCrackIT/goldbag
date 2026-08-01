import type { ReactElement, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import type { UseQueryResult } from "@tanstack/react-query";
import { errorCopy } from "../../lib/api/errors";

/**
 * Every data screen renders through this: loading, empty and error are
 * designed states, not afterthoughts. This is how PRD 7.6's "no blank
 * screens, no raw error strings" bar is enforced structurally rather
 * than by code review (architecture §5.5).
 */
interface QueryBoundaryProps<TData> {
  query: UseQueryResult<TData>;
  /** Rendered while the first load is in flight. */
  loading: ReactNode;
  /** Rendered when the query succeeds but there's nothing to show. */
  empty?: ReactNode;
  isEmpty?: (data: TData) => boolean;
  children: (data: TData) => ReactElement;
}

export function QueryBoundary<TData>({
  query,
  loading,
  empty,
  isEmpty,
  children,
}: QueryBoundaryProps<TData>) {
  if (query.isPending) return <>{loading}</>;

  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  if (empty && isEmpty?.(query.data)) return <>{empty}</>;

  return children(query.data);
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { title, message } = errorCopy(error);
  return (
    <View className="flex-1 items-center justify-center px-8 py-12">
      <Text className="text-primary text-lg font-semibold text-center">{title}</Text>
      <Text className="text-secondary text-base text-center mt-2 leading-6">{message}</Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          className="mt-6 rounded-full border border-border px-6 py-3 active:opacity-60"
        >
          <Text className="text-primary text-base font-medium">Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-12">
      <Text className="text-primary text-lg font-semibold text-center">{title}</Text>
      <Text className="text-secondary text-base text-center mt-2 leading-6">{message}</Text>
    </View>
  );
}
