'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import localforage from 'localforage'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/utils/utils'
import { getSessionStatus } from './action'

const schema = z.object({
  name: z.string().min(1, 'Category name is required').max(80, 'Name is too long'),
  icon: z.string().max(4).optional().or(z.literal('')),
  color: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/).optional().or(z.literal('')),
  is_favorite: z.boolean().default(false),
})

type FormValues = z.infer<typeof schema>

type LocalCategory = {
  id: string
  name: string
  is_favorite: boolean
  icon?: string
  color?: string
  created_at: string
  updated_at: string
}

const EMOJI_SUGGESTIONS = ['🛒','🍜','☕️','🚇','🚕','🏠','🧾','💡','📱','🎮','🎁','💼','💳','📚','🧺']

export default function Client() {
  const router = useRouter()
  const [submitting, setSubmitting] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [demoMode, setDemoMode] = React.useState(false)
  const [appearanceOpen, setAppearanceOpen] = React.useState(false)

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      icon: '',
      color: '#2563EB',
      is_favorite: false,
    },
    mode: 'onChange',
  })

  const iconVal = watch('icon')
  const colorVal = watch('color')
  const favoriteVal = watch('is_favorite')

  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const status = await getSessionStatus()
        if (!mounted) return
        const isDemo = !status?.authenticated
        setDemoMode(isDemo)
        if (isDemo) {
          await seedDemoCategoriesIfEmpty()
        }
      } catch {
        // If server action fails, assume demo mode and seed.
        setDemoMode(true)
        await seedDemoCategoriesIfEmpty()
      }
    })()
    return () => { mounted = false }
  }, [])

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    setSubmitting(true)

    const payload = {
      name: values.name.trim(),
      is_favorite: !!values.is_favorite,
      // Extra fields for future server support; ignored by current API, used in demo local storage
      icon: values.icon || undefined,
      color: values.color || undefined,
    }

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        router.push('/(manage)/categories')
        return
      }

      if (res.status === 401) {
        await saveLocalAndGo(payload)
        return
      }

      const body = await safeJson(res)
      setServerError(body?.error || 'Unable to create category. Please try again.')
    } catch (e) {
      await saveLocalAndGo(payload)
      return
    } finally {
      setSubmitting(false)
    }
  }

  const saveLocalAndGo = async (payload: { name: string; is_favorite: boolean; icon?: string; color?: string }) => {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const local: LocalCategory = {
      id,
      name: payload.name,
      is_favorite: payload.is_favorite,
      icon: payload.icon,
      color: payload.color,
      created_at: now,
      updated_at: now,
    }

    const list = (await localforage.getItem<LocalCategory[]>('tris.categories')) || []
    await localforage.setItem('tris.categories', [local, ...list])
    router.push('/(manage)/categories')
  }

  return (
    <div className="space-y-4">
      {demoMode && (
        <Alert className="border border-primary/30 bg-primary/5">
          <AlertTitle className="font-semibold">Demo mode</AlertTitle>
          <AlertDescription>
            You are offline or not signed in. New categories will be saved locally on this device.
          </AlertDescription>
        </Alert>
      )}

      {serverError && (
        <Alert className="border border-destructive/30 bg-destructive/10">
          <AlertTitle className="font-semibold">Error</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="">
        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6">
            <div className="grid gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium">Category name</label>
                <input
                  id="name"
                  type="text"
                  placeholder="e.g., Groceries"
                  {...register('name')}
                  className={cn(
                    'mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-0 transition focus:border-primary focus:ring-2 focus:ring-primary/20',
                    errors.name && 'border-destructive focus:ring-destructive/20'
                  )}
                  autoFocus
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="flex items-center justify-between rounded-md border border-dashed border-border/70 bg-background p-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-md border border-border"
                    style={{ backgroundColor: colorVal || '#ffffff' }}
                    aria-hidden
                  >
                    <span className="text-xl" aria-hidden>{iconVal || '🏷️'}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Preview</p>
                    <p className="text-xs text-muted-foreground">Icon and color help you spot categories quickly</p>
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 rounded border-input" {...register('is_favorite')} />
                  Favorite
                </label>
              </div>

              <Collapsible open={appearanceOpen} onOpenChange={setAppearanceOpen}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Appearance</p>
                    <p className="text-xs text-muted-foreground">Optional icon and color</p>
                  </div>
                  <CollapsibleTrigger className="text-sm text-primary hover:underline">
                    {appearanceOpen ? 'Hide' : 'Customize'}
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent>
                  <div className="mt-3 rounded-md border border-border p-3 sm:p-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="icon" className="block text-sm font-medium">Icon</label>
                        <div className="mt-1 flex gap-2">
                          <input
                            id="icon"
                            type="text"
                            inputMode="text"
                            {...register('icon')}
                            placeholder="Pick or type an emoji"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {EMOJI_SUGGESTIONS.map(e => (
                            <button
                              key={e}
                              type="button"
                              onClick={() => setValue('icon', e, { shouldDirty: true, shouldTouch: true })}
                              className={cn('h-9 w-9 rounded-md border border-input bg-background hover:border-primary/50 transition', iconVal === e && 'ring-2 ring-primary/50')}
                              aria-label={`Use ${e} as icon`}
                            >
                              <span className="text-lg">{e}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label htmlFor="color" className="block text-sm font-medium">Color</label>
                        <div className="mt-1 flex items-center gap-3">
                          <input
                            id="color"
                            type="color"
                            {...register('color')}
                            className="h-10 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
                            aria-label="Pick a color"
                          />
                          <input
                            type="text"
                            value={colorVal || ''}
                            onChange={(e) => setValue('color', e.target.value, { shouldDirty: true, shouldTouch: true })}
                            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                        {errors.color && (
                          <p className="mt-1 text-xs text-destructive">Invalid color format</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>

          <Separator />

          <div className="p-4 sm:p-6 flex flex-col-reverse sm:flex-row gap-2 sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => router.push('/(manage)/categories')}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={cn('inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-70', submitting && 'animate-pulse')}
            >
              {submitting ? 'Saving…' : 'Save Category'}
            </button>
          </div>
        </div>
      </form>

      <div className="pb-8" />
    </div>
  )
}

async function safeJson(res: Response) {
  try { return await res.json() } catch { return null }
}

async function seedDemoCategoriesIfEmpty() {
  try {
    const existing = await localforage.getItem<LocalCategory[]>('tris.categories')
    if (existing && existing.length > 0) return

    const now = new Date().toISOString()
    const seed: LocalCategory[] = [
      { id: crypto.randomUUID(), name: 'Groceries', is_favorite: true, icon: '🍜', color: '#F97316', created_at: now, updated_at: now },
      { id: crypto.randomUUID(), name: 'Transport', is_favorite: true, icon: '🚇', color: '#22C55E', created_at: now, updated_at: now },
      { id: crypto.randomUUID(), name: 'Utilities', is_favorite: false, icon: '💡', color: '#8B5CF6', created_at: now, updated_at: now },
    ]
    await localforage.setItem('tris.categories', seed)
  } catch {
    // ignore
  }
}
