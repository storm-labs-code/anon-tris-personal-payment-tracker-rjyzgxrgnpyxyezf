'use client'

/**
 * CODE INSIGHT
 * This client component renders the drilldown transactions list with infinite scrolling, filter chips synced to URL, and sort controls.
 * It fetches from /api/reports/drilldown using current search params and subscribes to Supabase Realtime to auto-refresh.
 * UI is mobile-first, sleek, with subtle transitions and KRW formatting for clarity.
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import useSWRInfinite from 'swr/infinite';
import { supabaseBrowser } from '@/utils/supabase/client-browser';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/utils/utils';

const PAGE_SIZE = 20;

type TransactionDTO = {
  id: string;
  amount: number;
  occurred_at: string; // ISO
  category_id: string | null;
  category_name?: string | null;
  payee?: string | null;
  payment_method: string;
  notes?: string | null;
};

type DrilldownResponse = {
  items: TransactionDTO[];
  nextPage: number | null;
};

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || 'Failed to load');
  }
  return (await res.json()) as DrilldownResponse;
};

function useTimezoneParam(current: string | null) {
  return React.useMemo(() => current || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul', [current]);
}

function formatKRW(amount: number) {
  try {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount.toLocaleString('ko-KR')}원`;
  }
}

function formatDateTime(dateISO: string, tz: string) {
  try {
    const d = new Date(dateISO);
    return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: tz }).format(d);
  } catch {
    return dateISO;
  }
}

function useCategoryMap() {
  const [map, setMap] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabaseBrowser.from('categories').select('id,name');
      if (!mounted) return;
      if (!error && data) {
        const next: Record<string, string> = {};
        for (const c of data as { id: string; name: string }[]) next[c.id] = c.name;
        setMap(next);
      }
    })();

    // Listen for category changes to keep names fresh
    (async () => {
      const { data: auth } = await supabaseBrowser.auth.getUser();
      const uid = auth.user?.id;
      const channel = supabaseBrowser
        .channel('reports-categories-updates')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'categories', filter: uid ? `user_id=eq.${uid}` : undefined },
          () => {
            // refetch categories
            supabaseBrowser
              .from('categories')
              .select('id,name')
              .then(({ data, error }) => {
                if (!mounted) return;
                if (!error && data) {
                  const next: Record<string, string> = {};
                  for (const c of data as { id: string; name: string }[]) next[c.id] = c.name;
                  setMap(next);
                }
              });
          }
        )
        .subscribe();

      return () => {
        supabaseBrowser.removeChannel(channel);
      };
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return map;
}

export default function Client() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const categoryIdParam = searchParams.get('categoryId');
  const method = searchParams.get('method');
  const orderBy = searchParams.get('orderBy') || 'date'; // 'date' | 'amount'
  const order = searchParams.get('order') || 'desc'; // 'asc' | 'desc'
  const tz = useTimezoneParam(searchParams.get('tz'));

  const categoryIds = React.useMemo(() => (categoryIdParam ? categoryIdParam.split(',').filter(Boolean) : []), [categoryIdParam]);
  const categoryMap = useCategoryMap();

  const getKey = (pageIndex: number, previousPageData: DrilldownResponse | null) => {
    if (!start || !end) return null; // require date range
    if (previousPageData && previousPageData.nextPage === null) return null;
    const page = previousPageData?.nextPage ?? pageIndex + 1;

    const params = new URLSearchParams();
    params.set('start', start);
    params.set('end', end);
    if (categoryIdParam) params.set('categoryId', categoryIdParam);
    if (method) params.set('method', method);
    if (orderBy) params.set('orderBy', orderBy);
    if (order) params.set('order', order);
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    params.set('tz', tz);

    return `/api/reports/drilldown?${params.toString()}`;
  };

  const { data, error, isLoading, size, setSize, mutate, isValidating } = useSWRInfinite<DrilldownResponse>(getKey, fetcher, {
    revalidateOnFocus: true,
    revalidateFirstPage: true,
  });

  const items = React.useMemo(() => (data ? data.flatMap((d) => d.items) : []), [data]);

  const isLoadingInitial = isLoading && !data;
  const isLoadingMore = isValidating && data && data[data.length - 1] === undefined;
  const isEmpty = !isLoading && items.length === 0;
  const isReachingEnd = React.useMemo(() => (data ? data[data.length - 1]?.nextPage === null : false), [data]);

  // Realtime: invalidate on transactions changes for this user
  React.useEffect(() => {
    let active = true;
    (async () => {
      const { data: auth } = await supabaseBrowser.auth.getUser();
      if (!active) return;
      const uid = auth.user?.id;
      const channel = supabaseBrowser
        .channel('reports-drilldown-transactions')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'transactions', filter: uid ? `user_id=eq.${uid}` : undefined },
          () => {
            mutate();
          }
        )
        .subscribe();

      return () => {
        supabaseBrowser.removeChannel(channel);
      };
    })();

    return () => {
      active = false;
    };
  }, [mutate]);

  // Infinite scroll sentinel
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !isLoadingInitial && !isLoadingMore && !isReachingEnd) {
          setSize((s) => s + 1);
        }
      },
      { rootMargin: '100px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isLoadingInitial, isLoadingMore, isReachingEnd, setSize]);

  // URL param helpers
  const updateParams = React.useCallback(
    (updater: (p: URLSearchParams) => void) => {
      const p = new URLSearchParams(searchParams.toString());
      updater(p);
      // ensure tz persists
      if (!p.get('tz')) p.set('tz', tz);
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams, tz]
  );

  const removeCategory = (id: string) => {
    updateParams((p) => {
      const raw = p.get('categoryId');
      if (!raw) return p.delete('categoryId');
      const arr = raw.split(',').filter(Boolean).filter((x) => x !== id);
      if (arr.length) p.set('categoryId', arr.join(','));
      else p.delete('categoryId');
    });
  };

  const clearMethod = () => updateParams((p) => p.delete('method'));

  const setSort = (by: 'date' | 'amount') => {
    updateParams((p) => {
      const currentBy = (p.get('orderBy') || 'date') as 'date' | 'amount';
      const currentOrder = (p.get('order') || 'desc') as 'asc' | 'desc';
      if (currentBy === by) {
        p.set('order', currentOrder === 'desc' ? 'asc' : 'desc');
      } else {
        p.set('orderBy', by);
        p.set('order', 'desc');
      }
    });
  };

  const periodLabel = React.useMemo(() => {
    if (!start || !end) return '기간 선택 필요';
    try {
      const s = new Date(start);
      const e = new Date(end);
      const eDisplay = new Date(e.getTime() - 24 * 60 * 60 * 1000);
      const f = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
      return `${f.format(s)} — ${f.format(eDisplay)}`;
    } catch {
      return `${start} — ${end}`;
    }
  }, [start, end]);

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Top filters summary and sort */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">
            <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
            {periodLabel}
          </span>
          {categoryIds.map((id) => (
            <button
              key={id}
              onClick={() => removeCategory(id)}
              className="group inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors hover:bg-muted"
              aria-label="카테고리 필터 제거"
            >
              <span className="truncate max-w-[10rem]">{categoryMap[id] || '분류 없음'}</span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">카테고리</span>
              <svg className="h-4 w-4 text-muted-foreground group-hover:text-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          ))}
          {method && (
            <button
              onClick={clearMethod}
              className="group inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors hover:bg-muted"
              aria-label="결제수단 필터 제거"
            >
              <span className="truncate max-w-[10rem]">{method}</span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">결제수단</span>
              <svg className="h-4 w-4 text-muted-foreground group-hover:text-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">총 {isLoading ? '…' : items.length.toLocaleString('ko-KR')} 건</div>
          <div className="inline-flex overflow-hidden rounded-lg border border-input bg-background shadow-sm">
            <button
              onClick={() => setSort('date')}
              className={cn(
                'px-3 py-2 text-sm transition-colors',
                orderBy === 'date' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              )}
              aria-pressed={orderBy === 'date'}
            >
              날짜 {orderBy === 'date' ? (order === 'desc' ? '↓' : '↑') : ''}
            </button>
            <Separator orientation="vertical" decorative className="h-8" />
            <button
              onClick={() => setSort('amount')}
              className={cn(
                'px-3 py-2 text-sm transition-colors',
                orderBy === 'amount' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              )}
              aria-pressed={orderBy === 'amount'}
            >
              금액 {orderBy === 'amount' ? (order === 'desc' ? '↓' : '↑') : ''}
            </button>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="flex flex-col gap-2">
        {error && (
          <Alert variant="destructive" className="border-destructive/40 bg-destructive/10">
            <AlertTitle>불러오기 실패</AlertTitle>
            <AlertDescription className="mt-1">
              데이터를 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.
              <div className="mt-3">
                <button
                  onClick={() => mutate()}
                  className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                >
                  다시 시도
                </button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {isLoadingInitial && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoadingInitial && isEmpty && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            조건에 해당하는 내역이 없습니다.
            <div className="mt-3">
              <Link href="/transactions/new" className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">
                새 거래 추가
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              </Link>
            </div>
          </div>
        )}

        <ul className="flex flex-col gap-2">
          {items.map((t) => (
            <li key={t.id} className="group relative overflow-hidden rounded-xl border border-border bg-card transition hover:shadow-md">
              <Link href={`/transactions/${t.id}`} className="block p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-chart-1" aria-hidden />
                      <span className="truncate text-sm font-medium text-foreground">
                        {t.payee || categoryMap[t.category_id || ''] || t.category_name || '내역'}
                      </span>
                    </div>
                    <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {formatDateTime(t.occurred_at, tz)} · {t.payment_method}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-semibold tracking-tight text-foreground">{formatKRW(t.amount)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {t.category_id ? categoryMap[t.category_id] || t.category_name || '카테고리' : '분류 없음'}
                    </div>
                  </div>
                </div>
              </Link>
              <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              </div>
            </li>
          ))}
        </ul>

        {/* Load more controls */}
        {!isReachingEnd && !isEmpty && (
          <div className="mt-2 flex justify-center">
            <button
              onClick={() => setSize(size + 1)}
              className="rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground shadow-sm transition-colors hover:bg-muted"
            >
              {isLoadingMore ? '불러오는 중…' : '더 불러오기'}
            </button>
          </div>
        )}
        <div ref={sentinelRef} aria-hidden className="h-1 w-full" />
      </section>
    </div>
  );
}
