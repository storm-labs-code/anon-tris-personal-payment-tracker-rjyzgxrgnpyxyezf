'use client'

/**
 * CODE INSIGHT
 * This client component renders the New Transaction form using React Hook Form. It posts to /api/demo/transactions,
 * updates SWR caches, mirrors to localStorage, shows accessible feedback, and navigates to /transactions on success.
 */

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { useSWRConfig } from 'swr'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/utils/utils'

function formatKRW(value: number) {
  try {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(value)
  } catch {
    return `₩${value.toLocaleString('ko-KR')}`
  }
}

function todayISODate() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type FormValues = {
  amount: string
  date: string
  category: string
  payee: string
  method: 'card' | 'cash' | 'bank_transfer' | 'mobile'
  notes: string
}

export default function NewTransactionClient() {
  const router = useRouter()
  const { mutate } = useSWRConfig()
  const [submitting, setSubmitting] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [showToast, setShowToast] = React.useState(false)
  const [isOnline, setIsOnline] = React.useState<boolean>(true)

  React.useEffect(() => {
    const update = () => setIsOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid, isSubmitting },
  } = useForm<FormValues>({
    mode: 'onChange',
    defaultValues: {
      amount: '',
      date: todayISODate(),
      category: 'Food',
      payee: '',
      method: 'card',
      notes: '',
    },
  })

  const amountValue = watch('amount')

  function sanitizeAmountInput(raw: string) {
    return raw.replace(/[^0-9]/g, '')
  }

  async function onSubmit(values: FormValues) {
    setErrorMsg(null)
    setSubmitting(true)

    const sanitized = sanitizeAmountInput(values.amount)
    const amountNum = Number.parseInt(sanitized, 10)

    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setSubmitting(false)
      setErrorMsg('금액을 올바르게 입력하세요 (₩ 1 이상).')
      return
    }

    const payload = {
      amount: amountNum,
      date: values.date,
      category: values.category,
      payee: values.payee || null,
      method: values.method,
      notes: values.notes || null,
    }

    try {
      const res = await fetch('/api/demo/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `요청이 실패했어요. (${res.status})`)
      }

      const created = await res.json()

      try {
        // Mirror to localStorage for demo persistence
        const key = 'tris:demo:transactions'
        const existingRaw = localStorage.getItem(key)
        const existing = existingRaw ? (JSON.parse(existingRaw) as any[]) : []
        const next = [created, ...existing]
        localStorage.setItem(key, JSON.stringify(next))
      } catch {}

      try {
        // Update SWR caches for any transactions keys
        // Base key as per epic
        await mutate(['transactions'])
        // Broadly revalidate any paginated keys beginning with 'transactions'
        // @ts-ignore - matcher overload is available in SWR v2
        await mutate((k: any) => Array.isArray(k) && k[0] === 'transactions')
        // Optimistically prepend if cached data exists in base key
        // @ts-ignore
        await mutate(['transactions'], (curr: any) => {
          if (!curr) return curr
          if (Array.isArray(curr)) return [created, ...curr]
          if (curr && Array.isArray(curr.items)) {
            return { ...curr, items: [created, ...curr.items] }
          }
          return curr
        }, false)
      } catch {}

      setShowToast(true)
      setTimeout(() => {
        router.push('/transactions')
      }, 500)
    } catch (err: any) {
      setErrorMsg(err?.message || '저장 중 오류가 발생했어요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">새 지출 추가</h1>
        <Link href="/transactions" className="text-sm font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-md px-2 py-1">
          취소
        </Link>
      </div>

      {!isOnline && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
          오프라인 상태입니다. 저장 시 네트워크 연결이 필요해요.
        </div>
      )}

      {errorMsg && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10 text-destructive">
          <AlertTitle>저장 실패</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <fieldset className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <legend className="px-1 text-sm font-medium text-muted-foreground">기본 정보</legend>

          <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="amount" className="mb-1 block text-sm font-medium">금액 (₩)</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">₩</div>
                <input
                  id="amount"
                  inputMode="numeric"
                  autoComplete="off"
                  className={cn(
                    'block w-full rounded-lg border border-input bg-background px-3 py-3 pl-7 text-base shadow-sm outline-none transition focus:ring-2 focus:ring-primary',
                    errors.amount ? 'ring-2 ring-destructive focus:ring-destructive' : ''
                  )}
                  placeholder="0"
                  aria-describedby="amount-help"
                  {...register('amount', {
                    required: '금액은 필수입니다.',
                    validate: (val) => {
                      const n = Number.parseInt(sanitizeAmountInput(val), 10)
                      if (!Number.isFinite(n) || n <= 0) return '₩ 1 이상의 값을 입력하세요.'
                      return true
                    },
                    onChange: (e) => {
                      const clean = sanitizeAmountInput(e.target.value)
                      setValue('amount', clean, { shouldValidate: true })
                    },
                  })}
                />
              </div>
              <p id="amount-help" className="mt-1 text-xs text-muted-foreground">예: {formatKRW(12000)}</p>
              {errors.amount && (
                <p className="mt-1 text-sm text-destructive" role="alert">{errors.amount.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="date" className="mb-1 block text-sm font-medium">날짜</label>
              <input
                id="date"
                type="date"
                className={cn(
                  'block w-full rounded-lg border border-input bg-background px-3 py-3 text-base shadow-sm outline-none transition focus:ring-2 focus:ring-primary',
                  errors.date ? 'ring-2 ring-destructive focus:ring-destructive' : ''
                )}
                aria-describedby="date-help"
                {...register('date', { required: '날짜를 선택하세요.' })}
              />
              <p id="date-help" className="mt-1 text-xs text-muted-foreground">지출이 발생한 날짜</p>
              {errors.date && <p className="mt-1 text-sm text-destructive" role="alert">{errors.date.message}</p>}
            </div>

            <div>
              <label htmlFor="category" className="mb-1 block text-sm font-medium">카테고리</label>
              <select
                id="category"
                className={cn(
                  'block w-full appearance-none rounded-lg border border-input bg-background px-3 py-3 text-base shadow-sm outline-none transition focus:ring-2 focus:ring-primary',
                  errors.category ? 'ring-2 ring-destructive focus:ring-destructive' : ''
                )}
                {...register('category', { required: '카테고리를 선택하세요.' })}
              >
                <option value="Food">식비</option>
                <option value="Transport">교통</option>
                <option value="Groceries">장보기</option>
                <option value="Bills">고지서/공과금</option>
                <option value="Entertainment">엔터테인먼트</option>
                <option value="Other">기타</option>
              </select>
              {errors.category && <p className="mt-1 text-sm text-destructive" role="alert">{errors.category.message}</p>}
            </div>

            <div>
              <label htmlFor="payee" className="mb-1 block text-sm font-medium">가맹점/수취인</label>
              <input
                id="payee"
                type="text"
                autoComplete="organization"
                placeholder="예: 스타벅스"
                className={cn(
                  'block w-full rounded-lg border border-input bg-background px-3 py-3 text-base shadow-sm outline-none transition focus:ring-2 focus:ring-primary'
                )}
                {...register('payee')}
              />
            </div>

            <div>
              <label htmlFor="method" className="mb-1 block text-sm font-medium">결제 수단</label>
              <select
                id="method"
                className={cn(
                  'block w-full appearance-none rounded-lg border border-input bg-background px-3 py-3 text-base shadow-sm outline-none transition focus:ring-2 focus:ring-primary'
                )}
                {...register('method', { required: true })}
              >
                <option value="card">카드</option>
                <option value="cash">현금</option>
                <option value="bank_transfer">계좌이체</option>
                <option value="mobile">모바일결제</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="notes" className="mb-1 block text-sm font-medium">메모</label>
              <textarea
                id="notes"
                rows={3}
                placeholder="간단한 메모를 남겨보세요"
                className={cn(
                  'block w-full resize-y rounded-lg border border-input bg-background px-3 py-3 text-base shadow-sm outline-none transition focus:ring-2 focus:ring-primary'
                )}
                {...register('notes')}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <legend className="px-1 text-sm font-medium text-muted-foreground">영수증</legend>
          <div>
            <label htmlFor="receipt" className="mb-1 block text-sm font-medium">사진 첨부</label>
            <input
              id="receipt"
              type="file"
              accept="image/*"
              capture="environment"
              disabled
              className="block w-full cursor-not-allowed rounded-lg border border-dashed border-input bg-muted/30 px-3 py-10 text-center text-sm text-muted-foreground"
            />
            <p className="mt-1 text-xs text-muted-foreground">카메라/갤러리 첨부는 곧 제공될 예정입니다.</p>
          </div>
        </fieldset>

        <div className="flex items-center justify-end gap-3 pb-10">
          <Link
            href="/transactions"
            className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={!isValid || submitting || isSubmitting}
            className={cn(
              'inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              (!isValid || submitting || isSubmitting) ? 'opacity-60' : 'hover:opacity-90'
            )}
          >
            {submitting || isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                저장 중...
              </span>
            ) : (
              <span>저장</span>
            )}
          </button>
        </div>
      </form>

      {/* Inline success toast */}
      <div aria-live="polite" aria-atomic="true" className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 sm:bottom-24">
        {showToast && (
          <div className="pointer-events-auto w-full max-w-sm rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900 shadow-lg ring-1 ring-black/5 transition">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
              </svg>
              <p>추가되었습니다</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
