'use client'

/**
 * CODE INSIGHT
 * This code's use case is a mobile-first, inline-validating Budget Editor that loads categories and existing budgets for a month, lets users edit amounts and alert thresholds, and save or reset.
 * This code's full epic context is the Budgets flow: GET /api/budgets?month=YYYY-MM and GET /api/categories; PUT /api/budgets on save; DELETE /api/budgets?month=YYYY-MM on reset; then return to /budgets/[month] and refresh the summary cache.
 * This code's ui feel is sleek, calm, and confident with KRW formatting, accessible inputs, gentle transitions, and responsive layout.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { useRouter, useSearchParams } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/utils/utils'
import { putBudgets, deleteBudgets } from './action'

type UUID = string

type Category = {
  id: UUID
  name: string
  is_favorite?: boolean
}

type BudgetRow = {
  category_id: UUID | null
  amount: number
  alert_threshold_percent?: number
}

type BudgetsResponse = BudgetRow[] | { budgets: BudgetRow[] } | { category_budgets?: BudgetRow[]; overall?: BudgetRow | null }

type CategoriesResponse = Category[] | { categories: Category[] }

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

function firstDayFromMonthStr(month: string): string {
  // month passed as YYYY-MM — normalized to YYYY-MM-01
  if (/^\d{4}-\d{2}$/.test(month)) return `${month}-01`
  // fallback to current month
  const d = new Date()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-01`
}

const KRW = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 })

interface EditorProps {
  month: string
}

export default function ClientEditor({ month }: EditorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { mutate } = useSWRConfig()
  const [submitting, startTransition] = useTransition()

  const {
    data: budgetsData,
    error: budgetsError,
    isLoading: budgetsLoading,
  } = useSWR<BudgetsResponse>(`/api/budgets?month=${encodeURIComponent(month)}`, fetcher)

  const {
    data: categoriesData,
    error: categoriesError,
    isLoading: categoriesLoading,
  } = useSWR<CategoriesResponse>(`/api/categories`, fetcher)

  const categories: Category[] = useMemo(() => {
    if (!categoriesData) return []
    return Array.isArray(categoriesData) ? categoriesData : categoriesData.categories ?? []
  }, [categoriesData])

  const parsedBudgets: BudgetRow[] = useMemo(() => {
    if (!budgetsData) return []
    if (Array.isArray(budgetsData)) return budgetsData
    if ('budgets' in budgetsData && Array.isArray(budgetsData.budgets)) return budgetsData.budgets
    const cat = (budgetsData as any).category_budgets ?? []
    const ov = (budgetsData as any).overall ? [(budgetsData as any).overall] : []
    return [...cat, ...ov]
  }, [budgetsData])

  const defaultThreshold = 80

  // Build form model keyed by row key: 'overall' or category id
  type RowModel = { amount: string; threshold: number }
  const [rows, setRows] = useState<Record<string, RowModel>>({})
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    if (!categories || !parsedBudgets) return
    const map: Record<string, RowModel> = {}

    // Overall row
    const overall = parsedBudgets.find((b) => b.category_id === null)
    map['overall'] = {
      amount: overall ? String(Math.max(0, Number(overall.amount || 0))) : '',
      threshold: overall?.alert_threshold_percent ?? defaultThreshold,
    }

    // Category rows
    const byCat = new Map(parsedBudgets.filter((b) => b.category_id).map((b) => [String(b.category_id), b]))
    for (const c of categories) {
      const b = byCat.get(c.id)
      map[c.id] = {
        amount: b ? String(Math.max(0, Number(b.amount || 0))) : '',
        threshold: b?.alert_threshold_percent ?? defaultThreshold,
      }
    }

    setRows(map)
    initializedRef.current = true
  }, [categories, parsedBudgets])

  // Validation
  const [formError, setFormError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const errors = useMemo(() => {
    const e: Record<string, string | null> = {}
    Object.entries(rows).forEach(([key, { amount, threshold }]) => {
      if (amount !== '' && (Number.isNaN(Number(amount)) || Number(amount) < 0)) {
        e[key] = 'Amount must be a non-negative number'
        return
      }
      if (threshold < 50 || threshold > 100) {
        e[key] = 'Threshold must be between 50% and 100%'
      } else {
        e[key] = null
      }
    })
    return e
  }, [rows])

  const hasErrors = useMemo(() => Object.values(errors).some((v) => v), [errors])

  // Handlers
  const handleAmountChange = (key: string, val: string) => {
    const clean = val.replace(/[^0-9]/g, '')
    setRows((prev) => ({ ...prev, [key]: { ...prev[key], amount: clean } }))
  }

  const handleThresholdChange = (key: string, val: number) => {
    setRows((prev) => ({ ...prev, [key]: { ...prev[key], threshold: val } }))
  }

  const buildPayload = (): BudgetRow[] => {
    const out: BudgetRow[] = []
    // overall first
    const o = rows['overall']
    if (o) {
      out.push({ category_id: null, amount: Number(o.amount || 0), alert_threshold_percent: o.threshold })
    }
    for (const c of categories) {
      const r = rows[c.id]
      if (!r) continue
      out.push({ category_id: c.id, amount: Number(r.amount || 0), alert_threshold_percent: r.threshold })
    }
    return out
  }

  const onSave = async () => {
    setFormError(null)
    setSuccessMsg(null)
    if (hasErrors) {
      setFormError('Please fix validation errors before saving.')
      return
    }
    const payload = buildPayload()
    startTransition(async () => {
      try {
        await putBudgets({ month, budgets: payload })
        // Optimistically refresh summary cache and navigate back
        await mutate(`/api/budgets/summary?month=${encodeURIComponent(month)}`)
        setSuccessMsg('Budgets saved')
        router.push(`/budgets/${month}`)
      } catch (e: any) {
        setFormError(e?.message || 'Failed to save budgets')
      }
    })
  }

  const onReset = async () => {
    setFormError(null)
    setSuccessMsg(null)
    const confirmReset = window.confirm('Reset all budgets for this month? This action cannot be undone.')
    if (!confirmReset) return
    startTransition(async () => {
      try {
        await deleteBudgets(month)
        await mutate(`/api/budgets/summary?month=${encodeURIComponent(month)}`)
        router.push(`/budgets/${month}`)
      } catch (e: any) {
        setFormError(e?.message || 'Failed to reset budgets')
      }
    })
  }

  // Focus optional category row
  const focusCategoryId = searchParams.get('categoryId')
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  useEffect(() => {
    if (!focusCategoryId) return
    const el = inputRefs.current[focusCategoryId]
    if (el) el.focus()
  }, [focusCategoryId, rows])

  const monthLabel = useMemo(() => {
    const parts = month.split('-')
    if (parts.length >= 2) return `${parts[0]}년 ${String(parts[1]).replace(/^0/, '')}월`
    return month
  }, [month])

  const loading = budgetsLoading || categoriesLoading
  const loadError = budgetsError || categoriesError

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">월 예산 편집</h1>
          <p className="text-sm text-muted-foreground">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push(`/budgets/${month}`)}
            className="inline-flex items-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={submitting}
            className="inline-flex items-center rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
          >
            초기화
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={submitting || loading}
            className={cn(
              'inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:brightness-110 active:scale-[0.98]',
              (submitting || loading) && 'opacity-70'
            )}
          >
            {submitting ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>

      {formError && (
        <div className="mb-4">
          <Alert variant="destructive">
            <AlertTitle>저장 실패</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        </div>
      )}

      {successMsg && (
        <div className="mb-4">
          <Alert>
            <AlertTitle>완료</AlertTitle>
            <AlertDescription>{successMsg}</AlertDescription>
          </Alert>
        </div>
      )}

      {loadError && (
        <div className="mb-4">
          <Alert variant="destructive">
            <AlertTitle>로드 오류</AlertTitle>
            <AlertDescription>예산 또는 카테고리를 불러오지 못했습니다. 새로고침 해주세요.</AlertDescription>
          </Alert>
        </div>
      )}

      <section className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        <div className="flex items-center justify-between p-4">
          <div>
            <h2 className="text-base font-medium">전체 예산</h2>
            <p className="text-xs text-muted-foreground">이 달의 총 지출 한도를 설정하세요</p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            {rows['overall']?.amount ? KRW.format(Number(rows['overall']?.amount || 0)) : ''}
          </div>
        </div>
        <div className="px-4 pb-4">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col">
                <label htmlFor="overall-amount" className="mb-1 text-sm font-medium">
                  금액 (KRW)
                </label>
                <input
                  id="overall-amount"
                  ref={(el) => (inputRefs.current['overall'] = el)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="0"
                  value={rows['overall']?.amount ?? ''}
                  onChange={(e) => handleAmountChange('overall', e.target.value)}
                  className={cn(
                    'h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none ring-2 ring-transparent transition-shadow focus:ring-primary',
                    errors['overall'] && 'border-destructive/60'
                  )}
                />
                <p className={cn('mt-1 text-xs text-muted-foreground', errors['overall'] && 'text-destructive')}>{errors['overall'] ?? '원 단위 (쉼표 없이 숫자만)'}</p>
              </div>
              <div className="flex flex-col">
                <label htmlFor="overall-threshold" className="mb-1 text-sm font-medium">
                  알림 임계치 (%)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="overall-threshold"
                    type="range"
                    min={50}
                    max={100}
                    step={1}
                    value={rows['overall']?.threshold ?? defaultThreshold}
                    onChange={(e) => handleThresholdChange('overall', Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <input
                    type="number"
                    min={50}
                    max={100}
                    step={1}
                    value={rows['overall']?.threshold ?? defaultThreshold}
                    onChange={(e) => handleThresholdChange('overall', Number(e.target.value))}
                    className={cn(
                      'h-11 w-20 rounded-lg border border-input bg-background px-3 text-base outline-none ring-2 ring-transparent transition-shadow focus:ring-primary',
                      errors['overall'] && 'border-destructive/60'
                    )}
                  />
                </div>
                <p className={cn('mt-1 text-xs text-muted-foreground', errors['overall'] && 'text-destructive')}>
                  {errors['overall'] ?? '80% 권장'}
                </p>
              </div>
            </div>
          )}
        </div>
        <Separator className="bg-border" />
        <div className="p-4">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">카테고리 예산</h3>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="grid grid-cols-1 gap-3 sm:grid-cols-7">
                  <Skeleton className="h-10 w-full rounded-md sm:col-span-2" />
                  <Skeleton className="h-10 w-full rounded-md sm:col-span-3" />
                  <Skeleton className="h-10 w-full rounded-md sm:col-span-2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {categories
                .slice()
                .sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || a.name.localeCompare(b.name))
                .map((cat) => {
                  const key = cat.id
                  const row = rows[key]
                  const err = errors[key]
                  return (
                    <div key={key} className="grid grid-cols-1 items-start gap-3 rounded-lg border border-transparent bg-card/50 p-3 transition hover:border-border sm:grid-cols-7">
                      <div className="sm:col-span-2">
                        <div className="flex items-center gap-2">
                          <span className={cn('inline-block h-2 w-2 rounded-full bg-primary/70', cat.is_favorite && 'bg-amber-500')} />
                          <span className="text-sm font-medium">{cat.name}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row?.amount ? KRW.format(Number(row.amount)) : ''}
                        </p>
                      </div>
                      <div className="sm:col-span-3">
                        <label className="mb-1 block text-xs text-muted-foreground">금액 (KRW)</label>
                        <input
                          ref={(el) => (inputRefs.current[key] = el)}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="0"
                          value={row?.amount ?? ''}
                          onChange={(e) => handleAmountChange(key, e.target.value)}
                          className={cn(
                            'h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none ring-2 ring-transparent transition-shadow focus:ring-primary',
                            err && 'border-destructive/60'
                          )}
                        />
                        {err ? (
                          <p className="mt-1 text-xs text-destructive">{err}</p>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">원 단위 (숫자만)</p>
                        )}
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-xs text-muted-foreground">임계치 (%)</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={50}
                            max={100}
                            step={1}
                            value={row?.threshold ?? defaultThreshold}
                            onChange={(e) => handleThresholdChange(key, Number(e.target.value))}
                            className="w-full accent-primary"
                          />
                          <input
                            type="number"
                            min={50}
                            max={100}
                            step={1}
                            value={row?.threshold ?? defaultThreshold}
                            onChange={(e) => handleThresholdChange(key, Number(e.target.value))}
                            className={cn(
                              'h-11 w-20 rounded-lg border border-input bg-background px-3 text-base outline-none ring-2 ring-transparent transition-shadow focus:ring-primary',
                              err && 'border-destructive/60'
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </section>

      <div className="sticky bottom-4 z-10 mt-6 flex w-full justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push(`/budgets/${month}`)}
          className="inline-flex items-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={submitting}
          className="inline-flex items-center rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive shadow-sm hover:bg-destructive/20 transition-colors disabled:opacity-50"
        >
          초기화
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={submitting || loading || hasErrors}
          className={cn(
            'inline-flex items-center rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:brightness-110 active:scale-[0.98]',
            (submitting || loading) && 'opacity-70',
            hasErrors && 'cursor-not-allowed opacity-60'
          )}
        >
          {submitting ? '저장 중…' : '저장'}
        </button>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <div>
          <span className="mr-2">현재 월:</span>
          <code className="rounded bg-muted px-2 py-1 text-xs">{firstDayFromMonthStr(month)}</code>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(`/budgets/${month}`)}
            className="text-primary hover:underline"
          >
            개요로 돌아가기
          </button>
          <button
            type="button"
            onClick={() => router.push(`/transactions?month=${encodeURIComponent(month)}`)}
            className="text-primary hover:underline"
          >
            거래 보기
          </button>
          <button
            type="button"
            onClick={() => router.push('/reports')}
            className="text-primary hover:underline"
          >
            리포트
          </button>
        </div>
      </div>
    </div>
  )
}
