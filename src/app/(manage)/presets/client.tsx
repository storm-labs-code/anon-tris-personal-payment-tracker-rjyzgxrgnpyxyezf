'use client'

import useSWR, { mutate as globalMutate } from 'swr'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import localforage from 'localforage'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/utils/utils'

// Types
interface Preset {
  id: string
  name: string
  amount?: number | string | null
  category_id?: string | null
  category_name?: string | null
  payee?: string | null
  payment_method?: string | null
  notes?: string | null
  is_favorite: boolean
  default_tag_names?: string[]
}

const SWR_KEY = '/api/presets'

const fetcher = async (url: string) => {
  try {
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) {
      const err: any = new Error('HTTPError')
      err.status = res.status
      throw err
    }
    return res.json()
  } catch (e: any) {
    throw e
  }
}

function formatKRW(value?: string | number | null) {
  if (value === null || value === undefined) return null
  let num: number
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10)
    if (Number.isNaN(parsed)) return null
    num = parsed
  } else {
    num = value
  }
  try {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0,
    }).format(num)
  } catch {
    return `₩${num.toLocaleString('ko-KR')}`
  }
}

async function ensureLocalSeeds() {
  const presets = (await localforage.getItem<Preset[]>('tris.presets')) || []
  if (presets.length > 0) return presets

  const nowId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  const coffeeId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  const transitId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)

  const seeded: Preset[] = [
    {
      id: nowId,
      name: '점심 기본',
      amount: 9000,
      category_id: null,
      category_name: '식비',
      payee: '회사 식당',
      payment_method: null,
      notes: '간단 식사',
      is_favorite: true,
      default_tag_names: ['점심', '식비'],
    },
    {
      id: coffeeId,
      name: '아침 커피',
      amount: 4500,
      category_id: null,
      category_name: '카페/간식',
      payee: '스타벅스',
      payment_method: null,
      notes: null,
      is_favorite: true,
      default_tag_names: ['커피'],
    },
    {
      id: transitId,
      name: '대중교통',
      amount: 1400,
      category_id: null,
      category_name: '교통',
      payee: 'T-money',
      payment_method: null,
      notes: '출근',
      is_favorite: false,
      default_tag_names: ['출근', '교통']
    },
  ]
  await localforage.setItem('tris.presets', seeded)

  // Seed tags collection lightly for other flows (no harm if not used here)
  const tags = (await localforage.getItem<{ id: string; name: string }[]>('tris.tags')) || []
  if (tags.length === 0) {
    const makeId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2))
    await localforage.setItem('tris.tags', [
      { id: makeId(), name: '커피' },
      { id: makeId(), name: '점심' },
      { id: makeId(), name: '교통' },
    ])
  }

  return seeded
}

function usePresets() {
  const { data, error, isLoading, mutate } = useSWR<Preset[]>(SWR_KEY, fetcher)
  const [demoMode, setDemoMode] = useState(false)

  useEffect(() => {
    if (!error) return
    const status = (error as any)?.status
    // 401 (unauthenticated) or network/offline fallback
    if (status === 401 || (error as any)?.name === 'TypeError' || !navigator.onLine) {
      ;(async () => {
        setDemoMode(true)
        const seeded = await ensureLocalSeeds()
        mutate(seeded, false)
      })()
    }
  }, [error, mutate])

  // If there is literally no data yet and we're offline, ensure seeds
  useEffect(() => {
    if (!navigator.onLine && !data) {
      ;(async () => {
        setDemoMode(true)
        const seeded = await ensureLocalSeeds()
        mutate(seeded, false)
      })()
    }
  }, [data, mutate])

  const sorted = useMemo(() => {
    const list = data ? [...data] : []
    return list.sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || a.name.localeCompare(b.name))
  }, [data])

  return { presets: sorted, error, isLoading, demoMode, mutate, setDemoMode }
}

