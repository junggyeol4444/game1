/**
 * 한국어 조사. 자원 이름이 시대마다 바뀌므로 조사를 박아 둘 수 없다.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fill, josa } from '../src/core/ko';
import { bizSubtitle } from '../src/core/era';
import { createInitialState } from '../src/core/state';
import { ERAS } from '../src/data/eras';
import { BUSINESSES } from '../src/data/businesses';

test('을/를', () => {
  assert.equal(josa('돌', '을'), '을');
  assert.equal(josa('구리', '을'), '를');
  assert.equal(josa('희토류', '을'), '를');
  assert.equal(josa('철광석', '을'), '을');
});

test('이/가, 은/는, 과/와', () => {
  assert.equal(josa('돌', '이'), '이');
  assert.equal(josa('구리', '이'), '가');
  assert.equal(josa('돌', '은'), '은');
  assert.equal(josa('구리', '은'), '는');
  assert.equal(josa('돌', '과'), '과');
  assert.equal(josa('구리', '과'), '와');
});

test('으로/로 — ㄹ 받침은 로', () => {
  assert.equal(josa('석기', '으로'), '로');
  assert.equal(josa('부품', '으로'), '으로');
  assert.equal(josa('모듈', '으로'), '로', 'ㄹ 받침은 로를 쓴다');
  assert.equal(josa('물', '으로'), '로');
});

test('한글이 아니면 받침 없는 것으로 본다', () => {
  assert.equal(josa('AI', '을'), '를');
  assert.equal(josa('', '을'), '를');
});

test('템플릿 채우기', () => {
  const look = (k: string) => ({ ore: '돌', goods: '석기' })[k] ?? k;
  assert.equal(fill('{ore|을} 캔다', look), '돌을 캔다');
  assert.equal(fill('{ore|을} {goods|으로}', look), '돌을 석기로');
  assert.equal(fill('{ore} 창고', look), '돌 창고');
  assert.equal(fill('조사 없음', look), '조사 없음');
});

test('모든 시대 x 모든 사업의 자막이 자연스럽게 채워진다', () => {
  const s = createInitialState(0);
  for (let i = 0; i < ERAS.length; i++) {
    s.era = i;
    for (const b of BUSINESSES) {
      const sub = bizSubtitle(s, b.id);
      assert.ok(sub.length > 0, `${ERAS[i].name}/${b.id} 자막이 비었다`);
      assert.ok(!sub.includes('{'), `치환 안 된 토큰이 남았다: ${sub}`);
      assert.ok(!/[을를]\s*[을를]/.test(sub), `조사가 겹쳤다: ${sub}`);
    }
  }
});

test('석기 시대와 근대의 자막이 다르다', () => {
  const s = createInitialState(0);
  s.era = 0;
  const stone = bizSubtitle(s, 'mine');
  s.era = 6;
  const modern = bizSubtitle(s, 'mine');
  assert.equal(stone, '돌을 캔다');
  assert.equal(modern, '원석을 캔다');
});
