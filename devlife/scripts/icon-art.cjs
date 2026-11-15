// DEVLIFE 아이콘: 강조색 단색 바탕 + 흰 프롬프트 표시(>_). 평평하게, 그림자·그라데이션 없음.
exports.iconSvg = ({ radius = 112, bg = true, scale = 1 } = {}) => {
  const t = (512 - 512 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg ? `<rect width="512" height="512" rx="${radius}" fill="#4b5de6"/>` : ''}<g transform="translate(${t} ${t}) scale(${scale})" fill="none" stroke="#fff" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"><path d="M150 170l92 86-92 86"/><path d="M276 348h96"/></g></svg>`;
};