function Summary({ preset }: { preset: Preset }) {
  const parts: string[] = []
  const amount = formatKRW(preset.amount ?? null)
  if (amount) parts.push(amount)
  if (preset.category_name) parts.push(preset.category_name)
  else if (preset.category_id) parts.push('카테고리 지정')
  if (preset.payee) parts.push(preset.payee)
  if (preset.default_tag_names && preset.default_tag_names.length) parts.push(`#${preset.default_tag_names.slice(0, 3).join(' #')}`)
  return (
    <p className="text-sm text-muted-foreground truncate" title={parts.join(' · ')}>
      {parts.length ? parts.join(' · ') : '세부 정보 없음'}
    </p>
  )
}

function useSwipe() {
  const startXRef = useRef<number | null>(null)
  const [offset, setOffset] = useState(0)
  const [opened, setOpened] = useState(false)
  const MAX = 120
  const onPointerDown = (e: React.PointerEvent) => {
    startXRef.current = e.clientX
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (startXRef.current == null) return
    const delta = e.clientX - startXRef.current
    if (delta < 0) {
      setOffset(Math.max(-MAX, delta))
    } else {
      setOffset(opened ? -MAX + Math.min(MAX, delta) : Math.min(0, delta))
    }
  }
  const onPointerUp = () => {
    if (startXRef.current == null) return
    const final = offset
    const shouldOpen = final < -MAX / 2
    setOpened(shouldOpen)
    setOffset(shouldOpen ? -MAX : 0)
    startXRef.current = null
  }
  const close = () => {
    setOpened(false)
    setOffset(0)
  }
  return { offset, opened, onPointerDown, onPointerMove, onPointerUp, close }
}

