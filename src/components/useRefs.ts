import { useCallback, useEffect, useState } from 'react';
import type { Resource, Row } from '../resources';
import { supabase } from '../lib/supabase';

export interface RefOption { id: string; label: string; active: boolean }
export type RefOptions = Record<string, RefOption[]>;

/** Carrega les opcions de tots els camps de tipus "ref" dels recursos indicats */
export function useRefs(resources: (Resource | undefined)[], schoolId: string | undefined) {
  const [refs, setRefs] = useState<RefOptions>({});

  const load = useCallback(async () => {
    if (!schoolId) return;
    const fields = resources.flatMap((r) => r?.fields ?? []).filter((f) => f.type === 'ref' && f.ref);
    const byTable = new Map<string, Promise<Row[]>>();
    const out: RefOptions = {};
    await Promise.all(fields.map(async (f) => {
      const ref = f.ref!;
      if (!byTable.has(ref.table)) {
        byTable.set(ref.table, Promise.resolve(supabase.from(ref.table).select(ref.select).eq('school_id', schoolId).limit(2000))
          .then(({ data }) => (data as Row[] | null) ?? []));
      }
      const rows = await byTable.get(ref.table)!;
      out[f.name] = rows
        .map((r) => ({ id: r.id, label: ref.label(r), active: !ref.activeOnly || r.active !== false }))
        .sort((a, b) => a.label.localeCompare(b.label, 'ca'));
    }));
    setRefs(out);
  }, [schoolId, resources.map((r) => r?.key).join()]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const label = useCallback((field: string, id: unknown) =>
    id ? refs[field]?.find((o) => o.id === id)?.label ?? '…' : '', [refs]);

  return { refs, label, reloadRefs: load };
}
