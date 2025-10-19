'use client'

/**
 * CODE INSIGHT
 * Client editor for a single Preset. Loads preset and categories via SWR from /api, falls back to localForage on 401/offline.
 * Supports editing name, default amount, category, payee, notes, and default tags with live suggestions.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import localforage from 'localforage'
import { v4 as uuidv4 } from 'uuid'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

class HTTPError extends Error {
  status: number
  constructor(status: number, message?: string) {
    super(message || `HTTP ${status}`)
    this.status = status
  }
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    throw new HTTPError(res.status, await safeText(res))
  }
  return res.json()
}

async function safeText(res: Response) {
  try {
    return await res.text()
  } catch {
    return ''
  }
}

// LocalForage keys
const LF_KEYS = {
  categories: 'tris.categories',
  tags: 'tris.tags',
  presets: 'tris.presets',
} as const

// Types
interface Category {
  id: string
  name: string
  is_favorite: boolean
}
interface Tag {
  id: string
  name: string
}
interface PresetData {
  id: string
  name: string
  amount?: number | null
  category_id?: string | null
  payee?: string | null
  notes?: string | null
  default_tag_names?: string[]
}

const presetSchema = z.object({
  name: z.string().min(1, '이름은 필수입니다.'),
  default_amount: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === null || v === '') return undefined
      const n = typeof v === 'string' ? Number(v.replace(/,/g, '')) : v
      return Number.isFinite(n) ? Math.round(n) : undefined
    })
    .refine((v) => v === undefined || (typeof v === 'number' && v >= 0), {
      message: '금액은 0 이상을 입력하세요.',
    }),
  category_id: z.string().optional().nullable(),
  payee: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  default_tag_names: z.array(z.string()).default([]),
})

type PresetFormValues = z.infer<typeof presetSchema>

async function ensureDemoSeed() {
  const [cats, tags, presets] = await Promise.all([
    localforage.getItem<Category[]>(LF_KEYS.categories),
    localforage.getItem<Tag[]>(LF_KEYS.tags),
    localforage.getItem<PresetData[]>(LF_KEYS.presets),
  ])

  if (!cats || cats.length === 0) {
    const c1 = { id: uuidv4(), name: '식비', is_favorite: true }
    const c2 = { id: uuidv4(), name: '교통', is_favorite: true }
    const c3 = { id: uuidv4(), name: '쇼핑', is_favorite: false }
    const c4 = { id: uuidv4(), name: '공과금', is_favorite: false }
    await localforage.setItem(LF_KEYS.categories, [c1, c2, c3, c4])
  }

  if (!tags || tags.length === 0) {
    const t1 = { id: uuidv4(), name: '커피' }
    const t2 = { id: uuidv4(), name: '버스' }
    const t3 = { id: uuidv4(), name: '점심' }
    const t4 = { id: uuidv4(), name: '월세' }
    await localforage.setItem(LF_KEYS.tags, [t1, t2, t3, t4])
  }

  if (!presets || presets.length === 0) {
    const seededCats = (await localforage.getItem<Category[]>(LF_KEYS.categories)) || []
    const c 식비 = seededCats.find((c) => c.name === '식비')?.id || null
    const c 교통 = seededCats.find((c) => c.name === '교통')?.id || null
    const c 공과금 = seededCats.find((c) => c.name === '공과금')?.id || null

    const p1: PresetData = {
      id: uuidv4(),
      name: '아침 커피',
      amount: 4500,
      category_id: c 식비,
      payee: '카페',
      notes: '모닝 라떼',
      default_tag_names: ['커피'],
    }
    const p2: PresetData = {
      id: uuidv4(),
      name: '버스 카드 충전',
      amount: 20000,
      category_id: c 교통,
      payee: '티머니',
      notes: '',
      default_tag_names: ['버스'],
    }
    const p3: PresetData = {
      id: uuidv4(),
      name: '월세',
      amount: 500000,
      category_id: c 공과금,
      payee: '집주인',
      notes: '매월 1일',
      default_tag_names: ['월세'],
    }
    await localforage.setItem(LF_KEYS.presets, [p1, p2, p3])
  }
}

function orderCategories(categories: Category[]) {
  return [...categories].sort((a, b) => {
    if (a.is_favorite && !b.is_favorite) return -1
    if (!a.is_favorite && b.is_favorite) return 1
    return a.name.localeCompare(b.name, 'ko')
  })
}

export default function Client({ presetId }: { presetId: string }) {
  const router = useRouter()
  const [demoMode, setDemoMode] = useState(false)
  const seededRef = useRef(false)
  const [loadingLocal, setLoadingLocal] = useState(false)

  const presetKey = `/api/presets/${presetId}`
  const catsKey = `/api/categories`

  const { data: presetData, error: presetError } = useSWR<PresetData>(presetKey, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    onError: async (err) => {
      const status = err instanceof HTTPError ? err.status : 0
      if (status === 401 || !navigator.onLine) {
        setDemoMode(true)
        if (!seededRef.current) {
          await ensureDemoSeed()
          seededRef.current = true
        }
        setLoadingLocal(true)
        const localPresets = (await localforage.getItem<PresetData[]>(LF_KEYS.presets)) || []
        const local = localPresets.find((p) => p.id === presetId)
        if (local) {
          await globalMutate(presetKey, local, false)
        }
        setLoadingLocal(false)
      }
    },
  })

  const { data: categories, error: catsError } = useSWR<Category[]>(catsKey, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    onError: async (err) => {
      const status = err instanceof HTTPError ? err.status : 0
      if (status === 401 || !navigator.onLine) {
        setDemoMode(true)
        if (!seededRef.current) {
          await ensureDemoSeed()
          seededRef.current = true
        }
        const localCats = (await localforage.getItem<Category[]>(LF_KEYS.categories)) || []
        await globalMutate(catsKey, localCats, false)
      }
    },
  })

  const sortedCategories = useMemo(() => (categories ? orderCategories(categories) : []), [categories])

  const form = useForm<PresetFormValues>({
    resolver: zodResolver(presetSchema),
    defaultValues: {
      name: '',
      default_amount: undefined,
      category_id: undefined,
      payee: '',
      notes: '',
      default_tag_names: [],
    },
    mode: 'onChange',
  })

  const { register, handleSubmit, reset, setValue, watch, formState } = form
  const { errors, isSubmitting, isDirty } = formState
  const tagNames = watch('default_tag_names') || []

  useEffect(() => {
    if (presetData) {
      reset({
        name: presetData.name || '',
        default_amount:
          presetData.amount !== undefined && presetData.amount !== null
            ? Number(presetData.amount)
            : undefined,
        category_id: presetData.category_id || undefined,
        payee: presetData.payee || '',
        notes: presetData.notes || '',
        default_tag_names: presetData.default_tag_names || [],
      })
    }
  }, [presetData, reset])

  // Tag suggestions
  const [tagQuery, setTagQuery] = useState('')
  const [tagSuggestions, setTagSuggestions] = useState<Tag[]>([])
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  useEffect(() => {
    const q = tagQuery.trim()
    const controller = new AbortController()
    if (!q) {
      setTagSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tags?search=${encodeURIComponent(q)}`, {
          credentials: 'include',
          signal: controller.signal,
        })
        if (res.ok) {
          const data = (await res.json()) as Tag[]
          setTagSuggestions(data.slice(0, 20))
          setShowTagDropdown(true)
        } else if (res.status === 401) {
          setDemoMode(true)
          if (!seededRef.current) {
            await ensureDemoSeed()
            seededRef.current = true
          }
          const local = ((await localforage.getItem<Tag[]>(LF_KEYS.tags)) || []).filter((t) =>
            t.name.toLowerCase().includes(q.toLowerCase())
          )
          setTagSuggestions(local.slice(0, 20))
          setShowTagDropdown(true)
        }
      } catch {
        setDemoMode(true)
        if (!seededRef.current) {
          await ensureDemoSeed()
          seededRef.current = true
        }
        const local = ((await localforage.getItem<Tag[]>(LF_KEYS.tags)) || []).filter((t) =>
          t.name.toLowerCase().includes(q.toLowerCase())
        )
        setTagSuggestions(local.slice(0, 20))
        setShowTagDropdown(true)
      }
    }, 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [tagQuery])

  function addTag(name: string) {
    const clean = name.trim()
    if (!clean) return
    const exists = (watch('default_tag_names') || []).some((t) => t.toLowerCase() === clean.toLowerCase())
    if (exists) return
    setValue('default_tag_names', [...(watch('default_tag_names') || []), clean], { shouldDirty: true })
    setTagQuery('')
    setShowTagDropdown(false)
  }

  function removeTag(name: string) {
    setValue(
      'default_tag_names',
      (watch('default_tag_names') || []).filter((t) => t !== name),
      { shouldDirty: true }
    )
  }

  async function onSubmit(values: PresetFormValues) {
    const payload = {
      name: values.name,
      default_amount: typeof values.default_amount === 'number' ? values.default_amount : undefined,
      category_id: values.category_id || null,
      payee: values.payee || null,
      notes: values.notes || null,
      default_tag_names: values.default_tag_names || [],
    }

    try {
      const res = await fetch(`/api/presets/${encodeURIComponent(presetId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        router.push('/(manage)/presets')
        return
      }
      if (res.status === 401) throw new HTTPError(401)
      const msg = await res.text()
      throw new Error(msg || '저장 중 오류가 발생했습니다.')
    } catch (err) {
      // Offline/Unauthorized fallback: update localForage
      setDemoMode(true)
      if (!seededRef.current) {
        await ensureDemoSeed()
        seededRef.current = true
      }
      const [localPresets, localTags] = await Promise.all([
        localforage.getItem<PresetData[]>(LF_KEYS.presets).then((v) => v || []),
        localforage.getItem<Tag[]>(LF_KEYS.tags).then((v) => v || []),
      ])

      // Upsert preset
      const idx = localPresets.findIndex((p) => p.id === presetId)
      const updated: PresetData = {
        id: presetId,
        name: payload.name,
        amount: payload.default_amount ?? null,
        category_id: payload.category_id ?? null,
        payee: payload.payee ?? null,
        notes: payload.notes ?? null,
        default_tag_names: payload.default_tag_names || [],
      }
      if (idx >= 0) localPresets[idx] = { ...localPresets[idx], ...updated }
      else localPresets.push(updated)

      // Ensure tags exist locally for any new names
      const tagSet = new Set(localTags.map((t) => t.name.toLowerCase()))
      const toAdd: Tag[] = []
      for (const name of updated.default_tag_names || []) {
        if (!tagSet.has(name.toLowerCase())) {
          toAdd.push({ id: uuidv4(), name })
          tagSet.add(name.toLowerCase())
        }
      }

      await Promise.all([
        localforage.setItem(LF_KEYS.presets, localPresets),
        toAdd.length ? localforage.setItem(LF_KEYS.tags, [...localTags, ...toAdd]) : Promise.resolve(),
      ])

      router.push('/(manage)/presets')
    }
  }

  const loading = (!presetData && !presetError) || (!categories && !catsError) || loadingLocal
  const notFound = !loading && !presetData && demoMode

  return (
    <div className="mx-auto max-w-2xl px-4">
      {demoMode && (
        <Alert variant="default" className="mb-4 border border-yellow-300 bg-yellow-50 text-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-200">
          <AlertTitle className="font-semibold">Demo mode</AlertTitle>
          <AlertDescription>네트워크/로그인 이슈로 인해 데이터를 로컬에 저장합니다.</AlertDescription>
        </Alert>
      )}

      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="border-b p-4 sm:p-6">
          <h1 className="text-xl font-semibold tracking-tight">프리셋 수정</h1>
          <p className="mt-1 text-sm text-muted-foreground">자주 쓰는 결제 항목을 빠르게 입력할 수 있도록 필드를 미리 저장합니다.</p>
        </div>

        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-10 w-3/4 rounded-md bg-muted" />
              <div className="h-10 w-1/2 rounded-md bg-muted" />
              <div className="h-24 w-full rounded-md bg-muted" />
              <div className="h-10 w-40 rounded-md bg-muted" />
            </div>
          ) : notFound ? (
            <div className="text-sm text-muted-foreground">프리셋을 찾을 수 없습니다. <Link href="/(manage)/presets" className="text-primary underline underline-offset-4">목록으로 이동</Link></div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-1.5">
                <label htmlFor="name" className="text-sm font-medium">프리셋 이름</label>
                <input
                  id="name"
                  type="text"
                  placeholder="예: 아침 커피"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-0 transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  {...register('name')}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="default_amount" className="text-sm font-medium">기본 금액 (₩)</label>
                  <div className="relative">
                    <input
                      id="default_amount"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="예: 4500"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 pr-10 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      {...register('default_amount')}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">원</span>
                  </div>
                  {errors.default_amount && (
                    <p className="text-sm text-destructive">{errors.default_amount.message as string}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="category_id" className="text-sm font-medium">카테고리</label>
                  <select
                    id="category_id"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    {...register('category_id')}
                  >
                    <option value="">선택 안 함</option>
                    {sortedCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.is_favorite ? '★ ' : ''}
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="payee" className="text-sm font-medium">가맹점/상대</label>
                  <input
                    id="payee"
                    type="text"
                    placeholder="예: 스타벅스"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-0 transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    {...register('payee')}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="notes" className="text-sm font-medium">메모</label>
                  <input
                    id="notes"
                    type="text"
                    placeholder="선택 사항"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-0 transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    {...register('notes')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">기본 태그</label>
                <div className="flex flex-wrap gap-2">
                  {tagNames.map((tag) => (
                    <span
                      key={tag}
                      className="group inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary hover:bg-primary/15"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="-mr-1 rounded-full p-1 text-primary/70 transition hover:bg-primary/20 hover:text-primary"
                        aria-label={`${tag} 제거`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={tagQuery}
                    onChange={(e) => setTagQuery(e.target.value)}
                    onFocus={() => tagQuery && setShowTagDropdown(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (tagQuery.trim()) addTag(tagQuery)
                      }
                      if (e.key === 'Escape') setShowTagDropdown(false)
                    }}
                    placeholder="태그 입력 후 Enter로 추가"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  {showTagDropdown && tagSuggestions.length > 0 && (
                    <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 shadow-lg">
                      {tagSuggestions.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => addTag(t.name)}
                          className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
                        >
                          <span>{t.name}</span>
                          <span className="text-xs text-muted-foreground">추가</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-muted-foreground">필드 변경 시 자동 저장되지 않습니다.</div>
                <div className="flex items-center gap-2">
                  <Link
                    href="/(manage)/presets"
                    className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm transition hover:bg-muted"
                  >
                    취소
                  </Link>
                  <button
                    type="submit"
                    disabled={isSubmitting || (!isDirty && !demoMode)}
                    className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isSubmitting ? '저장 중…' : '변경 저장'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>빠르게 수정하려면</span>
        <Link href="/(manage)/categories" className="text-primary underline underline-offset-4">카테고리 관리</Link>
        <span>에서 즐겨찾기를 정렬하세요.</span>
      </div>
    </div>
  )
}
