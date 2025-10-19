'use client'

/**
 * CODE INSIGHT
 * This code's use case is a client-side page that lists, creates, renames, and deletes tags with search and offline fallback.
 * This code's full epic context is to adhere to the data flow: SWR GET /api/tags with debounced search, POST/PUT/DELETE mutations, and localForage fallback on 401/offline.
 * This code's ui feel is sleek and focused with mobile-first layout, subtle animations, and clear feedback via alerts and inline states.
 */

import React from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import localforage from 'localforage'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

// Types
interface Tag {
  id: string
  name: string
  is_favorite?: boolean
  usage_count?: number
  created_at?: string
  updated_at?: string
}

const TAGS_KEY = 'tris.tags'

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    const err: any = new Error('Request failed')
    err.status = res.status
    err.info = await res.text().catch(() => '')
    throw err
  }
  return res.json()
}

function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

async function seedLocalIfEmpty() {
  const existing = (await localforage.getItem<Tag[]>(TAGS_KEY)) || []
  if (existing.length > 0) return existing
  const now = new Date().toISOString()
  const seed: Tag[] = [
    { id: crypto.randomUUID(), name: '식비', created_at: now, updated_at: now },
    { id: crypto.randomUUID(), name: '교통', created_at: now, updated_at: now },
    { id: crypto.randomUUID(), name: '카페', created_at: now, updated_at: now },
    { id: crypto.randomUUID(), name: '쇼핑', created_at: now, updated_at: now },
    { id: crypto.randomUUID(), name: '청구서', created_at: now, updated_at: now },
    { id: crypto.randomUUID(), name: '구독', created_at: now, updated_at: now },
  ]
  await localforage.setItem(TAGS_KEY, seed)
  return seed
}

