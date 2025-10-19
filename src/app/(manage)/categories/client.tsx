'use client'

/**
 * CODE INSIGHT
 * This client component renders Categories list with SWR fetching from /api/categories, and offline/demo fallback using localForage.
 * It supports: favorite toggle (PATCH), delete with confirmation (DELETE), optimistic UI, and demo seeding when no server session.
 */

import useSWR from 'swr'
import localforage from 'localforage'
import { v4 as uuidv4 } from 'uuid'
import Link from 'next/link'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

// Types aligned with DB plus optional demo-only UI fields
interface Category {
  id: string
  name: string
  is_favorite: boolean
  created_at?: string
  updated_at?: string
  // demo-only extras
  icon?: string
  color?: string
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    const err: any = new Error('Failed to fetch')
    err.status = res.status
    err.info = await res.text()
    throw err
  }
  return (await res.json()) as Category[]
}

const LF_KEY = 'tris.categories'

function stringToColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const h = Math.abs(hash) % 360
  return `hsl(${h}, 75%, 60%)`
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] || ''
  const second = parts[1]?.[0] || ''
  return (first + second).toUpperCase()
}

function seedCategories(): Category[] {
  const now = new Date().toISOString()
  return [
    { id: uuidv4(), name: '식비', is_favorite: true, icon: '🍜', color: '#ef4444', created_at: now, updated_at: now },
    { id: uuidv4(), name: '교통', is_favorite: true, icon: '🚇', color: '#3b82f6', created_at: now, updated_at: now },
    { id: uuidv4(), name: '장보기', is_favorite: false, icon: '🛒', color: '#22c55e', created_at: now, updated_at: now },
    { id: uuidv4(), name: '주거', is_favorite: false, icon: '🏠', color: '#6366f1', created_at: now, updated_at: now },
    { id: uuidv4(), name: '커피', is_favorite: true, icon: '☕️', color: '#f59e0b', created_at: now, updated_at: now },
  ]
}

