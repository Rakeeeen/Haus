/** How a project has been used on this device: when it was last chosen or opened, and how many times. */
export type ProjectUse = Record<string, { last: number; count: number }>;

/** `use` after the project `id` was chosen or opened at `now`. */
export function noteUse(use: ProjectUse, id: string, now: number = Date.now()): ProjectUse {
  return { ...use, [id]: { last: now, count: (use[id]?.count ?? 0) + 1 } };
}

/** A stored value that is a usable `ProjectUse`. */
export const isProjectUse = (value: unknown): value is ProjectUse =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
  && Object.values(value).every((v) => !!v && typeof (v as { last?: unknown }).last === 'number' && typeof (v as { count?: unknown }).count === 'number');

type Named = { id: string; name: string };

/** The projects most recently used first, for a dropdown; those never used follow, by name. */
export function byRecentUse<T extends Named>(projects: readonly T[], use: ProjectUse): T[] {
  return [...projects].sort((a, b) => (use[b.id]?.last ?? 0) - (use[a.id]?.last ?? 0) || a.name.localeCompare(b.name));
}

/** The projects opened most often first (the more recent one, on a tie); those never opened follow, by name. */
export function byMostOpened<T extends Named>(projects: readonly T[], use: ProjectUse): T[] {
  return [...projects].sort((a, b) =>
    (use[b.id]?.count ?? 0) - (use[a.id]?.count ?? 0) || (use[b.id]?.last ?? 0) - (use[a.id]?.last ?? 0) || a.name.localeCompare(b.name));
}
