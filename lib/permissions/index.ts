import type { OrganizationRole } from "@/lib/supabase/types";

export type OrganizationPermission =
  | "organization:read"
  | "organization:manage"
  | "members:read"
  | "members:manage"
  | "campaigns:read"
  | "campaigns:write"
  | "contacts:read"
  | "contacts:write"
  | "calls:read"
  | "calls:write"
  | "analytics:read"
  | "billing:read"
  | "billing:manage"
  | "settings:manage"
  | "api_keys:manage"
  | "audit:read";

const rolePermissions: Record<OrganizationRole, ReadonlySet<OrganizationPermission>> = {
  OWNER: new Set<OrganizationPermission>([
    "organization:read",
    "organization:manage",
    "members:read",
    "members:manage",
    "campaigns:read",
    "campaigns:write",
    "contacts:read",
    "contacts:write",
    "calls:read",
    "calls:write",
    "analytics:read",
    "billing:read",
    "billing:manage",
    "settings:manage",
    "api_keys:manage",
    "audit:read",
  ]),
  ADMIN: new Set<OrganizationPermission>([
    "organization:read",
    "organization:manage",
    "members:read",
    "members:manage",
    "campaigns:read",
    "campaigns:write",
    "contacts:read",
    "contacts:write",
    "calls:read",
    "calls:write",
    "analytics:read",
    "billing:read",
    "settings:manage",
    "audit:read",
  ]),
  MEMBER: new Set<OrganizationPermission>([
    "organization:read",
    "members:read",
    "campaigns:read",
    "campaigns:write",
    "contacts:read",
    "contacts:write",
    "calls:read",
    "calls:write",
    "analytics:read",
  ]),
  VIEWER: new Set<OrganizationPermission>([
    "organization:read",
    "members:read",
    "campaigns:read",
    "contacts:read",
    "calls:read",
    "analytics:read",
  ]),
};

const roleRank: Record<OrganizationRole, number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4,
};

export function hasPermission(
  role: OrganizationRole,
  permission: OrganizationPermission
): boolean {
  return rolePermissions[role].has(permission);
}

export function hasMinimumRole(
  role: OrganizationRole,
  minimumRole: OrganizationRole
): boolean {
  return roleRank[role] >= roleRank[minimumRole];
}

export interface SecurityContext {
  userId: string;
  businessId: string;
  role?: OrganizationRole;
}

export function assertBusinessOwnership(
  resourceBusinessId: string,
  context: SecurityContext
): void {
  if (resourceBusinessId !== context.businessId) {
    throw new Error("ACCESS_DENIED: User does not have access to the requested business resource.");
  }
}

export function assertPermission(
  context: SecurityContext,
  permission: OrganizationPermission
): void {
  if (!context.role || !hasPermission(context.role, permission)) {
    throw new Error("ACCESS_DENIED: User does not have the required permission.");
  }
}

export function assertMinimumRole(
  context: SecurityContext,
  minimumRole: OrganizationRole
): void {
  if (!context.role || !hasMinimumRole(context.role, minimumRole)) {
    throw new Error("ACCESS_DENIED: User does not have the required organization role.");
  }
}

export { rolePermissions, roleRank };