export default function CategoriesClient() {
  const router = useRouter()
  const { data, error, isLoading, mutate } = useSWR<Category[]>('/api/categories', fetcher, {
    shouldRetryOnError: false,
    revalidateOnFocus: true,
  })

  const [demoMode, setDemoMode] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  const sorted = useMemo(() => {
    const list = (data ?? []).slice()
    list.sort((a, b) => (Number(b.is_favorite) - Number(a.is_favorite)) || a.name.localeCompare(b.name))
    return list
  }, [data])

  const ensureLocalSeeded = useCallback(async () => {
    await localforage.config({ name: 'tris', storeName: 'tris' })
    const existing = await localforage.getItem<Category[]>(LF_KEY)
    if (!existing || existing.length === 0) {
      await localforage.setItem(LF_KEY, seedCategories())
    }
  }, [])

  const loadLocalAsFallback = useCallback(async () => {
    try {
      await ensureLocalSeeded()
      const local = (await localforage.getItem<Category[]>(LF_KEY)) || []
      setDemoMode(true)
      await mutate(local, false)
    } catch (e) {
      setErrMsg('오프라인 데이터를 불러오지 못했어요. 다시 시도해 주세요.')
    }
  }, [ensureLocalSeeded, mutate])

  useEffect(() => {
    if (error) {
      // Unauthorized or network error -> demo mode fallback
      loadLocalAsFallback()
    }
  }, [error, loadLocalAsFallback])

  useEffect(() => {
    // If initially offline, prime demo data quickly
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      loadLocalAsFallback()
    }
  }, [loadLocalAsFallback])

  const upsertLocal = async (next: Category[]) => {
    await localforage.setItem(LF_KEY, next)
  }

  const handleToggleFavorite = async (cat: Category) => {
    if (!cat?.id) return
    setErrMsg(null)
    setBusyId(cat.id)
    const previous = data ? [...data] : []
    const nextFav = !cat.is_favorite
    const optimistic = (data || []).map((c) => (c.id === cat.id ? { ...c, is_favorite: nextFav } : c))
    await mutate(optimistic, false)

    try {
      const res = await fetch(`/api/categories/${cat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_favorite: nextFav }),
      })

      if (!res.ok) {
        if (res.status === 401) {
          // Offline/demo write
          const local = (await localforage.getItem<Category[]>(LF_KEY)) || []
          const patched = local.map((c) => (c.id === cat.id ? { ...c, is_favorite: nextFav } : c))
          await upsertLocal(patched)
          setDemoMode(true)
        } else {
          throw new Error((await res.text()) || '즐겨찾기 변경에 실패했어요')
        }
      }
    } catch (e: any) {
      setErrMsg(e?.message || '즐겨찾기 변경 중 오류가 발생했어요')
      await mutate(previous, false)
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (cat: Category) => {
    if (!cat?.id) return
    setErrMsg(null)
    const confirmed = window.confirm(`카테고리 \"${cat.name}\"를 삭제할까요? 이 작업은 되돌릴 수 없어요.`)
    if (!confirmed) return

    setBusyId(cat.id)
    const previous = data ? [...data] : []
    const optimistic = (data || []).filter((c) => c.id !== cat.id)
    await mutate(optimistic, false)

    try {
      const res = await fetch(`/api/categories/${cat.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!res.ok) {
        if (res.status === 401) {
          // Offline/demo delete
          const local = (await localforage.getItem<Category[]>(LF_KEY)) || []
          const filtered = local.filter((c) => c.id !== cat.id)
          await upsertLocal(filtered)
          setDemoMode(true)
        } else if (res.status === 409) {
          const msg = (await res.text()) || '이 카테고리는 프리셋에서 사용 중이어서 삭제할 수 없어요.'
          setErrMsg(msg)
          await mutate(previous, false)
        } else {
          throw new Error((await res.text()) || '카테고리 삭제에 실패했어요')
        }
      }
    } catch (e: any) {
      setErrMsg(e?.message || '카테고리 삭제 중 오류가 발생했어요')
      await mutate(previous, false)
    } finally {
      setBusyId(null)
    }
  }

  const items = sorted

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">카테고리</h1>
          <p className="text-sm text-muted-foreground">자주 쓰는 항목은 별표로 고정하세요.</p>
        </div>
        <Link
          href="/(manage)/categories/new"
          className="inline-flex items-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 active:scale-[0.99] transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="mr-1.5 h-4 w-4"><path d="M12 5a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6a1 1 0 0 1 1-1Z"/></svg>
          새 카테고리
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <Link href="/(manage)/tags" className="rounded-full border border-border px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition">태그 관리</Link>
        <Link href="/(manage)/presets" className="rounded-full border border-border px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition">프리셋 관리</Link>
      </div>

      {demoMode && (
        <div className="mt-4">
          <Alert className="border-dashed">
            <AlertTitle>데모 모드</AlertTitle>
            <AlertDescription>오프라인 또는 인증되지 않아 로컬에 임시로 저장돼요.</AlertDescription>
          </Alert>
        </div>
      )}

      {errMsg && (
        <div className="mt-3">
          <Alert variant="destructive">
            <AlertTitle>문제가 발생했어요</AlertTitle>
            <AlertDescription>{errMsg}</AlertDescription>
          </Alert>
        </div>
      )}

      <Separator className="my-5" />

      {isLoading && !data && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-8 w-16 rounded-md" />
                <Skeleton className="h-8 w-16 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && items && items.length === 0 && (
        <div className="mt-10 grid place-items-center text-center">
          <div className="rounded-xl border border-dashed border-border p-8">
            <p className="text-muted-foreground">아직 카테고리가 없어요. 상단의 \"새 카테고리\" 버튼으로 시작해 보세요.</p>
          </div>
        </div>
      )}

      {!isLoading && items && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((c) => {
            const color = c.color || stringToColor(c.name)
            const initials = getInitials(c.name)
            return (
              <li key={c.id} className="rounded-xl border border-border bg-card p-3 shadow-sm transition hover:shadow">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative h-10 w-10 shrink-0 rounded-full" style={{ backgroundColor: color }}>
                      <div className="absolute inset-0 grid place-items-center text-sm font-semibold text-white/95 select-none">
                        {c.icon ? c.icon : initials}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-base font-medium">{c.name}</span>
                        {c.is_favorite && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-300/20 dark:text-amber-200">즐겨찾기</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">빠른 입력과 예산에 사용돼요</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(c)}
                      disabled={busyId === c.id}
                      aria-label={c.is_favorite ? '즐겨찾기 해제' : '즐겨찾기 설정'}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-border transition ${c.is_favorite ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-300/10 dark:text-amber-300' : 'hover:bg-accent'}`}
                    >
                      {c.is_favorite ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                          <path d="M12 .587l3.668 7.431 8.2 1.193-5.934 5.787 1.401 8.165L12 18.897l-7.335 3.866 1.401-8.165L.132 9.211l8.2-1.193L12 .587z"/>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                          <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                        </svg>
                      )}
                    </button>
                    <Link
                      href={`/(manage)/categories/${c.id}/edit`}
                      className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm hover:bg-accent transition"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/><path d="M14.06 4.94l3.75 3.75"/></svg>
                      편집
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(c)}
                      disabled={busyId === c.id}
                      className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm text-destructive hover:bg-destructive/10 transition"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M9 3a1 1 0 0 0-1 1v1H4a1 1 0 1 0 0 2h.77l.86 12.04A2 2 0 0 0 7.62 22h8.76a2 2 0 0 0 1.99-1.96L19.23 7H20a1 1 0 1 0 0-2h-4V4a1 1 0 0 0-1-1H9zm2 4a1 1 0 0 0-1 1v9a1 1 0 1 0 2 0V8a1 1 0 0 0-1-1zm4 0a1 1 0 0 0-1 1v9a1 1 0 1 0 2 0V8a1 1 0 0 0-1-1z"/></svg>
                      삭제
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="h-16" />
    </div>
  )
}
