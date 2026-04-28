import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  applyNotesFilters,
  parseNotesFiltersFromSearchParams,
} from "@/lib/notes-query";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

// Paginated read of a resident's note timeline. Drives the "Load older
// notes" affordance on the resident detail page. RLS scopes access by
// org and respects sensitive-flag rules — this route does not
// independently filter on user_id.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const before = url.searchParams.get("before");
  const limitRaw = Number(url.searchParams.get("limit") ?? DEFAULT_PAGE_SIZE);
  const limit = Math.min(
    Math.max(1, Number.isFinite(limitRaw) ? limitRaw : DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE
  );

  const rawParams: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    rawParams[key] = value;
  });
  const filters = parseNotesFiltersFromSearchParams(rawParams);

  let query = supabase
    .from("notes")
    .select(
      `
      *,
      residents (first_name, last_name),
      users:author_id (full_name)
    `
    )
    .eq("resident_id", id)
    .order("created_at", { ascending: false })
    .limit(limit);

  query = applyNotesFilters(query, filters);

  if (before) {
    // Keyset pagination: fetch rows strictly older than the cursor.
    // The (resident_id, created_at DESC) index serves this in O(log n).
    query = query.lt("created_at", before);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const notes = data ?? [];
  return NextResponse.json({
    notes,
    hasMore: notes.length === limit,
  });
}
