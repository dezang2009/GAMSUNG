/**
 * 캐릭터 생성에 쓰는 기본 데이터: 지역 · 학력 · 성별 · 초기 배경 · 능력치 이름.
 * 숫자(월세·시급 등)는 2026년 한국 기준의 대략적인 값이에요. 다음 PHASE 의 경제 시스템이 이 표를 확장해요.
 */

/** 능력치 6종: 이름과 지금 게임에서 무엇에 쓰이는지 */
export const STATS = [
  { id: 'intelligence', name: '지능', affects: '공부·독서로 얻는 성장량' },
  { id: 'sociability', name: '사교성', affects: '사람을 만날 때의 기분·스트레스 변화' },
  { id: 'fitness', name: '체력', affects: '최대 컨디션 회복량, 피로가 쌓이는 속도' },
  { id: 'creativity', name: '창의성', affects: '취미 활동의 만족감, 외주 단가' },
  { id: 'diligence', name: '성실성', affects: '일할 때 쌓이는 스트레스, 지각 여유' },
  { id: 'expertise', name: '전문성', affects: '외주·과외 단가, 직장 평가 (다음 PHASE)' },
];
export const STAT_IDS = STATS.map((s) => s.id);

/** 거주 지역: 한 달 고정 지출(원)과 편도 출퇴근 시간(분) */
export const REGIONS = [
  { id: 'seoul', name: '서울', rent: 650000, utilities: 120000, phone: 55000, transport: 75000, commute: 50 },
  { id: 'gyeonggi', name: '경기', rent: 480000, utilities: 110000, phone: 55000, transport: 90000, commute: 70 },
  { id: 'busan', name: '부산', rent: 420000, utilities: 105000, phone: 55000, transport: 65000, commute: 40 },
  { id: 'metro', name: '대구·대전·광주', rent: 380000, utilities: 100000, phone: 55000, transport: 60000, commute: 35 },
  { id: 'local', name: '그 외 지역', rent: 320000, utilities: 95000, phone: 55000, transport: 70000, commute: 30 },
];

export const EDUCATIONS = [
  { id: 'highschool', name: '고등학교 졸업', bonus: {} },
  { id: 'college', name: '전문대 졸업', bonus: { expertise: 5 } },
  { id: 'university', name: '대학교 졸업', bonus: { intelligence: 5 } },
  { id: 'graduate', name: '대학원 졸업', bonus: { intelligence: 8, expertise: 5 } },
];

/** 성별은 지금 게임 수치에 영향을 주지 않아요 */
export const GENDERS = [
  { id: 'female', name: '여성' },
  { id: 'male', name: '남성' },
  { id: 'none', name: '밝히지 않음' },
];

export const MIN_WAGE_2026 = 10320;

/**
 * 일자리 종류 (PHASE 1 은 배경마다 하나. 복잡한 취업·직장 시스템은 다음 PHASE)
 *  - shift: 원하는 시간만큼 일하고 시급을 받아요 (가능 시간대·하루 최대 시간)
 *  - office: 평일 정해진 시간에 출근해요 (일급 환산으로 지급)
 *  - freelance: 원하는 시간만큼, 단가는 전문성·창의성·컨디션에 따라
 */
export const JOBS = {
  convenience: { id: 'convenience', type: 'shift', title: '편의점 아르바이트', hourly: MIN_WAGE_2026, from: 7 * 60, to: 23 * 60, maxHours: 8, stressPerHour: 2, fatiguePerHour: 5 },
  tutor: { id: 'tutor', type: 'shift', title: '중학생 수학 과외', hourly: 25000, from: 16 * 60, to: 22 * 60, maxHours: 3, stressPerHour: 3, fatiguePerHour: 4 },
  office: { id: 'office', type: 'office', title: '중견기업 마케팅팀 대리', monthly: 3400000, start: 9 * 60, end: 18 * 60, stressPerHour: 2.4, fatiguePerHour: 4 },
  freelance: { id: 'freelance', type: 'freelance', title: '외주 기획·디자인', baseHourly: 14000, maxHours: 6, stressPerHour: 2.5, fatiguePerHour: 4 },
};

/** 초기 배경 4종 */
export const BACKGROUNDS = [
  {
    id: 'rookie',
    name: '평범한 사회 초년생',
    summary: '모아 둔 돈은 적지만 체력이 좋아요. 편의점에서 일하며 다음을 준비해요.',
    defaultAge: 22,
    educations: ['highschool', 'college', 'university'],
    defaultEducation: 'highschool',
    cash: 1500000,
    stats: { intelligence: 42, sociability: 50, fitness: 58, creativity: 45, diligence: 45, expertise: 22 },
    life: { energy: 85, fatigue: 20, stress: 30, mood: 62, hunger: 30 },
    job: 'convenience',
  },
  {
    id: 'graduate',
    name: '대학 졸업자',
    summary: '막 졸업했어요. 공부 머리는 있고, 과외로 생활비를 벌어요.',
    defaultAge: 24,
    educations: ['university', 'graduate'],
    defaultEducation: 'university',
    cash: 2500000,
    stats: { intelligence: 58, sociability: 50, fitness: 46, creativity: 50, diligence: 50, expertise: 32 },
    life: { energy: 80, fatigue: 25, stress: 40, mood: 55, hunger: 30 },
    job: 'tutor',
  },
  {
    id: 'veteran',
    name: '경력직 직장인',
    summary: '회사 5년 차. 돈과 전문성은 있지만 스트레스와 피로가 쌓여 있어요.',
    defaultAge: 30,
    educations: ['highschool', 'college', 'university', 'graduate'],
    defaultEducation: 'university',
    cash: 9000000,
    stats: { intelligence: 54, sociability: 52, fitness: 44, creativity: 40, diligence: 62, expertise: 64 },
    life: { energy: 70, fatigue: 40, stress: 52, mood: 50, hunger: 30 },
    job: 'office',
  },
  {
    id: 'founder',
    name: '창업 준비자',
    summary: '회사를 그만두고 모은 돈으로 창업을 준비해요. 외주로 버티며 아이디어를 다듬어요.',
    defaultAge: 28,
    educations: ['highschool', 'college', 'university', 'graduate'],
    defaultEducation: 'university',
    cash: 18000000,
    stats: { intelligence: 54, sociability: 55, fitness: 48, creativity: 64, diligence: 50, expertise: 44 },
    life: { energy: 78, fatigue: 30, stress: 45, mood: 58, hunger: 30 },
    job: 'freelance',
  },
];

export const byId = (list, id) => list.find((x) => x.id === id) ?? null;
