/**
 * Estados de Proyecto - ProManage v1.0.0
 * Secuencia: draft → in_progress → in_review → completed
 */

export enum ProjectStatus {
  DRAFT = 'draft',
  IN_PROGRESS = 'in_progress',
  IN_REVIEW = 'in_review',
  COMPLETED = 'completed',
}

/**
 * Transiciones válidas de estado
 * Define qué estados pueden pasar a qué otros estados
 */
export const VALID_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  [ProjectStatus.DRAFT]: [ProjectStatus.IN_PROGRESS],
  [ProjectStatus.IN_PROGRESS]: [ProjectStatus.IN_REVIEW],
  [ProjectStatus.IN_REVIEW]: [
    ProjectStatus.IN_PROGRESS,
    ProjectStatus.COMPLETED,
  ],
  [ProjectStatus.COMPLETED]: [], // Estado final, no hay transiciones
};

/**
 * Verifica si una transición de estado es válida
 */
export function isValidTransition(
  currentStatus: ProjectStatus,
  newStatus: ProjectStatus,
): boolean {
  // Si es el mismo estado, no es una transición
  if (currentStatus === newStatus) return false;

  return VALID_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

/**
 * Obtiene los estados a los que se puede transicionar desde el estado actual
 */
export function getNextValidStates(
  currentStatus: ProjectStatus,
): ProjectStatus[] {
  return VALID_TRANSITIONS[currentStatus] ?? [];
}

/**
 * Colores para cada estado (para UI)
 */
export const STATUS_COLORS: Record<ProjectStatus, string> = {
  [ProjectStatus.DRAFT]: '#9CA3AF',
  [ProjectStatus.IN_PROGRESS]: '#2563EB',
  [ProjectStatus.IN_REVIEW]: '#F59E0B',
  [ProjectStatus.COMPLETED]: '#10B981',
};

/**
 * Etiquetas legibles para cada estado
 */
export const STATUS_LABELS: Record<ProjectStatus, string> = {
  [ProjectStatus.DRAFT]: 'Borrador',
  [ProjectStatus.IN_PROGRESS]: 'En Progreso',
  [ProjectStatus.IN_REVIEW]: 'En Revisión',
  [ProjectStatus.COMPLETED]: 'Completado',
};
