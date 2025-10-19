'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import localforage from 'localforage'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/utils/utils'

/***** Helpers *****/
const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err: any = new Error(text || `Request failed: ${res.status}`)
    ;(err as any).status = res.status
    throw err
  }
  return res.json()
}

function formatKRW(input: number | null): string {
  if (input == null || Number.isNaN(input)) return ''
  try {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0,
    }).format(input)
  } catch {
    return `${input.toLocaleString('ko-KR')}원`
  }
}

function clampInt(n: number) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.round(n))
}

function hashBg(name: string) {
  // Simple hash to pick a soft background color
  const palette = [
    'bg-blue-50 text-blue-800 ring-blue-200',
    'bg-indigo-50 text-indigo-800 ring-indigo-200',
    'bg-emerald-50 text-emerald-800 ring-emerald-200',
    'bg-teal-50 text-teal-800 ring-teal-200',
    'bg-amber-50 text-amber-900 ring-amber-200',
    'bg-rose-50 text-rose-800 ring-rose-200',
    'bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200',
    'bg-cyan-50 text-cyan-800 ring-cyan-200',
  ] as const
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash << 5) - hash + name.charCodeAt(i)
  const idx = Math.abs(hash) % palette.length
  return palette[idx]
}

/***** Demo seed *****/
const CAT_KEY = 'tris.categories'
const TAG_KEY = 'tris.tags'
const PRESET_KEY = 'tris.presets'
const DRAFT_KEY = 'tris.transactionDraft'

async function ensureDemoSeed() {
  const [cats, tags, presets] = await Promise.all([
    localforage.getItem<any[]>(CAT_KEY),
    localforage.getItem<any[]>(TAG_KEY),
    localforage.getItem<any[]>(PRESET_KEY),
  ])
  const now = new Date()
  if (!cats || cats.length === 0) {
    const foodId = crypto.randomUUID()
    const transitId = crypto.randomUUID()
    const billsId = crypto.randomUUID()
    const seedCats = [
      { id: foodId, name: '식비', is_favorite: true, icon: '🍜', color: '#E0F2FE', created_at: now.toISOString(), updated_at: now.toISOString() },
      { id: transitId, name: '교통', is_favorite: true, icon: '🚇', color: '#ECFDF5', created_at: now.toISOString(), updated_at: now.toISOString() },
      { id: billsId, name: '공과금', is_favorite: false, icon: '💡', color: '#EEF2FF', created_at: now.toISOString(), updated_at: now.toISOString() },
    ]
    await localforage.setItem(CAT_KEY, seedCats)
  }
  if (!tags || tags.length === 0) {
    const seedTags = [
      { id: crypto.randomUUID(), name: '커피', is_favorite: true, created_at: now.toISOString(), updated_at: now.toISOString() },
      { id: crypto.randomUUID(), name: '점심', is_favorite: false, created_at: now.toISOString(), updated_at: now.toISOString() },
      { id: crypto.randomUUID(), name: '버스', is_favorite: false, created_at: now.toISOString(), updated_at: now.toISOString() },
    ]
    await localforage.setItem(TAG_KEY, seedTags)
  }
  if (!presets || presets.length === 0) {
    const catList = (await localforage.getItem<any[]>(CAT_KEY)) || []
    const food = catList.find((c) => c.name === '식비') || catList[0]
    const transit = catList.find((c) => c.name === '교통') || catList[1]
    const seedPresets = [
      { id: crypto.randomUUID(), name: '아침 커피', amount: 4500, category_id: food?.id, payee: '카페', notes: '아메리카노', default_tag_names: ['커피'] },
      { id: crypto.randomUUID(), name: '지하철', amount: 1350, category_id: transit?.id, payee: 'T-money', notes: '', default_tag_names: ['버스'] },
    ]
    await localforage.setItem(PRESET_KEY, seedPresets)
  }
}

/***** Types *****/
interface Category {
  id: string
  name: string
  is_favorite: boolean
  icon?: string
  color?: string
}

interface Preset {
  id: string
  name: string
  amount?: number | null
  category_id?: string | null
  payee?: string | null
  notes?: string | null
  default_tag_names?: string[]
}

const FormSchema = z.object({
  amountText: z.string().min(1, '금액을 입력하세요'),
  date: z.string().min(1, '날짜를 선택하세요'),
  category_id: z.string().optional().nullable(),
  payee: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
})

type FormValues = z.infer<typeof FormSchema>

