/**
 * CODE INSIGHT
 * This code's use case is to generate a complete user-scoped backup archive (ZIP) containing JSON data and optional receipt images.
 * This code's full epic context is the Backup & Export flow where a user can create a manual backup with an optional date range and receipts included.
 * This code's ui feel is not applicable (API route), but the behavior ensures reliability, security, and streaming-friendly delivery for large downloads.
 */

import archiver from "archiver";
import { PassThrough, Readable } from "stream";
import { basename } from "node:path";
import { supabaseServer } from "@/utils/supabase/client-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function badRequest(message: string) {
  return new Response(JSON.stringify({ code: "BAD_REQUEST", message }), {
    status: 400,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
      "x-content-type-options": "nosniff",
    },
  });
}

function unauthorized() {
  return new Response(JSON.stringify({ code: "UNAUTHORIZED", message: "Authentication required" }), {
    status: 401,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
      "x-content-type-options": "nosniff",
    },
  });
}

function serverError(message: string) {
  return new Response(JSON.stringify({ code: "INTERNAL_ERROR", message }), {
    status: 500,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
      "x-content-type-options": "nosniff",
    },
  });
}

function parseBooleanParam(value: string | null | undefined, fallback = true) {
  if (value == null) return fallback;
  const v = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(v)) return true;
  if (["false", "0", "no", "n"].includes(v)) return false;
  return fallback;
}