export default function TagsPage() {
  const router = useRouter()
  const [query, setQuery] = React.useState('')
  const debouncedQuery = useDebounced(query)
  const [demoMode, setDemoMode] = React.useState(false)
  const [localTags, setLocalTags] = React.useState<Tag[] | null>(null)
  const [creating, setCreating] = React.useState(false)
  const [newName, setNewName] = React.useState('')
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editValue, setEditValue] = React.useState('')
  const [savingId, setSavingId] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  React.useEffect(() => {
    seedLocalIfEmpty().then(setLocalTags).catch(() => setLocalTags([]))
  }, [])

  const key = React.useMemo(() => `/api/tags${debouncedQuery ? `?search=${encodeURIComponent(debouncedQuery)}` : ''}`,[debouncedQuery])
  const { data, error, isLoading, mutate } = useSWR<Tag[]>(key, fetcher)

  React.useEffect(() => {
    if (error && ((error as any).status === 401 || !navigator.onLine)) {
      setDemoMode(true)
    } else if (error) {
      // Consider any network failure as offline fallback
      setDemoMode(true)
    } else {
      setDemoMode(false)
    }
  }, [error])

  const displayedTags: Tag[] | undefined = React.useMemo(() => {
    if (demoMode) {
      const list = localTags || []
      if (!debouncedQuery) return list
      const q = debouncedQuery.toLowerCase()
      return list.filter(t => t.name.toLowerCase().includes(q))
    }
    return data
  }, [demoMode, localTags, data, debouncedQuery])

  const refreshLocal = async (updater: (prev: Tag[]) => Tag[]) => {
    const current = (await localforage.getItem<Tag[]>(TAGS_KEY)) || []
    const next = updater(current)
    await localforage.setItem(TAGS_KEY, next)
    setLocalTags(next)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    const name = newName.trim()
    if (!name) {
      setErrorMsg('태그 이름을 입력하세요.')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        setNewName('')
        await mutate()
        setErrorMsg(null)
        return
      }
      if (res.status === 409) {
        setErrorMsg('이미 존재하는 태그입니다.')
        return
      }
      if (res.status === 401) throw new Error('unauth')
      // Other server error: surface minimal info
      const text = await res.text()
      setErrorMsg(text || '태그 생성 중 오류가 발생했습니다.')
    } catch {
      // Offline/401: local fallback
      setDemoMode(true)
      await refreshLocal(prev => {
        if (prev.some(t => t.name.toLowerCase() === name.toLowerCase())) {
          setErrorMsg('이미 존재하는 태그입니다.')
          return prev
        }
        const now = new Date().toISOString()
        return [{ id: crypto.randomUUID(), name, created_at: now, updated_at: now }, ...prev]
      })
      setNewName('')
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id)
    setEditValue(tag.name)
    setErrorMsg(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValue('')
  }

  const submitRename = async (tag: Tag) => {
    const next = editValue.trim()
    if (!next || next === tag.name) {
      cancelEdit()
      return
    }
    setSavingId(tag.id)
    try {
      const res = await fetch(`/api/tags/${tag.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: next }),
      })
      if (res.ok) {
        await mutate(current => {
          if (!current) return current
          return current.map(t => (t.id === tag.id ? { ...t, name: next } : t))
        }, { revalidate: false })
        cancelEdit()
        return
      }
      if (res.status === 409) {
        setErrorMsg('이미 존재하는 태그입니다.')
        return
      }
      if (res.status === 401) throw new Error('unauth')
      setErrorMsg('이름 변경에 실패했습니다.')
    } catch {
      // Offline fallback
      setDemoMode(true)
      await refreshLocal(prev => prev.map(t => (t.id === tag.id ? { ...t, name: next, updated_at: new Date().toISOString() } : t)))
      cancelEdit()
    } finally {
      setSavingId(null)
    }
  }

  const handleDelete = async (tag: Tag) => {
    if (!confirm(`태그 \"${tag.name}\"을(를) 삭제할까요?`)) return
    setDeletingId(tag.id)
    try {
      const res = await fetch(`/api/tags/${tag.id}`, { method: 'DELETE', credentials: 'include' })
      if (res.status === 204 || res.ok) {
        await mutate(current => (current ? current.filter(t => t.id !== tag.id) : current), { revalidate: false })
        return
      }
      if (res.status === 401) throw new Error('unauth')
      setErrorMsg('삭제에 실패했습니다.')
    } catch {
      // Offline fallback
      setDemoMode(true)
      await refreshLocal(prev => prev.filter(t => t.id !== tag.id))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <main className="px-4 pb-24 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">태그 관리</h1>
            <p className="mt-1 text-sm text-muted-foreground">자주 쓰는 태그를 추가하고 이름을 관리하세요.</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link href="/(manage)/categories" className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-accent hover:text-accent-foreground transition-colors">카테고리</Link>
            <Link href="/(manage)/presets" className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-accent hover:text-accent-foreground transition-colors">프리셋</Link>
          </div>
        </div>

        {demoMode && (
          <Alert variant="secondary" className="mt-4">
            <AlertTitle className="font-medium">데모 모드</AlertTitle>
            <AlertDescription>서버에 연결되지 않아 데이터가 기기에만 저장됩니다.</AlertDescription>
          </Alert>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="태그 검색"
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none ring-offset-background transition focus:ring-2 focus:ring-primary"
              aria-label="태그 검색"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                aria-label="검색 지우기"
              >
                지우기
              </button>
            )}
          </div>
          <form onSubmit={handleCreate} className="flex items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="새 태그 이름"
              className="flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none ring-offset-background transition focus:ring-2 focus:ring-primary"
              aria-label="새 태그 이름"
            />
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-95 disabled:opacity-50"
            >
              {creating ? '추가 중...' : '+ 추가'}
            </button>
          </form>
        </div>

        {errorMsg && (
          <Alert variant="destructive" className="mt-3">
            <AlertTitle className="font-medium">문제가 발생했어요</AlertTitle>
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <Separator className="my-4" />

        {isLoading && !displayedTags && (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {displayedTags && displayedTags.length > 0 ? (
            displayedTags.map((tag) => (
              <li key={tag.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {editingId === tag.id ? (
                    <input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          submitRename(tag)
                        } else if (e.key === 'Escape') {
                          cancelEdit()
                        }
                      }}
                      onBlur={() => submitRename(tag)}
                      autoFocus
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-primary"
                      aria-label={`태그 ${tag.name} 이름 편집`}
                    />
                  ) : (
                    <>
                      <span className="truncate text-sm font-medium text-foreground">{tag.name}</span>
                      {typeof tag.usage_count === 'number' && (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{tag.usage_count}</span>
                      )}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {editingId === tag.id ? (
                    <button
                      onClick={cancelEdit}
                      className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground"
                    >
                      취소
                    </button>
                  ) : (
                    <button
                      onClick={() => startEdit(tag)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground"
                    >
                      이름 변경
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(tag)}
                    disabled={deletingId === tag.id}
                    className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:opacity-95 disabled:opacity-50"
                  >
                    {deletingId === tag.id ? '삭제 중...' : '삭제'}
                  </button>
                </div>
              </li>
            ))
          ) : (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">검색 결과가 없습니다.</li>
          )}
        </ul>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          태그는 거래 입력 시 빠른 분류에 사용됩니다.
        </div>
      </div>
    </main>
  )
}
