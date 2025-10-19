'use client'

/**
 * CODE INSIGHT
 * This client component powers the Edit Category form. It loads the category by id via SWR from /api/categories/[id],
 * merges any locally-stored icon/color from localForage, and supports PATCH updates. If offline or unauthorized (401),
 * it updates localForage('tris.categories') and informs the user with a demo mode banner, then navigates back to the list.
 */

import React, { useEffect, useMemo, useState } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import localforage from 'localforage'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/utils/utils'
import {
  Star,
  StarOff,
  Check,
  Palette,
  ShoppingBag,
  Coffee,
  Home,
  Heart,
  Film,
  Gamepad2,
  Car,
  Bus,
  Utensils,
  Smartphone,
} from 'lucide-react'

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' })
  if (res.status === 401) {
    const err: any = new Error('Unauthorized')
    err.status = 401
    throw err
  }
  if (!res.ok) {
    const err: any = new Error(`Request failed: ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

// Types
interface CategoryRecord {
  id: string
  name: string
  is_favorite: boolean
  created_at?: string
  updated_at?: string
}

interface LocalCategory extends CategoryRecord {
  icon?: string
  color?: string
}

const ICONS = {
  ShoppingBag,
  Coffee,
  Home,
  Heart,
  Film,
  Gamepad2,
  Car,
  Bus,
  Utensils,
  Smartphone,
}

const ICON_KEYS = Object.keys(ICONS) as Array<keyof typeof ICONS>

const COLORS = [
  '#2563EB', // primary blue
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#10B981',
  '#14B8A6',
  '#8B5CF6',
  '#EC4899',
  '#64748B',
]

const FormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  icon: z.enum(ICON_KEYS as [string, ...string[]], {
    required_error: 'Select an icon',
  }),
  color: z
    .string()
    .regex(/^#([0-9A-Fa-f]{6})$/, 'Pick a color'),
  is_favorite: z.boolean(),
})

type FormValues = z.infer<typeof FormSchema>

export default function EditCategoryClient({ id }: { id: string }) {
  const router = useRouter()
  const [demoMode, setDemoMode] = useState(false)
  const [initializingLocal, setInitializingLocal] = useState(true)
  const [localCategories, setLocalCategories] = useState<LocalCategory[]>([])
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState<string>('')

  useEffect(() => {
    localforage.getItem('tris.categories').then((data) => {
      setLocalCategories(Array.isArray(data) ? (data as LocalCategory[]) : [])
      setInitializingLocal(false)
    })
  }, [])

  const { data: serverData, error, isLoading, mutate } = useSWR<CategoryRecord>(
    id ? `/api/categories/${id}` : null,
    fetcher,
    {
      shouldRetryOnError: false,
      revalidateOnFocus: true,
    }
  )

  useEffect(() => {
    if (error) {
      if ((error as any).status === 401) {
        setDemoMode(true)
      } else if ((error as any).message?.includes('Failed to fetch')) {
        setDemoMode(true)
      }
    }
  }, [error])

  const localMatch = useMemo(() => localCategories.find((c) => c.id === id), [localCategories, id])

  const combined: LocalCategory | undefined = useMemo(() => {
    if (serverData) {
      return {
        ...serverData,
        icon: localMatch?.icon ?? 'ShoppingBag',
        color: localMatch?.color ?? '#2563EB',
      }
    }
    return localMatch
  }, [serverData, localMatch])

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      icon: 'ShoppingBag',
      color: '#2563EB',
      is_favorite: false,
    } as FormValues,
  })

  // Initialize form with loaded data
  useEffect(() => {
    if (combined) {
      form.reset({
        name: combined.name ?? '',
        icon: (combined.icon as FormValues['icon']) ?? 'ShoppingBag',
        color: combined.color ?? '#2563EB',
        is_favorite: !!combined.is_favorite,
      })
    }
  }, [combined, form])

  const onSubmit = async (values: FormValues) => {
    setSaveState('saving')
    setSaveMessage('')

    const updateLocal = async (payload: Partial<LocalCategory>) => {
      const list: LocalCategory[] = Array.isArray(localCategories) ? [...localCategories] : []
      const idx = list.findIndex((c) => c.id === id)
      const base: LocalCategory = combined || ({ id, name: values.name, is_favorite: values.is_favorite } as LocalCategory)
      const updated: LocalCategory = {
        ...base,
        ...payload,
      }
      if (idx >= 0) list[idx] = updated
      else list.push(updated)
      await localforage.setItem('tris.categories', list)
      setLocalCategories(list)
      return updated
    }

    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          is_favorite: values.is_favorite,
          icon: values.icon,
          color: values.color,
        }),
      })

      if (res.status === 401) {
        // Unauthorized -> demo mode
        setDemoMode(true)
        await updateLocal({
          name: values.name,
          is_favorite: values.is_favorite,
          icon: values.icon,
          color: values.color,
        })
        setSaveState('saved')
        setSaveMessage('Saved locally. You can sync when online.')
        // Allow user to see confirmation briefly then navigate
        setTimeout(() => router.push('/categories'), 300)
        return
      }

      if (!res.ok) {
        throw new Error(`Save failed: ${res.status}`)
      }

      // Sync icon/color locally even on online success (server ignores these fields)
      await updateLocal({
        name: values.name,
        is_favorite: values.is_favorite,
        icon: values.icon,
        color: values.color,
      })

      // Revalidate SWR caches
      mutate()
      globalMutate('/api/categories')

      setSaveState('saved')
      setSaveMessage('Category updated')
      setTimeout(() => router.push('/categories'), 200)
    } catch (e: any) {
      // Network error -> demo mode path
      setDemoMode(true)
      await updateLocal({
        name: values.name,
        is_favorite: values.is_favorite,
        icon: values.icon,
        color: values.color,
      })
      setSaveState('saved')
      setSaveMessage('Saved locally (offline).')
      setTimeout(() => router.push('/categories'), 400)
    }
  }

  const loading = isLoading || initializingLocal
  const notFound = !loading && !combined

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6 sm:py-8">
      {demoMode && (
        <Alert className="mb-4 border-amber-300 bg-amber-50 text-amber-900">
          <AlertTitle className="font-semibold">Demo mode: data stored locally</AlertTitle>
          <AlertDescription>
            You're offline or not signed in. Changes are saved on this device and will not sync until online.
          </AlertDescription>
        </Alert>
      )}

      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-5 py-4">
          <h1 className="text-lg font-semibold">Edit Category</h1>
          <p className="text-sm text-muted-foreground">Update name, icon, color, and favorite status.</p>
        </div>

        <div className="p-5 space-y-6">
          {loading && (
            <div className="space-y-5">
              <div>
                <div className="h-4 w-24 bg-muted rounded mb-2" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div>
                <div className="h-4 w-28 bg-muted rounded mb-2" />
                <div className="grid grid-cols-5 gap-3">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 rounded-lg" />
                  ))}
                </div>
              </div>
              <div>
                <div className="h-4 w-24 bg-muted rounded mb-2" />
                <div className="flex flex-wrap gap-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-8 rounded-full" />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className="h-10 w-28" />
                <Skeleton className="h-10 w-40" />
              </div>
            </div>
          )}

          {notFound && (
            <Alert className="border-destructive bg-destructive/10 text-destructive">
              <AlertTitle>Category not found</AlertTitle>
              <AlertDescription>
                We couldn't find this category locally. Please go back to Categories.
              </AlertDescription>
            </Alert>
          )}

          {!loading && combined && (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-1.5">
                <label htmlFor="name" className="text-sm font-medium">Name</label>
                <input
                  id="name"
                  type="text"
                  inputMode="text"
                  placeholder="e.g., Groceries"
                  {...form.register('name')}
                  className={cn(
                    'w-full h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none',
                    'focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition'
                  )}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive mt-1">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Favorite</span>
                  <span className="text-xs text-muted-foreground">Pin to top</span>
                </div>
                <button
                  type="button"
                  onClick={() => form.setValue('is_favorite', !form.getValues('is_favorite'), { shouldDirty: true })}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm border transition',
                    form.watch('is_favorite')
                      ? 'bg-primary text-primary-foreground border-primary hover:opacity-90'
                      : 'bg-background border-input hover:bg-muted'
                  )}
                  aria-pressed={form.watch('is_favorite')}
                >
                  {form.watch('is_favorite') ? (
                    <Star className="h-4 w-4 fill-current" />
                  ) : (
                    <StarOff className="h-4 w-4" />
                  )}
                  {form.watch('is_favorite') ? 'Favorited' : 'Mark favorite'}
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Icon</span>
                </div>
                <div className="grid grid-cols-5 gap-3">
                  {ICON_KEYS.map((key) => {
                    const IconCmp = ICONS[key]
                    const active = form.watch('icon') === key
                    return (
                      <button
                        type="button"
                        key={key}
                        onClick={() => form.setValue('icon', key, { shouldDirty: true })}
                        className={cn(
                          'aspect-square rounded-xl border flex items-center justify-center',
                          'hover:bg-muted transition relative',
                          active ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-input'
                        )}
                        aria-pressed={active}
                        aria-label={`Select ${key} icon`}
                      >
                        <IconCmp className="h-5 w-5" />
                        {active && (
                          <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-0.5">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                {form.formState.errors.icon && (
                  <p className="text-sm text-destructive mt-1">{form.formState.errors.icon.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  <span className="text-sm font-medium">Color</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {COLORS.map((c) => {
                    const active = form.watch('color') === c
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => form.setValue('color', c as FormValues['color'], { shouldDirty: true })}
                        className={cn(
                          'h-8 w-8 rounded-full border transition',
                          active ? 'ring-2 ring-offset-2 ring-primary border-transparent' : 'border-border hover:opacity-90'
                        )}
                        style={{ backgroundColor: c }}
                        aria-label={`Select color ${c}`}
                        aria-pressed={active}
                      />
                    )
                  })}
                </div>
                {form.formState.errors.color && (
                  <p className="text-sm text-destructive mt-1">{form.formState.errors.color.message}</p>
                )}
              </div>

              {saveState === 'error' && (
                <Alert className="border-destructive bg-destructive/10 text-destructive">
                  <AlertTitle>Something went wrong</AlertTitle>
                  <AlertDescription>{saveMessage || 'Please try again.'}</AlertDescription>
                </Alert>
              )}

              {saveState === 'saved' && saveMessage && (
                <Alert className="border-green-300 bg-green-50 text-green-900">
                  <AlertTitle>Success</AlertTitle>
                  <AlertDescription>{saveMessage}</AlertDescription>
                </Alert>
              )}

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => router.push('/categories')}
                  className={cn(
                    'h-11 inline-flex items-center justify-center rounded-xl border border-input px-4 text-sm',
                    'bg-background hover:bg-muted transition'
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!form.formState.isValid || saveState === 'saving'}
                  className={cn(
                    'h-11 inline-flex items-center justify-center rounded-xl px-5 text-sm font-medium',
                    'bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed',
                    'transition'
                  )}
                >
                  {saveState === 'saving' ? 'Saving…' : 'Save changes'}
                </button>
              </div>

              <div className="flex items-center justify-end">
                <p className="text-xs text-muted-foreground">
                  {demoMode ? 'Offline: changes stored locally' : 'Connected'}
                </p>
              </div>

              <div className="pt-2 border-t border-border flex items-center gap-3 text-sm">
                <a
                  href="/categories"
                  className="text-primary hover:underline"
                >
                  Back to Categories
                </a>
                <span className="text-muted-foreground">·</span>
                <a href="/presets" className="text-primary hover:underline">Manage Presets</a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
