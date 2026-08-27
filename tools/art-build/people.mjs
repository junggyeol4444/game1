import { chromium } from 'playwright';
import fs from 'node:fs';
const b = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const p = await b.newPage({ viewport: { width: 200, height: 200 } });
const draw = `
function fig(ctx, o){
  const W=64, H=96;
  ctx.clearRect(0,0,W,H);
  const cx=W/2;
  const shadeF=(c,f)=>{const n=parseInt(c.slice(1),16);const r=Math.min(255,(n>>16&255)*f)|0,g=Math.min(255,(n>>8&255)*f)|0,bl=Math.min(255,(n&255)*f)|0;return '#'+((1<<24)+(r<<16)+(g<<8)+bl).toString(16).slice(1);};
  const rr=(x,y,w,h,r)=>{ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();ctx.fill();};
  // 그림자
  ctx.fillStyle='rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(cx, H-6, 15, 7, 0, 0, Math.PI*2); ctx.fill();
  // 다리
  ctx.fillStyle=o.pants; rr(cx-11, H-34, 9, 30, 4); rr(cx+2, H-32, 9, 28, 4);
  // 신발
  ctx.fillStyle='#3a3f4b'; rr(cx-12, H-10, 11, 7, 3); rr(cx+1, H-9, 11, 7, 3);
  // 몸통 (밝은 면 / 어두운 면)
  ctx.fillStyle=o.body; rr(cx-14, H-62, 28, 32, 7);
  ctx.fillStyle=shadeF(o.body, 0.82); rr(cx+1, H-62, 13, 32, 6);
  // 팔
  ctx.fillStyle=shadeF(o.body, 0.9); rr(cx-19, H-60, 8, 22, 4); rr(cx+11, H-60, 8, 22, 4);
  // 목
  ctx.fillStyle=shadeF(o.skin,0.86); rr(cx-5, H-66, 10, 7, 3);
  // 머리
  ctx.fillStyle=o.skin; rr(cx-11, H-86, 22, 22, 8);
  ctx.fillStyle=shadeF(o.skin,0.85); rr(cx+2, H-86, 9, 22, 7);
  // 머리카락 / 헬멧
  if (o.helmet){
    ctx.fillStyle=o.helmet; rr(cx-13, H-92, 26, 13, 6);
    ctx.fillStyle=shadeF(o.helmet,0.84); rr(cx-13, H-81, 26, 4, 2);
  } else {
    ctx.fillStyle=o.hair; rr(cx-11, H-88, 22, 11, 6);
  }
  // 눈
  ctx.fillStyle='#2b3240';
  ctx.fillRect(cx-6, H-76, 3, 4); ctx.fillRect(cx+2, H-76, 3, 4);
  if (o.vest){
    ctx.fillStyle=o.vest; rr(cx-14, H-52, 28, 12, 3);
    ctx.fillStyle='#f2f4f7'; ctx.fillRect(cx-14, H-48, 28, 3);
  }
}
`;
for (const [name, o] of [
  ['citizen', { body:'#4A83C4', pants:'#39445A', skin:'#F0C9A0', hair:'#3B3026' }],
  ['worker',  { body:'#E08A34', pants:'#3E4657', skin:'#F0C9A0', hair:'#3B3026', helmet:'#F5C518', vest:'#F2E14C' }],
]) {
  await p.setContent(`<body style="margin:0"><canvas id=c width=64 height=96 style="display:block"></canvas></body>`);
  await p.evaluate(([src, opt]) => {
    eval(src);
    // eslint-disable-next-line no-undef
    fig(document.getElementById('c').getContext('2d'), opt);
  }, [draw, o]);
  const buf = await p.locator('#c').screenshot({ omitBackground: true });
  fs.writeFileSync(`/home/user/game1/public/art/props/${name}.png`, buf);
  console.log(name, buf.length);
}
await b.close();
