import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { search } from '../api';

export type SearchType = 'all' | 'users' | 'snaps';
export type TimeFilter = '1m' | '3m' | '1y' | 'all';

export function useSearch(query: string, type: SearchType = 'all', time: TimeFilter = '1y') {
  // Query for users
  const usersQuery = useQuery({
    queryKey: ['search', 'users', query],
    queryFn: () => search({ q: query, type: 'users', time: 'all' }), // Users search is usually all-time
    enabled: !!query && (type === 'all' || type === 'users'),
  });

  // Infinite query for snaps
  const snapsQuery = useInfiniteQuery({
    queryKey: ['search', 'snaps', query, time],
    queryFn: ({ pageParam = 1 }) => search({ q: query, type: 'snaps', time, page: pageParam as number }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: any) => {
      if (lastPage?.pagination?.hasNextPage) {
        return lastPage.pagination.currentPage + 1;
      }
      return undefined;
    },
    enabled: !!query && (type === 'all' || type === 'snaps'),
  });

  const isLoading = ( (type === 'all' || type === 'users') && usersQuery.isLoading) || 
                    ( (type === 'all' || type === 'snaps') && snapsQuery.isLoading);

  return {
    users: (usersQuery.data?.success && usersQuery.data.data?.users) ? usersQuery.data.data.users : [],
    isUsersLoading: usersQuery.isLoading,
    snaps: snapsQuery.data?.pages.flatMap(page => page?.data?.snaps || []) || [],
    isSnapsLoading: snapsQuery.isLoading,
    isSnapsFetchingNextPage: snapsQuery.isFetchingNextPage,
    loadMoreSnaps: snapsQuery.fetchNextPage,
    hasMoreSnaps: snapsQuery.hasNextPage,
    isLoading,
    refresh: () => {
      if (type === 'all' || type === 'users') usersQuery.refetch();
      if (type === 'all' || type === 'snaps') snapsQuery.refetch();
    }
  };
}
