import type { Permission, UserRole } from '@/types'

const ADMIN_PERMISSIONS: Permission[] = [
  'canManageUsers',
  'canManageBooks',
  'canApprovePayments',
  'canViewAnalytics',
  'canManageFeatureFlags',
  'canManagePlatform',
  'canManageReels',
  'canManageAudiobooks',
  'canSuspendUsers',
  'canDeleteBooks',
  'canRestoreBooks',
  'canManagePlans',
  'canManagePaymentSettings',
  'canViewSecurity',
  'canManageGenres',
  'canManageHomepage',
  'canManageComments',
]

const WRITER_PERMISSIONS: Permission[] = []

const READER_PERMISSIONS: Permission[] = []

export function getPermissions(role: UserRole | undefined): Set<Permission> {
  if (role === 'admin') return new Set(ADMIN_PERMISSIONS)
  if (role === 'writer') return new Set(WRITER_PERMISSIONS)
  return new Set(READER_PERMISSIONS)
}

export function hasPermission(role: UserRole | undefined, permission: Permission): boolean {
  return getPermissions(role).has(permission)
}

export function hasAnyPermission(role: UserRole | undefined, ...permissions: Permission[]): boolean {
  const perms = getPermissions(role)
  return permissions.some((p) => perms.has(p))
}
