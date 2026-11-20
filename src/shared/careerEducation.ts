import { SKILL_IDS, missingKnowledge, type EducationProfile, type KnowledgeRequirement } from './education';
import { MATERIALS } from './educationCatalog';

export type CareerRequirements = KnowledgeRequirement & {
  professionId: string;
  positionId: string;
  experience?: number;
  conditions?: readonly string[];
};
export type CareerEventTemplate = {
  id: string;
  sender: 'manager' | 'colleague' | 'client' | 'administration';
  trigger: 'promotion' | 'training' | 'staffing' | 'quality' | 'deadline' | 'client-request';
  title: string;
  text: string;
  cooldownDays: number;
  choices: readonly { id: string; label: string; requires?: KnowledgeRequirement;
    effect?: { reputation?: number; productivity?: number; bonus?: number; followUp?: string } }[];
};

export function careerEducation(profile: EducationProfile, requirements: CareerRequirements,
  experience: number, conditions: ReadonlySet<string>) {
  const missing = missingKnowledge(profile, requirements);
  if (experience < (requirements.experience ?? 0)) missing.push('Профессиональный опыт ' + requirements.experience);
  for (const key of requirements.conditions ?? []) if (!conditions.has(key)) missing.push(key);
  const relevant = new Set(SKILL_IDS.filter(id => requirements.skills?.[id]));
  const recommendations = MATERIALS.filter(item => requirements.modules?.includes(item.id) ||
    item.program && requirements.programs?.includes(item.program) ||
    item.certificate && requirements.certificates?.includes(item.certificate) ||
    relevant.has(item.skill) && !item.price).map(item => item.id);
  return { eligible: missing.length === 0, missing, recommendations };
}

const situations = [
  ['promotion', 'Предложение о повышении', 'До следующей должности остался один учебный модуль.'],
  ['promotion', 'Расширение обязанностей', 'Руководитель предлагает обсудить зону ответственности и требования.'],
  ['promotion', 'План развития', 'На встрече нужна конкретная цель на следующий период.'],
  ['promotion', 'Проверка готовности', 'Коллеги готовы посмотреть демонстрацию самостоятельной работы.'],
  ['training', 'Новый инструмент', 'Команда переходит на новый инструмент. Нужен план освоения.'],
  ['training', 'Смена стандарта', 'Старый порядок работы обновили. Сверь правила до первой задачи.'],
  ['training', 'Обмен опытом', 'Коллега предлагает разобрать трудный пример вместе.'],
  ['training', 'Приглашение на аттестацию', 'Учебный центр открыл запись на проверку квалификации.'],
  ['staffing', 'Подмена смены', 'Коллега заболел. Руководитель уточняет, кто может помочь.'],
  ['staffing', 'Новый сотрудник', 'Новичку нужен короткий вводный разбор текущих задач.'],
  ['staffing', 'Передача дел', 'До конца недели нужно подготовить понятный список незавершённых задач.'],
  ['staffing', 'Разделение нагрузки', 'Два специалиста претендуют на один временной слот.'],
  ['quality', 'Неполная проверка', 'Перед сдачей обнаружился пропуск в контрольном списке.'],
  ['quality', 'Повторяющийся сбой', 'Сбой повторился в нескольких независимых задачах. Нужна причина.'],
  ['quality', 'Приёмка результата', 'Клиент сверит результат с согласованными критериями.'],
  ['quality', 'Уточнение записи', 'В отчёте встретились похожие записи. Их нужно разделить.'],
  ['deadline', 'Задержка поставки', 'Смежная команда предупредила о задержке исходных материалов.'],
  ['deadline', 'Две срочные задачи', 'Два запроса конкурируют за одного исполнителя.'],
  ['deadline', 'Перенос встречи', 'Команда предлагает перенести контрольную встречу.'],
  ['deadline', 'Резерв времени', 'План выполняется, но на финальную проверку почти не осталось времени.'],
  ['client-request', 'Новые пожелания', 'Клиент расширил исходный запрос после согласования объёма.'],
  ['client-request', 'Два варианта', 'Клиенту нужно объяснить различия двух решений.'],
  ['client-request', 'Неясный результат', 'Требования пока описаны общими словами.'],
  ['client-request', 'Запрос после сдачи', 'Клиент просит короткую инструкцию к полученному результату.'],
] as const;

const choices: Record<CareerEventTemplate['trigger'], CareerEventTemplate['choices']> = {
  promotion: [{ id: 'plan', label: 'Согласовать план и требования', effect: { followUp: 'request-training' } },
    { id: 'later', label: 'Вернуться к вопросу позже' }],
  training: [{ id: 'learn', label: 'Добавить материал в учебный план', effect: { followUp: 'training-plan' } },
    { id: 'ask', label: 'Уточнить обязательные темы' }],
  staffing: [{ id: 'help', label: 'Предложить помощь в пределах свободного времени',
    requires: { skills: { organization: 4 } }, effect: { reputation: 1 } }, { id: 'decline', label: 'Объяснить текущую загрузку' }],
  quality: [{ id: 'review', label: 'Провести проверку по шагам', requires: { skills: { attention: 4 } },
    effect: { productivity: 1 } }, { id: 'pair', label: 'Попросить повторную проверку у коллеги' }],
  deadline: [{ id: 'adjust', label: 'Пересогласовать сроки', requires: { skills: { communication: 3 } },
    effect: { followUp: 'confirm-deadline' } }, { id: 'assess', label: 'Сначала оценить объём работы' }],
  'client-request': [{ id: 'scope', label: 'Уточнить ожидания и зафиксировать объём', requires: { skills: { communication: 4 } },
    effect: { reputation: 1 } }, { id: 'follow-up', label: 'Назначить короткое обсуждение' }],
};
export const CAREER_EVENTS: readonly CareerEventTemplate[] = situations.map(([trigger, title, text], index) => ({
  id: trigger + '-' + index, trigger, title, text, choices: choices[trigger], cooldownDays: 4,
  sender: trigger === 'client-request' ? 'client' : trigger === 'training' ? 'administration' : trigger === 'quality' ? 'colleague' : 'manager',
}));
