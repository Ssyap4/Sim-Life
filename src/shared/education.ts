import type { CharacterId } from './protocol';

export const SKILLS = {
  logic: ['🧩', 'Логика', 'Сравнение гипотез, поиск закономерностей и решение задач.'],
  creativity: ['🎨', 'Творчество', 'Композиция, работа с идеями и выразительные проекты.'],
  communication: ['💬', 'Общение', 'Умение слушать, объяснять и договариваться.'],
  technology: ['💻', 'Технологии', 'Работа с данными, инструментами и цифровыми системами.'],
  organization: ['🗂️', 'Организованность', 'Планирование, приоритеты и выполнение дел.'],
  attention: ['🔎', 'Внимательность', 'Поиск ошибок, проверка источников и наблюдение за деталями.'],
  cooking: ['🍲', 'Кулинария', 'Подготовка продуктов, рецепты и работа с кухней.'],
  fitness: ['👟', 'Физическая подготовка', 'Движение, координация и привычка к тренировкам.'],
  practical: ['🛠️', 'Практические навыки', 'Измерения, сборка и освоение инструментов.'],
} as const;
export type SkillId = keyof typeof SKILLS;
export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];
export const MAX_SKILL_LEVEL = 20;
export const isSkillId = (value: unknown): value is SkillId => typeof value === 'string' && Object.hasOwn(SKILLS, value);

const thresholds = [0];
for (let level = 0; level < MAX_SKILL_LEVEL; level++)
  thresholds.push(thresholds[level] + 58 + 11 * level + 2 * level * level);

export function skillRank(xp: number) {
  let level = 0;
  while (level < MAX_SKILL_LEVEL && xp >= thresholds[level + 1]) level++;
  return { level, current: xp - thresholds[level], next: level === MAX_SKILL_LEVEL ? 0 : thresholds[level + 1] - thresholds[level] };
}
export const levelXP = (level: number) => thresholds[level];
export const maximumXP = thresholds[MAX_SKILL_LEVEL];
export const talent = (role: CharacterId, skill: SkillId) =>
  (role === 'vlad' ? skill === 'logic' || skill === 'technology' : skill === 'creativity' || skill === 'communication') ? 10 : 0;
export const rankTitle = (level: number) => level < 4 ? 'Новичок' : level < 8 ? 'Начинающий специалист'
  : level < 12 ? 'Уверенная практика' : level < 16 ? 'Опытный специалист' : level < 19 ? 'Эксперт' : 'Мастер';

export type LearningChannel = 'tv' | 'book' | 'academy' | 'practice' | 'center' | 'exam';
export type StudyMaterial = {
  id: string; title: string; description: string; skill: SkillId; channel: LearningChannel;
  min: number; max: number; minutes: number; xp: number; price: number;
  question?: string; author?: string; secondary?: SkillId; series?: string; retired?: boolean;
  station?: 'classroom' | 'lab' | 'workshop'; sessions?: number; program?: string; certificate?: string;
};

export type StudyRecord = { minutes: number; completions: number };
export type Enrollment = { dates: number[]; attended: number; paid: number };
export type EducationEvent = { at: number; title: string; skill?: SkillId; xp?: number; milestone?: boolean };
export type EducationProfile = {
  xp: Record<SkillId, number>;
  studied: Record<string, StudyRecord>;
  enrollments: Record<string, Enrollment>;
  programs: string[];
  certificates: string[];
  goals: string[];
  achievements: string[];
  events: EducationEvent[];
};
export type EducationState = {
  licenses: string[];
  characters: Record<CharacterId, EducationProfile>;
};

export function initialEducation(): EducationState {
  const profile = (): EducationProfile => ({
    xp: Object.fromEntries(SKILL_IDS.map(skill => [skill, 0])) as Record<SkillId, number>,
    studied: {}, enrollments: {}, programs: [], certificates: [], goals: [], achievements: [], events: [],
  });
  return { licenses: [], characters: { vlad: profile(), alina: profile() } };
}

export type EducationCommand =
  | { type: 'education_buy' | 'education_cancel' | 'education_reschedule' | 'education_goal'; id: string; slot?: number }
  | { type: 'education_answer'; taskId: number; choice: number }
  | { type: 'study'; material: string };

export const REPEAT_FACTORS: readonly number[] = [1, .30, .10];
export const repeatFactor = (completions: number) => REPEAT_FACTORS[completions] ?? 0;
export const materialRepeatFactor = (material: StudyMaterial, completions: number) =>
  // Practical work stays a slower, viable free path within its current tier.
  // Television, books and paid courses stop granting XP after three runs.
  material.channel === 'practice' ? ([1, .60, .35, .20][completions] ?? .15) : repeatFactor(completions);
export function educationalXP(material: StudyMaterial, role: CharacterId, profile: EducationProfile) {
  const level = skillRank(profile.xp[material.skill]).level;
  if (level < material.min || level >= material.max) return 0;
  const repetitions = profile.studied[material.id]?.completions ?? 0;
  return Math.round(material.xp * materialRepeatFactor(material, repetitions) *
    (1 + talent(role, material.skill) / 100));
}

export type KnowledgeRequirement = {
  skills?: Partial<Record<SkillId, number>>;
  programs?: readonly string[];
  certificates?: readonly string[];
  modules?: readonly string[];
};
export function missingKnowledge(profile: EducationProfile, requirement: KnowledgeRequirement) {
  return [
    ...SKILL_IDS.filter(id => skillRank(profile.xp[id]).level < (requirement.skills?.[id] ?? 0))
      .map(id => SKILLS[id][1] + ' ' + requirement.skills![id]),
    ...(requirement.programs ?? []).filter(id => !profile.programs.includes(id)),
    ...(requirement.certificates ?? []).filter(id => !profile.certificates.includes(id)),
    ...(requirement.modules ?? []).filter(id => !profile.studied[id]?.completions),
  ];
}
export const CLASS_WINDOW = 90;
export const LESSON_HOURS = [10, 16] as const;
export function nextClassSlots(now: number): number[] {
  const day = Math.floor(now / 1440);
  return [day, day + 1, day + 2, day + 3].flatMap(d => LESSON_HOURS.map(h => d * 1440 + h * 60))
    .filter(at => at >= now + 15).slice(0, 4);
}
export const classDates = (first: number, count: number) => Array.from({ length: count }, (_, n) => first + n * 1440);
