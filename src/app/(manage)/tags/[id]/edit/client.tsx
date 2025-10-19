'use client'

/**
 * CODE INSIGHT
 * This client component provides the Edit Tag form with SWR data fetching from /api/tags/[id],
 * validation via Zod/React Hook Form, and an offline/401 fallback that writes to localForage('tris.tags').
 * The UI is mobile-first, minimal, and shows a demo banner when operating locally.
 */

import { useEffect, useMemo, useState } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import { useRouter } from 'next/navigation'
import localforage from 'localforage'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'same-origin' })
  if (!res.ok) {
    const err: any = new Error('Request failed')
    err.status = res.status
    try {
      err.body = await res.json()
    } catch {
      err.body = null
    }
    throw err
  }
  return res.json()
}

interface Tag {
  id: string
  user_id?: string | null
  name: string
  is_favorite?: boolean
  created_at?: string
  updated_at?: string
}

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Tag name is required')
    .max(40, 'Maximum 40 characters'),
})

type FormValues = z.infer<typeof schema>

export function EditTagClient({ tagId }: { tagId: string }) {
  const router = useRouter()
  const [demoMode, setDemoMode] = useState(false)
  const [localTag, setLocalTag] = useState<Tag | null>(null)
  const [notFoundLocal, setNotFoundLocal] = useState(false)

  const { data, error, isLoading, mutate } = useSWR<Tag>(`/api/tags/${tagId}`, fetcher, {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
    mode: 'onChange',
  })

  const currentTag = useMemo(() => data ?? localTag ?? null, [data, localTag])

  useEffect(() => {
    if (currentTag) {
      form.reset({ name: currentTag.name })
    }
  }, [currentTag, form])

  useEffect(() => {
    const fallbackToLocal = async () => {
      try {
        const tags = (await localforage.getItem<Tag[]>('tris.tags')) || []
        if (!tags || tags.length === 0) {
          // Seed minimal demo data for a smoother offline experience
          const seeded: Tag[] = [
            { id: crypto.randomUUID(), name: '식비', is_favorite: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { id: crypto.randomUUID(), name: '교통', is_favorite: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { id: crypto.randomUUID(), name: '쇼핑', is_favorite: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          ]
          await localforage.setItem('tris.tags', seeded)
          const match = seeded.find((t) => t.id === tagId) || null
          if (match) setLocalTag(match)
          else setNotFoundLocal(true)
        } else {
          const match = tags.find((t) => t.id === tagId) || null
          if (match) setLocalTag(match)
          else setNotFoundLocal(true)
        }
        setDemoMode(true)
      } catch {
        setNotFoundLocal(true)
        setDemoMode(true)
      }
    }

    const shouldFallback = Boolean(error) || (!navigator.onLine && !data)
    if (shouldFallback && !localTag) fallbackToLocal()
  }, [error, data, tagId, localTag])

  const onSubmit = form.handleSubmit(async (values) => {
    // Try server first
    try {
      const res = await fetch(`/api/tags/${tagId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: values.name.trim() }),
      })

      if (res.status === 409) {
        const body = await res.json().catch(() => ({} as any))
        const msg = body?.message || 'Tag name already exists'
        form.setError('name', { message: msg })
        return
      }

      if (!res.ok) {
        throw new Error('Server error')
      }

      const updated: Tag = await res.json()
      await mutate(updated, false)
      await globalMutate('/api/tags')
      router.push('/(manage)/tags')
      return
    } catch (e: any) {
      // Offline/401 fallback: update localForage
      try {
        const tags = (await localforage.getItem<Tag[]>('tris.tags')) || []
        const idx = tags.findIndex((t) => t.id === tagId)
        if (idx === -1) {
          // If not found locally, create a minimal record so user change is not lost
          const now = new Date().toISOString()
          const newTag: Tag = { id: tagId, name: values.name.trim(), is_favorite: false, created_at: now, updated_at: now }
          tags.push(newTag)
        } else {
          tags[idx] = { ...tags[idx], name: values.name.trim(), updated_at: new Date().toISOString() }
        }
        await localforage.setItem('tris.tags', tags)
        const updatedLocal = tags.find((t) => t.id === tagId) || null
        if (updatedLocal) {
          await globalMutate(`/api/tags/${tagId}`, updatedLocal, false)
          await globalMutate('/api/tags', tags, false)
        }
        setDemoMode(true)
        router.push('/(manage)/tags')
      } catch {
        form.setError('root', { message: 'Could not save changes. Please try again.' })
      }
    }
  })

  return (
    <div className="mx-auto max-w-xl p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Edit Tag</h1>
        <p className="mt-1 text-sm text-muted-foreground">Rename your tag to keep your organization clear and consistent.</p>
      </div>

      {demoMode && (
        <Alert className="mb-4 border-primary/30 bg-primary/5">
          <AlertTitle className="font-semibold">Demo mode: data stored locally</AlertTitle>
          <AlertDescription>
            You appear to be offline or not authenticated. Changes are saved on this device and will not sync to other devices.
          </AlertDescription>
        </Alert>
      )}

      {isLoading && !currentTag ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-full" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      ) : notFoundLocal && !currentTag ? (
        <Alert className="border-destructive/30 bg-destructive/5">
          <AlertTitle className="font-semibold text-destructive">Tag not found</AlertTitle>
          <AlertDescription>
            We couldn't find this tag locally. Return to the tags list and try again.
          </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <label htmlFor="name" className="block text-sm font-medium text-foreground">
              Tag name
            </label>
            <input
              id="name"
              type="text"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="e.g., 카페, 헬스, 구독"
              {...form.register('name')}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground shadow-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-primary"
            />
            {form.formState.errors.name && (
              <p className="mt-2 text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          {form.formState.errors.root?.message && (
            <Alert className="border-destructive/30 bg-destructive/5">
              <AlertTitle className="font-semibold text-destructive">Save failed</AlertTitle>
              <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={form.formState.isSubmitting || !form.formState.isValid}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {form.formState.isSubmitting ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/(manage)/tags')}
              className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
            >
              Cancel
            </button>
          </div>

          <div className="pt-2 text-xs text-muted-foreground">
            Tip: Tags help group transactions across categories. Keep names short and memorable.
          </div>
        </form>
      )}
    </div>
  )
}
