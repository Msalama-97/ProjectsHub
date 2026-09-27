import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type Person, type Project, type User } from './api';

/** Mutation that refreshes all cached data on success and shows toasts. */
export function useSave<TVars = unknown, TRes = unknown>(fn: (v: TVars) => Promise<TRes>, successMsg?: string, onDone?: (r: TRes) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      qc.invalidateQueries();
      if (successMsg) toast.success(successMsg);
      onDone?.(r);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useForm<T extends Record<string, unknown>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const set =
    <K extends keyof T>(key: K) =>
    (v: T[K] | { target: { value: string } }) =>
      setValues((s) => ({
        ...s,
        [key]: v && typeof v === 'object' && 'target' in (v as object) ? (v as { target: { value: string } }).target.value : v,
      }));
  return { values, set, setValues, reset: () => setValues(initial) };
}

export const useProjects = (group = '') =>
  useQuery({ queryKey: ['projects', group], queryFn: () => api.get<Project[]>(`/projects${group ? `?group=${group}` : ''}`) });

export const usePeople = () => useQuery({ queryKey: ['people'], queryFn: () => api.get<Person[]>('/people') });

export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: () => api.get<User[]>('/users') });

/** Convert '' to null and numeric strings to numbers for API payloads. */
export function clean<T extends Record<string, unknown>>(v: T, numeric: (keyof T)[] = []) {
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) {
    if (val === '') out[k] = null;
    else if (numeric.includes(k as keyof T) && val !== null && val !== undefined) out[k] = Number(val);
    else out[k] = val;
  }
  return out;
}
