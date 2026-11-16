/**
 * CareerSystem — 지금 하는 일과 경력 기록.
 * 상태 조각: state.character.career = { current: { jobId, since } | null, history: [{ jobId, from, to, reason }] }
 *
 * 초기 배경은 ‘처음 일자리’만 정해요. 그 뒤로 일은 이 시스템을 통해서만 바뀌어요.
 * 다음 PHASE 의 취업·퇴사·이직·창업은 모두 change() 하나로 기록을 남기며 바꾸면 돼요.
 * (current 가 null 이면 무직)
 */
import { JOBS } from '../data/world.js';

export const JOB_TYPE_LABEL = { shift: '시간제', office: '정규직', freelance: '프리랜서' };

export const create = (jobId, day = 1) => ({ current: jobId ? { jobId, since: day } : null, history: [] });

/** 지금 일자리 정의 (없으면 null) */
export const currentJob = (character) => JOBS[character.career?.current?.jobId] ?? null;
export const currentSince = (character) => character.career?.current?.since ?? null;

/**
 * 일을 바꿔요 (취업·퇴사·이직·창업 공통). jobId 가 null 이면 퇴사(무직).
 * 같은 일로 바꾸면 아무것도 하지 않아요. 바뀐 경우 true.
 */
export function change(character, jobId, day, reason = '') {
  const cur = character.career.current;
  if ((cur?.jobId ?? null) === (jobId ?? null)) return false;
  if (jobId && !JOBS[jobId]) throw new Error(`알 수 없는 일자리: ${jobId}`);
  if (cur) character.career.history.push({ jobId: cur.jobId, from: cur.since, to: day, reason });
  character.career.current = jobId ? { jobId, since: day } : null;
  return true;
}

/** 근무 일수 (오늘 포함) */
export const tenureDays = (character, day) => (character.career?.current ? day - character.career.current.since + 1 : 0);
