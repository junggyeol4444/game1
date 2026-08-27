/**
 * 한국어 조사 처리.
 *
 * 자원·건물 이름이 시대마다 바뀌므로 조사를 박아 둘 수 없다.
 * '돌을 캔다' / '희토류를 캔다' 를 같은 템플릿에서 뽑아야 한다.
 */

/** 마지막 글자에 받침이 있는가. 한글이 아니면 false */
export function hasFinal(word: string): boolean {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

/** 마지막 글자의 종성이 ㄹ 인가 ('으로/로' 판정용) */
function finalIsRieul(word: string): boolean {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 === 8;
}

export type Josa = '을' | '이' | '은' | '으로' | '과';

/** 단어에 맞는 조사를 고른다 */
export function josa(word: string, kind: Josa): string {
  const final = hasFinal(word);
  switch (kind) {
    case '을':
      return final ? '을' : '를';
    case '이':
      return final ? '이' : '가';
    case '은':
      return final ? '은' : '는';
    case '과':
      return final ? '과' : '와';
    case '으로':
      // ㄹ 받침은 '로' 를 쓴다 (물로, 하늘로)
      return final && !finalIsRieul(word) ? '으로' : '로';
  }
}

const TOKEN = /\{(\w+)(?:\|(을|이|은|으로|과))?\}/g;

/**
 * `{ore}를 캔다` 같은 템플릿을 채운다.
 * `{ore|을}` 이면 채운 말에 맞는 조사를 붙인다.
 */
export function fill(template: string, lookup: (key: string) => string): string {
  return template.replace(TOKEN, (_m, key: string, j?: Josa) => {
    const word = lookup(key);
    return j ? word + josa(word, j) : word;
  });
}
