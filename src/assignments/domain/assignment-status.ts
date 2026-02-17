/**
 * Estados de Assignment (Entrega) - ProManage v1.0.0
 * Secuencia: PENDIENTE → ENTREGADO → REVISADO
 */

export enum AssignmentStatus {
  PENDIENTE = 'PENDIENTE',
  ENTREGADO = 'ENTREGADO',
  REVISADO = 'REVISADO',
}

/**
 * Transiciones válidas de estado
 */
export const VALID_ASSIGNMENT_TRANSITIONS: Record<AssignmentStatus, AssignmentStatus[]> = {
  [AssignmentStatus.PENDIENTE]: [AssignmentStatus.ENTREGADO],
  [AssignmentStatus.ENTREGADO]: [AssignmentStatus.REVISADO],
  [AssignmentStatus.REVISADO]: [], // Estado final
};

/**
 * Verifica si una transición de estado es válida
 */
export function isValidAssignmentTransition(
  currentStatus: AssignmentStatus,
  newStatus: AssignmentStatus,
): boolean {
  if (currentStatus === newStatus) return false;
  return VALID_ASSIGNMENT_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

/**
 * Obtiene los estados a los que se puede transicionar desde el estado actual
 */
export function getNextValidAssignmentStates(
  currentStatus: AssignmentStatus,
): AssignmentStatus[] {
  return VALID_ASSIGNMENT_TRANSITIONS[currentStatus] ?? [];
}

/**
 * Colores para cada estado (para UI)
 */
export const ASSIGNMENT_STATUS_COLORS: Record<AssignmentStatus, string> = {
  [AssignmentStatus.PENDIENTE]: '#F59E0B', // amber
  [AssignmentStatus.ENTREGADO]: '#3B82F6', // blue
  [AssignmentStatus.REVISADO]: '#10B981', // green
};

/**
 * Etiquetas legibles para cada estado
 */
export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  [AssignmentStatus.PENDIENTE]: 'Pendiente',
  [AssignmentStatus.ENTREGADO]: 'Entregado',
  [AssignmentStatus.REVISADO]: 'Revisado',
};
