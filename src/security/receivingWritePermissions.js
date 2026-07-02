import { hasRoleFunctionWriteAccess } from './roleFunctionPermissions.js';

export function canPerformReceivingWrite(userRole) {
  return hasRoleFunctionWriteAccess(userRole, 'receiving');
}
