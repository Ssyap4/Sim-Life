import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialState } from '../../src/shared/protocol';
import { SKILL_IDS } from '../../src/shared/education';
import { CHALLENGES, challengeCount } from '../../src/shared/educationChallenges';
import { ACTIVE_MATERIAL_COUNT, ARCHIVED_MATERIAL_COUNT, MATERIALS, MATERIAL_BY_ID,
  TOPICS, studyQuestion, studyQuestions } from '../../src/shared/educationCatalog';
import { applyEducation, studyDenial, validEducation } from '../education';

test('Public catalogue has 332 meaningful choices while 135 retired IDs remain loadable', () => {
  assert.equal(ACTIVE_MATERIAL_COUNT, 332);
  assert.equal(MATERIALS.length, 332);
  assert.equal(ARCHIVED_MATERIAL_COUNT, 135);
  assert.equal(MATERIAL_BY_ID.size, 467);
  assert.equal(new Set(MATERIALS.map(item => item.id)).size, MATERIALS.length);
  assert.ok(MATERIALS.every(item => !item.retired));
  for (const skill of SKILL_IDS) {
    const rows = MATERIALS.filter(item => item.skill === skill && !item.program && !item.certificate);
    assert.equal(rows.length, 35, skill);
    for (let tier = 0; tier < 5; tier++) {
      const tierRows = rows.filter(item => item.min === tier * 4);
      assert.equal(tierRows.length, 7, skill + ':' + tier);
      assert.equal(tierRows.filter(item => item.channel === 'book').length, 1);
      assert.equal(tierRows.filter(item => item.channel === 'practice').length, 1);
      assert.ok(tierRows.some(item => item.channel === 'center'));
    }
  }
});

test('All 180 distinct topic questions offer three answers and a meaningful explanation', () => {
  assert.equal(challengeCount, 135);
  const prompts = new Set<string>();
  for (const skill of SKILL_IDS) {
    assert.equal(TOPICS[skill].length, 5);
    assert.equal(CHALLENGES[skill].length, 5);
    for (let tier = 0; tier < 5; tier++) {
      assert.equal(CHALLENGES[skill][tier].length, 3);
      for (let variant = 0; variant < 4; variant++) {
        const id = skill + ':' + tier + ':' + variant;
        const question = studyQuestion(id);
        assert.ok(question, id);
        assert.equal(question.choices.length, 3, id);
        assert.ok(question.choices.every(choice => choice.trim().length > 0), id);
        assert.ok(question.explanation.length > (variant === 0 ? 5 : 15), id);
        assert.ok(question.answer >= 0 && question.answer <= 2, id);
        prompts.add(question.prompt);
      }
    }
  }
  assert.equal(prompts.size, 180);
  assert.equal(studyQuestion('logic:0:4'), undefined);
  assert.equal(studyQuestion('invalid:3:1'), undefined);
  assert.equal(studyQuestion('logic:10:1'), undefined);
});

test('Practical projects, Academy, course stages and qualification exams pose different questions', () => {
  const project = MATERIAL_BY_ID.get('practice:logic:0:project')!;
  const academic = MATERIAL_BY_ID.get('academy:logic:0')!;
  const premium = MATERIAL_BY_ID.get('academy:logic:0:plus')!;
  const course = MATERIAL_BY_ID.get('center:logic:0')!;
  const exam = MATERIAL_BY_ID.get('exam:logic')!;
  assert.equal(studyQuestions(project).length, 3);
  assert.equal(studyQuestions(academic).length, 2);
  assert.equal(studyQuestions(premium).length, 2);
  assert.notDeepEqual(studyQuestions(academic), studyQuestions(premium));
  assert.equal(studyQuestions(course, 0).length, 2);
  assert.equal(studyQuestions(course, 1).length, 2);
  assert.equal(studyQuestions(course, 2).length, 2);
  assert.notDeepEqual(studyQuestions(course, 0), studyQuestions(course, 2));
  assert.equal(studyQuestions(exam).length, 3);
  assert.equal(new Set(studyQuestions(exam)).size, 3);
});

test('Archived purchased materials and old lesson bookmarks remain valid; new purchases are blocked', () => {
  const state = initialState();
  const archived = MATERIAL_BY_ID.get('book:logic:0:plus')!;
  assert.ok(archived.retired);
  const attempt = applyEducation(state, 'vlad', {type: 'education_buy', id: archived.id});
  assert.equal(attempt.ok, false);
  state.education.licenses.push(archived.id);
  state.education.characters.vlad.studied[archived.id] = { minutes: Math.floor(archived.minutes / 2), completions: 1 };
  const oldFree = MATERIAL_BY_ID.get('practice:logic:0')!;
  assert.ok(oldFree.retired);
  state.education.characters.alina.studied[oldFree.id] = { minutes: 2, completions: 0 };
  assert.ok(validEducation(state.education));
  assert.equal(studyDenial(state, 'vlad', archived, 480), undefined);
  assert.equal(studyDenial(state, 'alina', oldFree, 480), undefined);
  assert.match(studyDenial(state, 'vlad', oldFree, 480) ?? '', /архив/);
});
