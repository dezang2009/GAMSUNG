/**
 * 게임 데이터 표 (밸런스는 여기서만 조정).
 * 비용은 base × growth^보유수. 생산량 단위: 코드 줄/초(lps), 수익 원/초.
 */

/** 장비 (한 번 살 때마다 레벨 +1) */
export const UPGRADES = [
  { id: 'keyboard', name: '기계식 키보드', desc: '코드 쓰기 한 번에 +1줄', base: 15, growth: 1.18 },
  { id: 'monitor', name: '듀얼 모니터', desc: '코드 쓰기 효율 +50%', base: 260, growth: 1.75, max: 20 },
  { id: 'coffee', name: '커피 머신', desc: '팀 전체 생산 +10%', base: 420, growth: 1.55 },
  { id: 'ci', name: '자동 테스트', desc: '출시에 필요한 코드 −6%', base: 1600, growth: 1.8, max: 8 },
  { id: 'ads', name: '앱 광고', desc: '사용자 증가 속도 +20%', base: 2600, growth: 1.6 },
  { id: 'server', name: '서버 증설', desc: '사용자당 수익 +15%', base: 4800, growth: 1.65 },
];

/** 직원 (사무실 자리만큼 채용). lps: 한 명이 1초에 쓰는 코드 줄 */
export const STAFF = [
  { id: 'intern', name: '인턴', desc: '1초에 0.6줄', lps: 0.6, base: 40, growth: 1.15 },
  { id: 'junior', name: '주니어 개발자', desc: '1초에 4줄', lps: 4, base: 520, growth: 1.15 },
  { id: 'designer', name: '디자이너', desc: '새 앱 평점 +0.1, 사용자 +5%', lps: 0, base: 3800, growth: 1.22 },
  { id: 'senior', name: '시니어 개발자', desc: '1초에 22줄', lps: 22, base: 6500, growth: 1.15 },
  { id: 'marketer', name: '마케터', desc: '사용자 증가 속도 +12%', lps: 0, base: 9000, growth: 1.22 },
  { id: 'lead', name: '테크 리드', desc: '1초에 130줄', lps: 130, base: 85000, growth: 1.15 },
  { id: 'cto', name: 'CTO', desc: '1초에 800줄', lps: 800, base: 1.2e6, growth: 1.15 },
];

/** 사무실 (자리 수 = 채용 가능한 직원 수) */
export const OFFICES = [
  { name: '자취방 책상', slots: 3, cost: 0 },
  { name: '공유 오피스', slots: 8, cost: 3000 },
  { name: '작은 사무실', slots: 20, cost: 60000 },
  { name: '한 층 사무실', slots: 45, cost: 1.5e6 },
  { name: '사옥', slots: 120, cost: 4e7 },
  { name: '캠퍼스', slots: 400, cost: 2e9 },
];

/** 만들 앱 (차례대로). 다 만들면 '2'·'3' 후속작으로 이어진다 */
export const APP_IDEAS = [
  '할 일 앱', '메모 앱', '날씨 위젯', '가계부 앱', '습관 트래커', '사진 필터 앱', '퍼즐 게임', '일정 관리 앱',
  '음악 플레이어', '운동 기록 앱', '지도 앱', '동네 커뮤니티', '메신저', 'AI 비서', '오픈 월드 게임', '운영체제',
];

export const BALANCE = {
  linesBase: 120, // 첫 앱에 필요한 코드 줄
  linesGrowth: 2.35, // 다음 앱은 이만큼 더 크다
  capBase: 400, // 첫 앱 최대 사용자
  capGrowth: 3,
  arpuBase: 0.004, // 사용자 1명이 1초에 내는 수익(원)
  arpuGrowth: 1.25,
  growthRate: 0.012, // 사용자 증가 속도 (최대치까지 다가가는 비율/초)
  offlineCapSec: 8 * 3600, // 자리 비운 사이 최대 계산 시간
  offlineEfficiency: 0.75, // 자리 비운 동안은 75% 효율
  insightPerLevel: 0.05, // 통찰 1당 전체 +5%
  sellMinApps: 5, // 회사 매각 가능 조건
};

export const ACHIEVEMENTS = [
  { id: 'first_code', name: '첫 커밋', desc: '코드를 처음 써요', test: (s) => s.taps >= 1 },
  { id: 'first_app', name: '첫 출시', desc: '앱을 처음 출시해요', test: (s) => s.apps.length >= 1 },
  { id: 'users_1k', name: '천 명의 사용자', desc: '전체 사용자 1,000명', test: (s) => totalUsers(s) >= 1000 },
  { id: 'users_100k', name: '십만 사용자', desc: '전체 사용자 10만 명', test: (s) => totalUsers(s) >= 1e5 },
  { id: 'users_10m', name: '국민 앱', desc: '전체 사용자 1,000만 명', test: (s) => totalUsers(s) >= 1e7 },
  { id: 'money_1m', name: '첫 백만 원', desc: '누적 수익 100만 원', test: (s) => s.totalEarned >= 1e6 },
  { id: 'money_1b', name: '10억 클럽', desc: '누적 수익 10억 원', test: (s) => s.totalEarned >= 1e9 },
  { id: 'team_10', name: '어엿한 팀', desc: '직원 10명', test: (s) => staffCount(s) >= 10 },
  { id: 'team_50', name: '스타트업', desc: '직원 50명', test: (s) => staffCount(s) >= 50 },
  { id: 'office_3', name: '내 사무실', desc: '작은 사무실로 이사', test: (s) => s.office >= 2 },
  { id: 'five_star', name: '별 다섯 개', desc: '평점 4.8 이상인 앱', test: (s) => s.apps.some((a) => a.rating >= 4.8) },
  { id: 'apps_10', name: '앱 공장', desc: '앱 10개 출시', test: (s) => s.apps.length >= 10 },
  { id: 'taps_1000', name: '손가락 근육', desc: '코드 쓰기 1,000번', test: (s) => s.taps >= 1000 },
  { id: 'sold', name: '엑시트', desc: '회사를 처음 매각해요', test: (s) => s.stats.sold >= 1 },
];

export const totalUsers = (s) => s.apps.reduce((a, x) => a + x.users, 0);
export const staffCount = (s) => Object.values(s.staff).reduce((a, n) => a + n, 0);
