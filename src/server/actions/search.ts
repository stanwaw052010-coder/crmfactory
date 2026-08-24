"use server";

import { requireAuth } from "@/lib/auth/context";
import { globalSearch, type SearchResult } from "@/server/queries/search";
import { ok, toActionError, type ActionResult } from "@/lib/errors";
import { consume, LIMITS } from "@/lib/rate-limit";

export async function searchAction(query: string): Promise<ActionResult<SearchResult[]>> {
  try {
    const ctx = await requireAuth();
    const limit = consume(`search:${ctx.user.id}`, LIMITS.search.limit, LIMITS.search.windowSec);
    if (!limit.allowed) return ok([]);

    const results = await globalSearch(ctx.organization.id, query);
    return ok(results);
  } catch (error) {
    return toActionError(error);
  }
}