function PresetRow({ preset, onDeleteOptimistic }: { preset: Preset; onDeleteOptimistic: (id: string) => void }) {
  const { offset, opened, onPointerDown, onPointerMove, onPointerUp, close } = useSwipe()

  return (
    <div className="relative select-none">
      <div className="absolute right-0 top-0 h-full flex items-stretch gap-2 pr-2">
        <Link
          href={`/(manage)/presets/${preset.id}/edit`}
          className="my-2 inline-flex items-center justify-center rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground shadow-sm hover:opacity-90"
          aria-label={`${preset.name} 편집`}
        >
          편집
        </Link>
        <button
          className="my-2 inline-flex items-center justify-center rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground shadow-sm hover:opacity-90"
          aria-label={`${preset.name} 삭제`}
          onClick={() => onDeleteOptimistic(preset.id)}
        >
          삭제
        </button>
      </div>
      <div
        className={cn(
          'relative flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-transform',
          'active:scale-[0.99]'
        )}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className={cn('flex h-10 w-10 flex-none items-center justify-center rounded-full text-base font-semibold', preset.is_favorite ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>
          {preset.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold leading-tight">{preset.name}</h3>
            {preset.is_favorite && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">즐겨찾기</span>
            )}
          </div>
          <Summary preset={preset} />
        </div>
        <div className="flex flex-none items-center gap-2">
          <Link
            href={`/transactions/new?presetId=${preset.id}`}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"
            aria-label={`${preset.name} 적용`}
          >
            적용
          </Link>
        </div>
        {opened && (
          <button
            onClick={close}
            className="absolute inset-0 cursor-default"
            aria-label="행동 닫기"
            tabIndex={-1}
            style={{ background: 'transparent' }}
          />
        )}
      </div>
    </div>
  )
}

export default function Client() {
  const { presets, isLoading, demoMode, mutate, setDemoMode } = usePresets()
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; title: string; description?: string } | null>(null)

  const onDelete = async (id: string) => {
    const confirmed = window.confirm('이 프리셋을 삭제할까요? 이 작업은 되돌릴 수 없습니다.')
    if (!confirmed) return

    const previous = presets || []
    // Optimistic UI
    mutate(previous.filter((p) => p.id !== id), false)

    try {
      const res = await fetch(`/api/presets/${id}`, { method: 'DELETE', credentials: 'include' })
      if (res.status === 204) {
        setMessage({ type: 'success', title: '삭제됨', description: '프리셋이 삭제되었습니다.' })
        // Refetch from server to align
        await (globalMutate as any)(SWR_KEY)
        return
      }
      // 409 Conflict (in use)
      if (res.status === 409) {
        mutate(previous, false) // revert
        const body = await res.json().catch(() => ({} as any))
        setMessage({ type: 'error', title: '삭제할 수 없습니다', description: body?.message || '이 프리셋은 다른 항목에서 사용 중입니다.' })
        return
      }
      if (res.status === 401) {
        // Offline/unauth fallback: delete locally
        const local = ((await localforage.getItem<Preset[]>('tris.presets')) || []).filter((p) => p.id !== id)
        await localforage.setItem('tris.presets', local)
        setDemoMode(true)
        setMessage({ type: 'info', title: '데모 모드에서 삭제됨', description: '오프라인 상태여서 로컬 데이터에서 삭제했습니다.' })
        mutate(local, false)
        return
      }
      // Other errors
      mutate(previous, false)
      setMessage({ type: 'error', title: '삭제 실패', description: '잠시 후 다시 시도하세요.' })
    } catch (e) {
      // Network/offline: delete locally
      const local = ((await localforage.getItem<Preset[]>('tris.presets')) || []).filter((p) => p.id !== id)
      await localforage.setItem('tris.presets', local)
      setDemoMode(true)
      setMessage({ type: 'info', title: '오프라인 삭제', description: '네트워크 문제로 로컬에서 삭제되었습니다.' })
      mutate(local, false)
    }
  }

  const EmptyState = (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-10 text-center">
      <div className="mb-3 text-5xl">🧮</div>
      <h3 className="mb-1 text-lg font-semibold">아직 프리셋이 없습니다</h3>
      <p className="mb-6 text-sm text-muted-foreground">자주 쓰는 지출을 프리셋으로 만들어 빠르게 기록하세요.</p>
      <Link href="/(manage)/presets/new" className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90">
        새 프리셋 만들기
      </Link>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">프리셋</h1>
          <p className="text-sm text-muted-foreground">자주 쓰는 결제를 빠르게 입력할 수 있도록 기본값을 저장합니다.</p>
        </div>
        <Link href="/(manage)/presets/new" className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90">
          새 프리셋
        </Link>
      </div>

      {demoMode && (
        <Alert className="border-primary/30 bg-primary/5">
          <AlertTitle>데모 모드: 로컬 저장소 사용 중</AlertTitle>
          <AlertDescription>
            오프라인이거나 로그인이 필요합니다. 데이터는 이 기기에만 저장됩니다.
          </AlertDescription>
        </Alert>
      )}

      {message && (
        <Alert
          className={cn('transition-all',
            message.type === 'error' ? 'border-destructive/50 bg-destructive/10' : message.type === 'success' ? 'border-emerald-600/40 bg-emerald-500/10' : 'border-secondary/40 bg-secondary/10'
          )}
        >
          <AlertTitle>{message.title}</AlertTitle>
          {message.description && <AlertDescription>{message.description}</AlertDescription>}
        </Alert>
      )}

      <Separator />

      {isLoading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
                <Skeleton className="h-9 w-16 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && presets && presets.length === 0 && EmptyState}

      {!isLoading && presets && presets.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          {presets.map((p) => (
            <PresetRow key={p.id} preset={p} onDeleteOptimistic={onDelete} />
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <div>
          필요시 카테고리/태그를 먼저 정리하세요.
        </div>
        <div className="flex items-center gap-3">
          <Link href="/(manage)/categories" className="underline-offset-4 hover:underline">카테고리 관리</Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/(manage)/tags" className="underline-offset-4 hover:underline">태그 관리</Link>
        </div>
      </div>
    </div>
  )
}
