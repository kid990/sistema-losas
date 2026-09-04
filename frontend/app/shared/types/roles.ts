/** Roles del sistema */
export const ROLES = {
  ADMIN: { tipo: "trabajador" as const, rol: "Administrador" as const },
  SEGURIDAD: { tipo: "trabajador" as const, rol: "Seguridad" as const },
  USUARIO: { tipo: "usuario" as const },
} as const;

/** Tipo de un rol del sistema */
export type RolKey = keyof typeof ROLES;

/** Helper para verificar si un usuario tiene un rol específico */
export function matchRole(
  user: { tipo: string; rol?: string } | null | undefined,
  role: (typeof ROLES)[RolKey]
): boolean {
  if (!user) return false;
  if (role.tipo && user.tipo !== role.tipo) return false;
  if ("rol" in role && role.rol && user.rol !== role.rol) return false;
  return true;
}
