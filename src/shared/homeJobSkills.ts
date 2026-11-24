import { SKILLS, skillRank, type SkillId, type EducationProfile } from './education';
import { isHomeJob, type HomeJobId, type ShiftAssignment } from './jobs';

/** Home orders are incidental practice, never a replacement for courses. */
export const HOME_JOB_SKILLS = {
  vibeSite:'technology', vibeBot:'logic', videoEdit:'creativity', marketTrade:'logic',
  gameFix:'attention', automation:'organization',
  wbCards:'creativity', ozonCards:'attention', hairLesson:'communication',
  support:'communication', socialDesign:'creativity', hairConsult:'practical',
} as const satisfies Record<HomeJobId,SkillId>;

export function homeJobSkillXP(profile:EducationProfile,shift:ShiftAssignment,fraction:number){
  if(!isHomeJob(shift.job)||!shift.homeDevice||!Number.isFinite(fraction)||fraction<=0)return;
  const skill=HOME_JOB_SKILLS[shift.job],rank=skillRank(profile.xp[skill]);
  if(!rank.next)return;
  const quests=shift.quests??[];
  const accuracy=quests.length?quests.filter(q=>q.result==='correct').length/quests.length:0;
  // Integer XP; novice level needs 58 XP, so one point is already ~1.72%.
  // No talent multiplier: a full order never grants more than 2% of the current level.
  const full=Math.min(Math.floor(rank.next*.02),Math.max(1,Math.floor(rank.next*(.012+.008*accuracy))));
  const xp=Math.floor(full*Math.min(1,fraction));
  if(!xp)return;
  return {skill,xp,percent:xp/rank.next*100};
}
export function homeJobSkillLabel(job:HomeJobId){const skill=HOME_JOB_SKILLS[job];return SKILLS[skill][0]+' '+SKILLS[skill][1];}