/***** Component *****/
export function NewTransactionClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const presetId = searchParams.get('presetId') || ''

  const [demoMode, setDemoMode] = useState(false)
  const [serverNotice, setServerNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [appliedPreset, setAppliedPreset] = useState<Preset | null>(null)

  const [categoriesLocal, setCategoriesLocal] = useState<Category[] | null>(null)

  const { data: categoriesServer, error: categoriesError, isLoading: categoriesLoading } = useSWR<Category[]>(
    '/api/categories',
    fetcher,
    { revalidateOnFocus: false }
  )

  const [tagQuery, setTagQuery] = useState('')
  const [localTagSuggestions, setLocalTagSuggestions] = useState<string[]>([])
  const [showTagDropdown, setShowTagDropdown] = useState(false)

  const debouncedQuery = useDebounce(tagQuery, 200)
  const { data: tagServerSuggestions, error: tagError } = useSWR<{ id: string; name: string }[]>(
    debouncedQuery ? `/api/tags?search=${encodeURIComponent(debouncedQuery)}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      amountText: '',
      date: new Date().toISOString().substring(0, 10),
      category_id: undefined,
      payee: '',
      notes: '',
      tags: [],
    },
  })

  const selectedCategoryId = watch('category_id') || undefined
  const selectedTags = watch('tags')
  const amountText = watch('amountText')

  // Seed demo data once if needed
  useEffect(() => {
    ensureDemoSeed()
  }, [])

  // Categories: fallback to local on error
  useEffect(() => {
    if (categoriesError) {
      setDemoMode(true)
      ;(async () => {
        const local = ((await localforage.getItem<Category[]>(CAT_KEY)) || []).map((c) => ({
          id: c.id,
          name: c.name,
          is_favorite: !!(c as any).is_favorite,
          icon: (c as any).icon,
          color: (c as any).color,
        }))
        setCategoriesLocal(local)
      })()
    }
  }, [categoriesError])

  const categories: Category[] = useMemo(() => {
    const src = categoriesServer || categoriesLocal || []
    const fav = src.filter((c) => c.is_favorite)
    const rest = src.filter((c) => !c.is_favorite)
    return [...fav, ...rest]
  }, [categoriesServer, categoriesLocal])

  // Preset application
  useEffect(() => {
    let cancelled = false
    async function applyPreset() {
      if (!presetId) return
      try {
        const res = await fetch(`/api/presets/${presetId}`, { credentials: 'include' })
        if (!res.ok) throw Object.assign(new Error('preset'), { status: res.status })
        const data = await res.json()
        // Try to normalize shape
        const p: Preset = {
          id: data.id,
          name: data.name,
          amount: data.amount ?? null,
          category_id: data.category_id ?? null,
          payee: data.payee ?? '',
          notes: data.notes ?? '',
          default_tag_names: data.default_tag_names ?? data.tags?.map((t: any) => t.name) ?? [],
        }
        if (cancelled) return
        setAppliedPreset(p)
        if (p.amount != null) setValue('amountText', String(p.amount))
        if (p.category_id) setValue('category_id', p.category_id)
        if (p.payee) setValue('payee', p.payee)
        if (p.notes) setValue('notes', p.notes)
        if (p.default_tag_names && p.default_tag_names.length > 0) setValue('tags', Array.from(new Set([...(watch('tags') || []), ...p.default_tag_names])))
      } catch (e: any) {
        // 401 or offline
        setDemoMode(true)
        const presets = ((await localforage.getItem<Preset[]>(PRESET_KEY)) || [])
        const p = presets.find((x) => x.id === presetId)
        if (p && !cancelled) {
          setAppliedPreset(p)
          if (p.amount != null) setValue('amountText', String(p.amount))
          if (p.category_id) setValue('category_id', p.category_id)
          if (p.payee) setValue('payee', p.payee)
          if (p.notes) setValue('notes', p.notes)
          if (p.default_tag_names && p.default_tag_names.length > 0) setValue('tags', Array.from(new Set([...(watch('tags') || []), ...p.default_tag_names])))
        }
      }
    }
    applyPreset()
    return () => {
      cancelled = true
    }
  }, [presetId, setValue, watch])

  // Tag suggestions fallback
  useEffect(() => {
    if (tagError || debouncedQuery) {
      // only compute local suggestions when needed
      if (tagError) setDemoMode(true)
      ;(async () => {
        if (!debouncedQuery) {
          setLocalTagSuggestions([])
          return
        }
        const all: any[] = ((await localforage.getItem<any[]>(TAG_KEY)) || [])
        const list = all
          .map((t) => t.name as string)
          .filter((n) => n.toLowerCase().includes(debouncedQuery.toLowerCase()))
          .slice(0, 20)
        setLocalTagSuggestions(list)
      })()
    }
  }, [tagError, debouncedQuery])

  // Toast system
  const [toast, setToast] = useState<{ id: number; title: string; description?: string } | null>(null)
  const toastIdRef = useRef(0)
  const showToast = useCallback((title: string, description?: string) => {
    const id = ++toastIdRef.current
    setToast({ id, title, description })
    window.setTimeout(() => {
      setToast((t) => (t && t.id === id ? null : t))
    }, 2200)
  }, [])

  // Tag chip actions
  const addTag = useCallback(
    (t: string) => {
      const val = (t || '').trim()
      if (!val) return
      if ((watch('tags') || []).includes(val)) return
      setValue('tags', [ ...(watch('tags') || []), val ])
      setTagQuery('')
      setShowTagDropdown(false)
    },
    [setValue, watch]
  )

  const removeTag = useCallback(
    (t: string) => {
      setValue('tags', (watch('tags') || []).filter((x) => x !== t))
    },
    [setValue, watch]
  )

  // Amount input: keep digits only as text, display formatted preview
  const onAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      const digits = raw.replace(/[^0-9]/g, '')
      setValue('amountText', digits)
    },
    [setValue]
  )

  const amountNumber = useMemo(() => {
    const n = Number(amountText)
    if (!Number.isFinite(n)) return null
    return clampInt(n)
  }, [amountText])

  const onSubmit = handleSubmit(async (values) => {
    setServerNotice(null)
    setSaving(true)
    try {
      const payload = {
        amount: clampInt(Number(values.amountText || 0)),
        occurred_at: new Date(values.date!).toISOString(),
        category_id: values.category_id || null,
        payee: values.payee || null,
        notes: values.notes || null,
        tag_names: values.tags || [],
      }
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      if (res.status === 501) {
        setServerNotice('서버 저장은 다음 에픽에서 제공됩니다. 현재는 로컬 임시 저장만 가능합니다.')
        showToast('서버에 아직 저장할 수 없습니다', '트랜잭션 CRUD 에픽에서 활성화됩니다')
        return
      }
      if (!res.ok) {
        if (res.status === 401) setDemoMode(true)
        const text = await res.text()
        throw new Error(text || 'Failed to save')
      }
      showToast('저장되었습니다')
      reset()
      router.push('/')
    } catch (e: any) {
      showToast('저장 실패', e?.message || '오류가 발생했습니다')
    } finally {
      setSaving(false)
    }
  })

  const saveDraft = useCallback(async () => {
    const current: FormValues = {
      amountText: watch('amountText'),
      date: watch('date')!,
      category_id: watch('category_id') || undefined,
      payee: watch('payee') || '',
      notes: watch('notes') || '',
      tags: watch('tags') || [],
    }
    await localforage.setItem(DRAFT_KEY, current)
    showToast('임시 저장됨', '이 기기에 로컬로 저장되었습니다')
  }, [watch, showToast])

  // Load draft if exists (progressive disclosure: offer restore)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  useEffect(() => {
    ;(async () => {
      const draft = await localforage.getItem<FormValues>(DRAFT_KEY)
      setHasDraft(!!draft)
    })()
  }, [])

  const restoreDraft = useCallback(async () => {
    const draft = await localforage.getItem<FormValues>(DRAFT_KEY)
    if (draft) {
      reset(draft)
      setDraftLoaded(true)
      showToast('임시 저장 불러옴')
    }
  }, [reset, showToast])

  const categoriesSection = (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted-foreground">카테고리</h3>
        <Link href="/(manage)/categories" className="text-sm text-primary hover:underline">관리</Link>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {categoriesLoading && !categories.length ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))
        ) : categories.length ? (
          categories.map((c) => {
            const selected = selectedCategoryId === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setValue('category_id', selected ? undefined : c.id)}
                className={cn(
                  'group relative flex flex-col items-center justify-center gap-1 rounded-lg border transition-colors px-2 py-2 text-center',
                  selected ? 'border-primary/50 bg-primary/5' : 'border-border hover:bg-muted/50'
                )}
                aria-pressed={selected}
              >
                <span
                  className={cn(
                    'inline-flex h-9 w-full items-center justify-center rounded-md ring-1 ring-inset text-xs',
                    c.color ? '' : hashBg(c.name),
                    selected ? 'ring-primary' : ''
                  )}
                  style={c.color ? { backgroundColor: c.color } : undefined}
                >
                  <span className="truncate max-w-[6rem]">
                    {c.icon ? `${c.icon} ` : ''}{c.name}
                  </span>
                </span>
                {c.is_favorite && (
                  <span className="absolute -top-1 -right-1 text-xs" aria-label="favorite">⭐</span>
                )}
              </button>
            )
          })
        ) : (
          <div className="col-span-full text-sm text-muted-foreground">카테고리가 없습니다. 관리에서 추가하세요.</div>
        )}
      </div>
    </div>
  )

  const tagSuggestions = debouncedQuery
    ? (tagServerSuggestions?.map((t) => t.name) || localTagSuggestions || [])
    : []

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 sm:py-6">
      {demoMode && (
        <Alert className="mb-4 bg-yellow-50 border-yellow-200 text-yellow-900">
          <AlertTitle>데모 모드</AlertTitle>
          <AlertDescription>로그인되지 않았거나 오프라인 상태입니다. 데이터는 이 기기에만 저장됩니다.</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-semibold">새 지출</h1>
          <p className="text-sm text-muted-foreground">빠르게 기록하고 나중에 영수증을 추가하세요.</p>
        </div>
        <Link href="/(manage)/presets" className="text-sm text-primary hover:underline">프리셋 관리</Link>
      </div>

      {appliedPreset && (
        <div className="mb-4 rounded-lg border bg-card text-card-foreground p-3">
          <div className="text-sm">프리셋 적용됨</div>
          <div className="text-sm font-medium">{appliedPreset.name}</div>
        </div>
      )}

      {hasDraft && !draftLoaded && (
        <div className="mb-4">
          <button
            type="button"
            onClick={restoreDraft}
            className="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground hover:bg-secondary/80"
          >
            임시 저장 불러오기
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-3">
            <label htmlFor="amountText" className="block text-sm font-medium">금액 (KRW)</label>
            <div className="mt-1 flex items-center rounded-md border bg-background px-3 ring-offset-background focus-within:ring-2 focus-within:ring-primary">
              <span className="text-muted-foreground">₩</span>
              <input
                id="amountText"
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                {...register('amountText')}
                onChange={onAmountChange}
                className="ml-2 w-full bg-transparent py-2 outline-none"
              />
            </div>
            {errors.amountText && <p className="mt-1 text-xs text-destructive">{errors.amountText.message}</p>}
            <div className="mt-1 text-xs text-muted-foreground">{amountNumber != null && amountNumber > 0 ? formatKRW(amountNumber) : ''}</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="date" className="block text-sm font-medium">날짜</label>
              <input
                id="date"
                type="date"
                {...register('date')}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
              />
              {errors.date && <p className="mt-1 text-xs text-destructive">{errors.date.message}</p>}
            </div>
            <div>
              <label htmlFor="payee" className="block text-sm font-medium">결제처</label>
              <input
                id="payee"
                type="text"
                {...register('payee')}
                placeholder="상호/상점명 (선택)"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
              />
            </div>
          </div>

          <div className="mt-3">
            <label htmlFor="notes" className="block text-sm font-medium">메모</label>
            <textarea
              id="notes"
              {...register('notes')}
              placeholder="설명 또는 참고사항"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 min-h-[72px]"
            />
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          {categoriesSection}
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-muted-foreground">태그</h3>
            <Link href="/(manage)/tags" className="text-sm text-primary hover:underline">관리</Link>
          </div>

          <div className="flex flex-wrap gap-2 mb-2">
            {(selectedTags || []).map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
                #{t}
                <button type="button" onClick={() => removeTag(t)} className="ml-1 rounded-full hover:bg-foreground/10 px-1">×</button>
              </span>
            ))}
          </div>

          <div className="relative">
            <input
              type="text"
              value={tagQuery}
              onChange={(e) => { setTagQuery(e.target.value); setShowTagDropdown(true) }}
              onFocus={() => setShowTagDropdown(true)}
              placeholder="태그 입력 후 Enter 또는 선택"
              className="w-full rounded-md border bg-background px-3 py-2"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && tagQuery.trim()) {
                  e.preventDefault()
                  addTag(tagQuery.trim())
                }
              }}
            />
            {showTagDropdown && tagSuggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
                <ul className="max-h-52 overflow-auto py-1">
                  {tagSuggestions.map((name) => (
                    <li key={name}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addTag(name)}
                      >
                        #{name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {serverNotice && (
          <Alert className="bg-blue-50 border-blue-200 text-blue-900">
            <AlertTitle>알림</AlertTitle>
            <AlertDescription>{serverNotice}</AlertDescription>
          </Alert>
        )}

        <Separator className="my-2" />

        <div className="sticky bottom-0 z-10 -mx-4 px-4 py-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={saveDraft}
              className="inline-flex flex-1 items-center justify-center rounded-md border bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
            >
              로컬 임시 저장
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex flex-[1.2] items-center justify-center rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? '저장 중…' : '서버에 저장'}
            </button>
          </div>
        </div>
      </form>

      {/* Toast */}
      <div className={cn('pointer-events-none fixed inset-x-0 bottom-16 flex justify-center px-4', toast ? 'opacity-100' : 'opacity-0')}>
        {toast && (
          <div className="pointer-events-auto max-w-sm w-full rounded-lg border bg-background p-3 shadow-lg">
            <div className="text-sm font-medium">{toast.title}</div>
            {toast.description && <div className="text-xs text-muted-foreground mt-0.5">{toast.description}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

/***** Hooks *****/
function useDebounce<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}