function isValidYMD(v: string | null | undefined): v is string {
  if (!v) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function buildFilename(start?: string | null, end?: string | null) {
  const toCompact = (d: string) => d.replaceAll("-", "");
  if (start && end) return `tris-backup-${toCompact(start)}-${toCompact(end)}.zip`;
  return "tris-backup-all.zip";
}

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function extractBucketAndPath(input: string): { bucket: string; path: string } | null {
  try {
    // If it's a plain storage path like "user123/2024/rcpt.jpg" assume receipts bucket
    if (!/^https?:\/\//i.test(input)) {
      const trimmed = input.replace(/^\/+/, "");
      return { bucket: "receipts", path: trimmed.startsWith("receipts/") ? trimmed.slice("receipts/".length) : trimmed };
    }

    const url = new URL(input);
    const parts = url.pathname.split("/").filter(Boolean);
    // Expect .../storage/v1/object/{public|sign}/<bucket>/<path...>
    const idx = parts.findIndex((p) => p === "object");
    if (idx >= 0 && parts[idx + 1] && parts[idx + 2]) {
      // parts[idx+1] is public/sign, parts[idx+2] is bucket
      const bucket = parts[idx + 2];
      const rest = parts.slice(idx + 3).join("/");
      if (bucket && rest) return { bucket, path: rest };
    }

    // Fallback: try to find a segment named 'receipts'
    const rIdx = parts.findIndex((p) => p === "receipts");
    if (rIdx >= 0) {
      const rest = parts.slice(rIdx + 1).join("/");
      return { bucket: "receipts", path: rest };
    }
  } catch (_) {
    // ignore
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const { data: auth, error: authError } = await supabaseServer.auth.getUser();
    if (authError || !auth?.user) return unauthorized();
    const userId = auth.user.id;

    const url = new URL(req.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const includeReceipts = parseBooleanParam(url.searchParams.get("includeReceipts"), true);

    if ((start && !isValidYMD(start)) || (end && !isValidYMD(end))) {
      return badRequest("Invalid date format. Use YYYY-MM-DD for start and end.");
    }
    if ((start && !end) || (!start && end)) {
      return badRequest("Both start and end must be provided together, or omit both to include all data.");
    }

    // Profile
    const { data: profilesData, error: profilesError } = await supabaseServer
      .from("profiles")
      .select("id, full_name, avatar_url, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle();
    if (profilesError) return serverError(`Failed to fetch profile: ${profilesError.message}`);

    // Build filters for transactions
    let txQuery = supabaseServer
      .from("transactions")
      .select("id, user_id, amount, occurred_at, category_id, payee, payment_method, notes, created_at, updated_at")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: true });

    if (start && end) {
      txQuery = txQuery.gte("occurred_at", `${start}T00:00:00.000Z`).lte("occurred_at", `${end}T23:59:59.999Z`);
    }

    const [txRes, categoriesRes, tagsRes, presetsRes, budgetsRes, recurringRes, settingsRes] = await Promise.all([
      txQuery,
      supabaseServer
        .from("categories")
        .select("id, user_id, name, is_favorite, created_at, updated_at")
        .eq("user_id", userId)
        .order("name", { ascending: true }),
      supabaseServer
        .from("tags")
        .select("id, user_id, name, is_favorite, created_at, updated_at")
        .eq("user_id", userId)
        .order("name", { ascending: true }),
      supabaseServer
        .from("presets")
        .select("id, user_id, name, amount, category_id, payee, payment_method, notes, is_favorite, created_at, updated_at")
        .eq("user_id", userId)
        .order("name", { ascending: true }),
      supabaseServer
        .from("category_budgets")
        .select("id, user_id, category_id, period_start, amount, alert_threshold_percent, created_at, updated_at")
        .eq("user_id", userId)
        .order("period_start", { ascending: false }),
      supabaseServer
        .from("recurring_transactions")
        .select(
          "id, user_id, amount, category_id, payee, payment_method, notes, frequency, interval, start_date, end_date, is_active, reminder_enabled, reminder_time, created_at, updated_at"
        )
        .eq("user_id", userId)
        .order("start_date", { ascending: true }),
      supabaseServer
        .from("user_settings")
        .select("id, user_id, primary_currency, time_zone, theme, notifications_enabled, created_at, updated_at")
        .eq("user_id", userId),
    ]);

    if (txRes.error) return serverError(`Failed to fetch transactions: ${txRes.error.message}`);
    if (categoriesRes.error) return serverError(`Failed to fetch categories: ${categoriesRes.error.message}`);
    if (tagsRes.error) return serverError(`Failed to fetch tags: ${tagsRes.error.message}`);
    if (presetsRes.error) return serverError(`Failed to fetch presets: ${presetsRes.error.message}`);
    if (budgetsRes.error) return serverError(`Failed to fetch budgets: ${budgetsRes.error.message}`);
    if (recurringRes.error) return serverError(`Failed to fetch recurring: ${recurringRes.error.message}`);
    if (settingsRes.error) return serverError(`Failed to fetch settings: ${settingsRes.error.message}`);

    const transactions = txRes.data ?? [];
    const categories = categoriesRes.data ?? [];
    const tags = tagsRes.data ?? [];
    const presets = presetsRes.data ?? [];
    const category_budgets = budgetsRes.data ?? [];
    const recurring_transactions = recurringRes.data ?? [];
    const user_settings = settingsRes.data ?? [];

    const txIds = transactions.map((t: any) => t.id);
    // Related: transaction_tags (filter by selected transactions)
    const { data: transaction_tags, error: txTagsErr } = txIds.length
      ? await supabaseServer
          .from("transaction_tags")
          .select("transaction_id, tag_id, created_at, updated_at")
          .in("transaction_id", txIds)
      : { data: [], error: null as any };
    if (txTagsErr) return serverError(`Failed to fetch transaction tags: ${txTagsErr.message}`);

    // Related: transaction_receipts (filter by selected transactions)
    const { data: transaction_receipts, error: txReceiptsErr } = txIds.length
      ? await supabaseServer
          .from("transaction_receipts")
          .select("id, transaction_id, url, content_type, created_at, updated_at")
          .in("transaction_id", txIds)
      : { data: [], error: null as any };
    if (txReceiptsErr) return serverError(`Failed to fetch transaction receipts: ${txReceiptsErr.message}`);

    // Related: preset_tags (filter by selected presets)
    const presetIds = presets.map((p: any) => p.id);
    const { data: preset_tags, error: presetTagsErr } = presetIds.length
      ? await supabaseServer
          .from("preset_tags")
          .select("preset_id, tag_id, created_at, updated_at")
          .in("preset_id", presetIds)
      : { data: [], error: null as any };
    if (presetTagsErr) return serverError(`Failed to fetch preset tags: ${presetTagsErr.message}`);

    // Prepare receipts if requested
    const warnings: string[] = [];
    let receiptsIncluded = 0;

    const receiptFiles: { archivePath: string; buffer: Buffer; contentType?: string }[] = [];
    const adjustedTransactionReceipts = [...(transaction_receipts ?? [])];

    if (includeReceipts && adjustedTransactionReceipts.length > 0) {
      const seenNames = new Set<string>();
      await Promise.all(
        adjustedTransactionReceipts.map(async (rec: any) => {
          try {
            const mapping = extractBucketAndPath(rec.url);
            if (!mapping) {
              warnings.push(`Could not derive storage path for receipt ${rec.id}`);
              return;
            }
            const { bucket, path } = mapping;
            const fileBase = safeFilename(`${rec.transaction_id}-${basename(path) || rec.id}`);
            let archivePath = `receipts/${fileBase}`;
            let suffix = 1;
            while (seenNames.has(archivePath)) {
              archivePath = `receipts/${fileBase.replace(/(\.[^.]*)?$/, (m) => `_${suffix}${m}`)}`;
              suffix += 1;
            }
            seenNames.add(archivePath);

            const dl = await supabaseServer.storage.from(bucket).download(path);
            if (dl.error || !dl.data) {
              warnings.push(`Failed to download receipt ${rec.id}: ${dl.error?.message ?? "unknown"}`);
              return;
            }
            const blob = dl.data as Blob;
            const arrayBuffer = await blob.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            receiptFiles.push({ archivePath, buffer, contentType: rec.content_type ?? blob.type });
            receiptsIncluded += 1;

            // Adjust the url to be relative path inside backup
            rec.url = archivePath;
          } catch (err: any) {
            warnings.push(`Error processing receipt ${rec.id}: ${err?.message ?? String(err)}`);
          }
        })
      );
    }

    const manifest = {
      version: "1.0.0",
      schemaVersion: 1,
      app: "Tris",
      exportedAt: new Date().toISOString(),
      range: start && end ? { start, end } : "all",
      includeReceipts,
      counts: {
        transactions: transactions.length,
        receipts: receiptsIncluded,
        categories: categories.length,
        tags: tags.length,
        presets: presets.length,
        budgets: category_budgets.length,
        recurring: recurring_transactions.length,
        settings: user_settings.length,
      },
      warnings,
    } as const;

    const data = {
      profile: profilesData ?? { id: userId },
      transactions,
      categories,
      tags,
      presets,
      budgets: category_budgets,
      recurring: recurring_transactions,
      settings: user_settings,
      transaction_tags: transaction_tags ?? [],
      preset_tags: preset_tags ?? [],
      transaction_receipts: adjustedTransactionReceipts,
    };

    const archive = archiver("zip", { zlib: { level: 9 } });
    const nodeStream = new PassThrough();
    archive.on("error", (err) => {
      nodeStream.destroy(err);
    });

    // Append JSON files
    archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });
    archive.append(JSON.stringify(data, null, 2), { name: "data.json" });

    // Append receipt files
    for (const file of receiptFiles) {
      archive.append(file.buffer, { name: file.archivePath, date: new Date() });
    }

    // Finalize archive building
    void archive.finalize();

    // Pipe to stream for response
    archive.pipe(nodeStream);

    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

    const filename = buildFilename(start, end);
    return new Response(webStream, {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename=${filename}`,
        "cache-control": "no-store, no-cache, must-revalidate",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (err: any) {
    return serverError(err?.message ?? "Unexpected error");
  }
}
