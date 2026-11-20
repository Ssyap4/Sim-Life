import { CLINIC_MODULES, rankRequirements, type CareerId, type CareerProgress } from './careers';
import { careerEducation } from './careerEducation';
import type { GameState, CharacterId } from './protocol';

export function promotionNeeds(state: GameState, role: CharacterId, id: CareerId, p: CareerProgress) {
  if (p.rank === 4) return { missing: ['Достигнута высшая должность'], recommendations: [] as string[] };
  const rank = p.rank + 1;
  const conditions = new Set(p.clinicModules === CLINIC_MODULES.length ? ['Клинический практикум'] : []);
  const education = careerEducation(state.education.characters[role], rankRequirements(id, rank), p.experience, conditions);
  const missing = [...education.missing];
  if (p.qualityShifts < rank * 2) missing.push('Качественные смены ' + p.qualityShifts + '/' + rank * 2);
  if (p.reputation < 52 + rank * 5) missing.push('Репутация ' + p.reputation + '/' + (52 + rank * 5));
  if (p.duties < rank * 5) missing.push('Выполненные поручения ' + p.duties + '/' + rank * 5);
  return { missing, recommendations: education.recommendations };
}
