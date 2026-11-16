import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { applyBrand } from './brand';

export type Role = 'admin' | 'gestor' | 'docent';
export interface School { id: string; name: string; slug: string; is_demo: boolean; role: Role | null; brand_color: string | null; logo_path: string | null }
export interface ModuleDef { key: string; name: string; description: string; sort: number }
export interface Member { id: string; email: string; full_name: string | null; role: Role; active: boolean }

interface SchoolCtx {
  loading: boolean;
  schools: School[];
  school: School | null;
  role: Role | null;
  isStaff: boolean;          // admin o gestor
  isPlatformAdmin: boolean;
  readOnly: boolean;         // demo o sense rol
  modules: ModuleDef[];
  enabled: Set<string>;
  lists: Record<string, string[]>;
  members: Member[];
  me: Member | null;
  selectSchool: (id: string | null) => void;
  reload: () => Promise<void>;
}

const Ctx = createContext<SchoolCtx>(null!);
const KEY = 'fabaula.school';

export function SchoolProvider({ children }: { children: ReactNode }) {
  const { session, email } = useAuth();
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState<string | null>(() => localStorage.getItem(KEY));
  const [isPlatformAdmin, setPlatformAdmin] = useState(false);
  const [modules, setModules] = useState<ModuleDef[]>([]);
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [lists, setLists] = useState<Record<string, string[]>>({});
  const [members, setMembers] = useState<Member[]>([]);

  const loadSchools = useCallback(async () => {
    const [{ data: s }, { data: p }, { data: m }] = await Promise.all([
      supabase.rpc('my_schools'),
      supabase.from('platform_admins').select('email'),
      supabase.from('modules').select('*').order('sort'),
    ]);
    setSchools((s as School[]) ?? []);
    setPlatformAdmin((p?.length ?? 0) > 0);
    setModules((m as ModuleDef[]) ?? []);
    return (s as School[]) ?? [];
  }, []);

  const loadSchoolData = useCallback(async (id: string) => {
    const [{ data: sm }, { data: li }, { data: mem }] = await Promise.all([
      supabase.from('school_modules').select('module, enabled').eq('school_id', id),
      supabase.from('list_items').select('list_key, value, sort').eq('school_id', id).eq('active', true).order('sort'),
      supabase.from('school_members').select('id, email, full_name, role, active').eq('school_id', id).order('email'),
    ]);
    setEnabled(new Set((sm ?? []).filter((r) => r.enabled).map((r) => r.module as string)));
    const l: Record<string, string[]> = {};
    for (const r of li ?? []) (l[r.list_key] ??= []).push(r.value);
    setLists(l);
    setMembers((mem as Member[]) ?? []);
  }, []);

  const reload = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const list = await loadSchools();
    let id = schoolId;
    if (id && !list.some((s) => s.id === id)) id = null;
    if (!id) {
      const own = list.filter((s) => s.role);
      if (own.length === 1) id = own[0].id;
    }
    if (id !== schoolId) setSchoolId(id);
    if (id) await loadSchoolData(id);
    setLoading(false);
  }, [session, schoolId, loadSchools, loadSchoolData]);

  useEffect(() => { reload(); }, [session?.user.id, schoolId]); // eslint-disable-line react-hooks/exhaustive-deps

  const school = schools.find((s) => s.id === schoolId) ?? null;
  const role = school?.role ?? null;

  useEffect(() => { applyBrand(school?.brand_color ?? null); }, [school?.brand_color]);

  const value: SchoolCtx = {
    loading,
    schools,
    school,
    role,
    isStaff: role === 'admin' || role === 'gestor',
    isPlatformAdmin,
    readOnly: !role || Boolean(school?.is_demo),
    modules,
    enabled,
    lists,
    members,
    me: members.find((m) => m.email === email) ?? null,
    selectSchool(id) {
      if (id) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY);
      setSchoolId(id);
    },
    reload,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSchool = () => useContext(Ctx);
