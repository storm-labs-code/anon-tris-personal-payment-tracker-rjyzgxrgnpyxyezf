'use client'

/**
 * CODE INSIGHT
 * This client component implements the New Preset form with offline-first behavior.
 * It fetches categories and tag suggestions through /api endpoints, falls back to localForage on 401/offline,
 * seeds demo data if necessary, and posts the preset to /api/presets or stores locally when offline.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import localforage from 'localforage';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

// LocalForage keys
const LF_CATEGORIES = 'tris.categories';
const LF_TAGS = 'tris.tags';
const LF_PRESETS = 'tris.presets';

// Types
interface Category {
  id: string;
  name: string;
  is_favorite: boolean;
  created_at?: string;
  updated_at?: string;
}

interface Tag {
  id: string;
  name: string;
  is_favorite?: boolean;
  created_at?: string;
  updated_at?: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const err: any = new Error('HTTP Error');
    err.status = res.status;
    throw err;
  }
  return res.json();
};

const presetSchema = z.object({
  name: z.string().min(1, 'Preset name is required'),
  amount: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (typeof v === 'number') return v;
      if (typeof v === 'string') {
        const t = v.trim();
        if (!t) return undefined;
        const n = Number(t.replace(/[,\s]/g, ''));
        return Number.isFinite(n) && n >= 0 ? n : undefined;
      }
      return undefined;
    }),
  category_id: z.union([z.string().uuid(), z.literal('')]).optional().transform((v) => (v && v.length ? v : undefined)),
  payee: z.string().optional(),
  notes: z.string().optional(),
});

type PresetFormValues = z.infer<typeof presetSchema>;

async function seedLocalDemo() {
  const [cats, tags, presets] = await Promise.all([
    localforage.getItem<Category[]>(LF_CATEGORIES),
    localforage.getItem<Tag[]>(LF_TAGS),
    localforage.getItem<any[]>(LF_PRESETS),
  ]);

  const now = new Date().toISOString();

  if (!cats || cats.length === 0) {
    const c1 = { id: crypto.randomUUID(), name: '식비', is_favorite: true, created_at: now, updated_at: now };
    const c2 = { id: crypto.randomUUID(), name: '교통', is_favorite: true, created_at: now, updated_at: now };
    const c3 = { id: crypto.randomUUID(), name: '카페', is_favorite: false, created_at: now, updated_at: now };
    const c4 = { id: crypto.randomUUID(), name: '쇼핑', is_favorite: false, created_at: now, updated_at: now };
    await localforage.setItem(LF_CATEGORIES, [c1, c2, c3, c4]);
  }

  if (!tags || tags.length === 0) {
    const t1 = { id: crypto.randomUUID(), name: '점심', is_favorite: true, created_at: now, updated_at: now } as Tag;
    const t2 = { id: crypto.randomUUID(), name: '출근', is_favorite: false, created_at: now, updated_at: now } as Tag;
    const t3 = { id: crypto.randomUUID(), name: '디저트', is_favorite: false, created_at: now, updated_at: now } as Tag;
    await localforage.setItem(LF_TAGS, [t1, t2, t3]);
  }

  if (!presets || presets.length === 0) {
    const lcats = (await localforage.getItem<Category[]>(LF_CATEGORIES)) || [];
    const ltags = (await localforage.getItem<Tag[]>(LF_TAGS)) || [];
    const findCat = (name: string) => lcats.find((c) => c.name === name)?.id;

    const p1 = {
      id: crypto.randomUUID(),
      name: '편의점 커피',
      amount: 2000,
      category_id: findCat('카페') || null,
      payee: 'GS25',
      notes: '아침 출근길',
      default_tag_names: ltags.filter((t) => t.name === '디저트').map((t) => t.name),
      is_favorite: true,
      created_at: now,
      updated_at: now,
    };
    const p2 = {
      id: crypto.randomUUID(),
      name: '지하철',
      amount: 1350,
      category_id: findCat('교통') || null,
      payee: '서울교통공사',
      notes: '',
      default_tag_names: ltags.filter((t) => t.name === '출근').map((t) => t.name),
      is_favorite: false,
      created_at: now,
      updated_at: now,
    };
    await localforage.setItem(LF_PRESETS, [p1, p2]);
  }
}

export default function Client() {
  const router = useRouter();
  const [demoMode, setDemoMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    seedLocalDemo();
  }, []);

  const { data: categories, error: catError, isLoading: catLoading, mutate: mutateCategories } = useSWR<Category[]>(
    '/api/categories',
    fetcher,
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (catError) {
      setDemoMode(true);
      (async () => {
        const local = (await localforage.getItem<Category[]>(LF_CATEGORIES)) || [];
        mutateCategories(local, false);
      })();
    }
  }, [catError, mutateCategories]);

  const favoritesFirst = useMemo(() => {
    const list = categories || [];
    const favs = list.filter((c) => c.is_favorite);
    const rest = list.filter((c) => !c.is_favorite);
    return { favs, rest };
  }, [categories]);

  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<Tag[]>([]);
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);
  const tagReqController = useRef<AbortController | null>(null);

  // Debounced tag suggestions
  useEffect(() => {
    const q = tagInput.trim();
    if (!q) {
      setTagSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        tagReqController.current?.abort();
        tagReqController.current = new AbortController();
        const res = await fetch(`/api/tags?search=${encodeURIComponent(q)}`, {
          cache: 'no-store',
          signal: tagReqController.current.signal,
        });
        if (!res.ok) throw new Error('tags_fetch_error');
        const data: Tag[] = await res.json();
        setTagSuggestions(data.slice(0, 20));
      } catch (e) {
        // Offline or unauthorized
        setDemoMode(true);
        const local = (await localforage.getItem<Tag[]>(LF_TAGS)) || [];
        const filtered = local.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()));
        setTagSuggestions(filtered.slice(0, 20));
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [tagInput]);

  const addTagName = (name: string) => {
    const cleaned = name.trim();
    if (!cleaned) return;
    setSelectedTagNames((prev) => {
      const exists = prev.some((n) => n.toLowerCase() === cleaned.toLowerCase());
      return exists ? prev : [...prev, cleaned];
    });
    setTagInput('');
  };

  const removeTag = (name: string) => {
    setSelectedTagNames((prev) => prev.filter((n) => n !== name));
  };

  const onTagEnterCreate = async () => {
    const name = tagInput.trim();
    if (!name) return;
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.status === 201 || res.status === 200) {
        addTagName(name);
      } else if (res.status === 409) {
        // Already exists — just add
        addTagName(name);
      } else if (res.status === 401) {
        setDemoMode(true);
        // offline path handled below
        throw new Error('unauthorized');
      } else {
        // Fallback to adding locally without server write
        addTagName(name);
      }
    } catch {
      setDemoMode(true);
      // Write to local tags store
      const now = new Date().toISOString();
      const local = (await localforage.getItem<Tag[]>(LF_TAGS)) || [];
      if (!local.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
        local.push({ id: crypto.randomUUID(), name, is_favorite: false, created_at: now, updated_at: now });
        await localforage.setItem(LF_TAGS, local);
      }
      addTagName(name);
    }
  };

  const form = useForm<PresetFormValues>({
    resolver: zodResolver(presetSchema),
    defaultValues: { name: '', amount: undefined, category_id: undefined, payee: '', notes: '' },
    mode: 'onChange',
  });

  const onSubmit = async (values: PresetFormValues) => {
    setSubmitting(true);
    const payload = {
      name: values.name.trim(),
      default_amount: values.amount ?? undefined,
      category_id: values.category_id || undefined,
      payee: values.payee?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
      default_tag_names: selectedTagNames,
    } as const;

    try {
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 201 || res.status === 200) {
        router.push('/(manage)/presets');
        return;
      }

      if (res.status === 401) {
        // Offline/unauth fallback
        throw new Error('unauthorized');
      }

      // Unexpected server response — show inline error but keep user data safe locally
      setDemoMode(true);
      await savePresetLocally(payload);
      router.push('/(manage)/presets');
    } catch (e) {
      // Network or 401
      setDemoMode(true);
      await savePresetLocally(payload);
      router.push('/(manage)/presets');
    } finally {
      setSubmitting(false);
    }
  };

  async function savePresetLocally(payload: {
    name: string;
    default_amount?: number;
    category_id?: string;
    payee?: string;
    notes?: string;
    default_tag_names: string[];
  }) {
    const now = new Date().toISOString();
    const existing = (await localforage.getItem<any[]>(LF_PRESETS)) || [];
    const record = {
      id: crypto.randomUUID(),
      name: payload.name,
      amount: payload.default_amount ?? null,
      category_id: payload.category_id ?? null,
      payee: payload.payee ?? null,
      notes: payload.notes ?? null,
      default_tag_names: payload.default_tag_names ?? [],
      is_favorite: false,
      created_at: now,
      updated_at: now,
    };
    // Ensure tags are present offline
    if (payload.default_tag_names?.length) {
      const localTags = (await localforage.getItem<Tag[]>(LF_TAGS)) || [];
      let changed = false;
      payload.default_tag_names.forEach((n) => {
        if (!localTags.some((t) => t.name.toLowerCase() === n.toLowerCase())) {
          localTags.push({ id: crypto.randomUUID(), name: n, is_favorite: false, created_at: now, updated_at: now });
          changed = true;
        }
      });
      if (changed) await localforage.setItem(LF_TAGS, localTags);
    }
    existing.unshift(record);
    await localforage.setItem(LF_PRESETS, existing);
  }

  const amountValue = form.watch('amount');

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">New Preset</h1>
        <button
          type="button"
          onClick={() => router.push('/(manage)/presets')}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>

      {demoMode && (
        <div className="mt-4">
          <Alert className="border-primary/30 bg-primary/5">
            <AlertTitle className="font-medium">Demo mode: data stored locally</AlertTitle>
            <AlertDescription>
              You're offline or not signed in. Your changes will be saved on this device and synced later.
            </AlertDescription>
          </Alert>
        </div>
      )}

      <section className="mt-4 rounded-xl border bg-card text-card-foreground shadow-sm">
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 sm:p-6 space-y-6">
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-sm font-medium">Preset name</label>
            <input
              id="name"
              type="text"
              placeholder="e.g., Morning Coffee"
              {...form.register('name')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="amount" className="text-sm font-medium">Default amount</label>
              <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ring-offset-background transition">
                <span className="px-3 text-muted-foreground">₩</span>
                <input
                  id="amount"
                  inputMode="numeric"
                  placeholder="0"
                  className="flex-1 bg-transparent px-2 py-2 text-sm outline-none"
                  value={typeof amountValue === 'number' ? String(amountValue) : (amountValue as any) || ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    // allow empty
                    if (raw.trim() === '') {
                      form.setValue('amount', undefined, { shouldDirty: true, shouldValidate: true });
                      return;
                    }
                    const n = Number(raw.replace(/[,\s]/g, ''));
                    if (Number.isFinite(n) && n >= 0) form.setValue('amount', n, { shouldDirty: true, shouldValidate: true });
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">KRW (원) · Optional</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="category" className="text-sm font-medium">Category</label>
              <div className="relative">
                {catLoading && !categories ? (
                  <Skeleton className="h-10 w-full rounded-md" />
                ) : (
                  <select
                    id="category"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition"
                    value={form.watch('category_id') || ''}
                    onChange={(e) => form.setValue('category_id', e.target.value || undefined, { shouldDirty: true })}
                  >
                    <option value="">No category</option>
                    {favoritesFirst.favs.length > 0 && (
                      <optgroup label="★ Favorites">
                        {favoritesFirst.favs.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="All categories">
                      {favoritesFirst.rest.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                  </select>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Can't find it? Manage in <button type="button" onClick={() => router.push('/(manage)/categories')} className="underline underline-offset-2 hover:text-foreground">Categories</button>.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="payee" className="text-sm font-medium">Default payee</label>
              <input
                id="payee"
                type="text"
                placeholder="e.g., Starbucks"
                {...form.register('payee')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="notes" className="text-sm font-medium">Notes</label>
              <input
                id="notes"
                type="text"
                placeholder="Optional notes"
                {...form.register('notes')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Default tags</label>
              <span className="text-xs text-muted-foreground">Press Enter to add a new tag</span>
            </div>
            <div className="rounded-md border border-input bg-background p-2">
              <div className="flex flex-wrap items-center gap-2">
                {selectedTagNames.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-1 text-xs">
                    {t}
                    <button
                      type="button"
                      onClick={() => removeTag(t)}
                      className="rounded-full p-0.5 text-primary/70 hover:text-primary hover:bg-primary/20 transition"
                      aria-label={`Remove tag ${t}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onTagEnterCreate();
                    } else if (e.key === ',' && tagInput.trim().length > 0) {
                      e.preventDefault();
                      onTagEnterCreate();
                    }
                  }}
                  placeholder="Add tag"
                  className="min-w-[100px] flex-1 bg-transparent px-2 py-1.5 text-sm outline-none"
                />
              </div>
              {tagInput.trim() && tagSuggestions.length > 0 && (
                <div className="mt-2 max-h-44 overflow-auto rounded-md border border-input bg-popover text-popover-foreground shadow-sm">
                  {tagSuggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => addTagName(s.name)}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Separator className="my-2" />

          <div className="sticky bottom-4 z-10">
            <div className="rounded-xl border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-3 flex items-center justify-end gap-3 shadow-sm">
              <button
                type="button"
                onClick={() => router.push('/(manage)/presets')}
                className="inline-flex h-10 items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || form.formState.isSubmitting}
                className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition"
              >
                {submitting || form.formState.isSubmitting ? 'Saving…' : 'Save Preset'}
              </button>
            </div>
          </div>
        </form>
      </section>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        Need to review your presets? <button className="underline underline-offset-2 hover:text-foreground" onClick={() => router.push('/(manage)/presets')}>Back to Presets</button>
      </div>
    </main>
  );
}
