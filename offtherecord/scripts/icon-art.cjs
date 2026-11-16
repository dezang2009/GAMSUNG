// 아이콘: 강조색 바탕 + 흰 ‘녹음 버튼’(고리·점)에 사선을 그어 ‘기록 끔(off the record)’. 평평하게.
const BG = '#3e5bd9';
exports.BG = BG;
exports.iconSvg = ({ radius = 112, bg = true, scale = 1 } = {}) => {
  const t = (512 - 512 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg ? `<rect width="512" height="512" rx="${radius}" fill="${BG}"/>` : ''}<g transform="translate(${t} ${t}) scale(${scale})"><circle cx="256" cy="256" r="118" fill="none" stroke="#fff" stroke-width="34"/><circle cx="256" cy="256" r="50" fill="#fff"/><path d="M150 362 362 150" stroke="${BG}" stroke-width="64" stroke-linecap="round"/><path d="M150 362 362 150" stroke="#fff" stroke-width="30" stroke-linecap="round"/></g></svg>`;
};
