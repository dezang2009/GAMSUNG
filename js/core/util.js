// 작은 공통 도구
const Util = {
  // 받침 여부에 따라 조사를 붙인다: josa('들쥐', '이/가') -> '들쥐가', josa('슬라임', '이/가') -> '슬라임이'
  josa(word, pair) {
    const [withJong, without] = pair.split('/');
    const code = word.charCodeAt(word.length - 1) - 0xac00;
    const hasJong = code >= 0 && code <= 11171 && code % 28 !== 0;
    return word + (hasJong ? withJong : without);
  },

  // 따옴표로 감싼 이름에 조사를 붙인다: q('휘두르기', '을/를') -> "'휘두르기'를"
  q(word, pair) {
    const [withJong, without] = pair.split('/');
    const code = word.charCodeAt(word.length - 1) - 0xac00;
    return `'${word}'` + (code >= 0 && code <= 11171 && code % 28 !== 0 ? withJong : without);
  },
};
