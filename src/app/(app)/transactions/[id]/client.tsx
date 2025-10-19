'use client'

import { useMemo, useState } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import { useRouter } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/utils/utils'

type Props = { id: string }

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err: any = new Error('Failed to load transaction')
    err.status = res.status
    err.body = text
    throw err
  }
  return res.json()
}

function formatKRW(value: number | string | null | undefined) {
  const num = typeof value === 'string' ? Number(value) : value ?? 0
  try {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(Number(num))
  } catch {
    return `${num}원`
  }
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export default function Client({ id }: Props) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const { data, error, isLoading, mutate } = useSWR(`/api/demo/transactions/${encodeURIComponent(id)}`, fetcher)

  const txn = data as any | undefined

  const amount = useMemo(() => formatKRW(txn?.amount ?? txn?.total ?? 0), [txn])
  const occurredAt = useMemo(() => formatDate(txn?.occurred_at ?? txn?.date ?? txn?.created_at ?? null), [txn])
  const category = txn?.category?.name ?? txn?.category_name ?? txn?.category ?? 'Uncategorized'
  const payee = txn?.payee ?? '—'
  const method = txn?.payment_method ?? txn?.method ?? txn?.paymentMethod ?? '—'
  const notes = txn?.notes ?? ''
  const receiptUrl = txn?.receipt_url ?? txn?.receiptUrl ?? txn?.receipt ?? null

  const handleDelete = async () => {
    if (deleting) return
    const ok = window.confirm('정말로 이 내역을 삭제할까요? 이 작업은 취소할 수 없습니다.')
    if (!ok) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/demo/transactions/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        throw new Error('Delete failed')
      }
      // Revalidate any transactions lists
      globalMutate((key) => Array.isArray(key) && key[0] === 'transactions')
      router.push('/transactions?deleted=1')
    } catch (e) {
      setDeleting(false)
      alert('삭제에 실패했습니다. 네트워크 상태를 확인 후 다시 시도해주세요.')
    }
  }

  const handleEdit = () => {
    alert('Edit is coming soon.')
  }

  if (error) {
    // If API reported 404 client-side as well, show inline guidance (server already handles segment notFound)
    const status = (error as any)?.status
    return (
      <div className="space-y-4">
        <Alert variant="destructive" role="alert">
          <AlertTitle>불러오기에 실패했습니다</AlertTitle>
          <AlertDescription>
            {status === 404 ? '해당 거래를 찾을 수 없습니다.' : '네트워크 오류 또는 서버 오류가 발생했습니다.'}
          </AlertDescription>
        </Alert>
        <div className="flex items-center gap-3">
          <button
            onClick={() => mutate()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            다시 시도
          </button>
          <button
            onClick={() => router.push('/transactions')}
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 transition-colors hover:bg-muted"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-baseline justify-between">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-8 w-24" />
          </div>
          <Separator className="my-4" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-48" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-40" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-28" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-52" />
            </div>
          </div>
          <Separator className="my-4" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">금액</div>
              <div className="mt-1 text-3xl font-semibold text-foreground">{amount}</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleEdit}
                className="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted"
                aria-label="Edit transaction"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={cn(
                  'inline-flex items-center justify-center rounded-md bg-destructive px-3 py-2 text-sm text-destructive-foreground shadow-sm transition-all',
                  'hover:bg-destructive/90 disabled:opacity-60 disabled:cursor-not-allowed'
                )}
                aria-label="Delete transaction"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">날짜/시간</div>
              <div className="mt-1 text-base">{occurredAt}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">카테고리</div>
              <div className="mt-1 inline-flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">{category}</span>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">결제 수단</div>
              <div className="mt-1 inline-flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs">{method}</span>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">가맹점/수취인</div>
              <div className="mt-1 text-base">{payee || '—'}</div>
            </div>
          </div>

          <Separator className="my-4" />

          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">메모</div>
            {notes ? (
              <Collapsible>
                <div className="mt-1 line-clamp-2 text-pretty text-base text-foreground/90">
                  {notes}
                </div>
                <CollapsibleContent forceMount>
                  <div className="mt-2 text-pretty text-base text-foreground/90">{notes}</div>
                </CollapsibleContent>
                <CollapsibleTrigger asChild>
                  <button className="mt-2 text-sm text-primary hover:underline">자세히 보기</button>
                </CollapsibleTrigger>
              </Collapsible>
            ) : (
              <div className="mt-1 text-base">—</div>
            )}
          </div>

          {receiptUrl ? (
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">영수증</div>
              <a
                href={receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center text-sm text-primary hover:underline"
              >
                View receipt
              </a>
            </div>
          ) : null}
        </div>
      )}

      <div aria-live="polite" aria-atomic="true" className="sr-only" />
    </div>
  )
}
