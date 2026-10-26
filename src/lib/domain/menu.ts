/**
 * Dish customisation rules (client preview). The database re-validates every selection in
 * cart_add() / place_order(); these functions only drive the dish screen's live state.
 */
import { toCents } from './money';

export interface OptionGroup {
  id: string;
  name: string;
  selection_type: 'single' | 'multiple';
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  values: { id: string; name: string; additional_price: number | string; is_available: boolean }[];
}

/** First problem with a selection, per group id. Empty object = valid. */
export function selectionErrors(groups: OptionGroup[], selected: string[]): Record<string, string> {
  const chosen = new Set(selected);
  const out: Record<string, string> = {};
  for (const g of groups) {
    const n = g.values.filter((v) => chosen.has(v.id)).length;
    if (n < g.min_selections) out[g.id] = g.min_selections === 1 ? `Pick ${g.selection_type === 'single' ? 'one' : 'at least 1'} in “${g.name}”` : `Pick at least ${g.min_selections} in “${g.name}”`;
    else if (n > g.max_selections) out[g.id] = `Pick at most ${g.max_selections} in “${g.name}”`;
    else if (g.values.some((v) => chosen.has(v.id) && !v.is_available)) out[g.id] = `An option in “${g.name}” is sold out`;
  }
  return out;
}

/** Toggles a value respecting single/multiple rules; never exceeds max for multiple. */
export function toggleValue(groups: OptionGroup[], selected: string[], valueId: string): string[] {
  const g = groups.find((x) => x.values.some((v) => v.id === valueId));
  if (!g) return selected;
  const inGroup = new Set(g.values.map((v) => v.id));
  if (g.selection_type === 'single') return [...selected.filter((id) => !inGroup.has(id)), valueId];
  if (selected.includes(valueId)) return selected.filter((id) => id !== valueId);
  const count = selected.filter((id) => inGroup.has(id)).length;
  return count >= g.max_selections ? selected : [...selected, valueId];
}

/** Unit price in cents = base + selected option prices. */
export function unitPriceCents(base: number | string, groups: OptionGroup[], selected: string[]): number {
  const chosen = new Set(selected);
  return toCents(base) + groups.flatMap((g) => g.values).filter((v) => chosen.has(v.id)).reduce((s, v) => s + toCents(v.additional_price), 0);
}

/** Sensible starting selection: nothing, except single required groups with exactly one available value. */
export function defaultSelection(groups: OptionGroup[]): string[] {
  return groups.flatMap((g) => {
    const avail = g.values.filter((v) => v.is_available);
    return g.is_required && g.selection_type === 'single' && avail.length === 1 ? [avail[0].id] : [];
  });
}
