import zlib, struct

def read_png(path):
    d = open(path,'rb').read()
    assert d[:8] == b'\x89PNG\r\n\x1a\n'
    i = 8; idat = b''; w=h=bd=ct=0; plte=None; trns=None
    while i < len(d):
        ln = struct.unpack('>I', d[i:i+4])[0]; typ = d[i+4:i+8]; data = d[i+8:i+8+ln]; i += 12+ln
        if typ==b'IHDR': w,h,bd,ct,_,_,il = struct.unpack('>IIBBBBB', data); assert il==0
        elif typ==b'PLTE': plte=data
        elif typ==b'tRNS': trns=data
        elif typ==b'IDAT': idat += data
        elif typ==b'IEND': break
    raw = zlib.decompress(idat)
    ch = {0:1,2:3,3:1,4:2,6:4}[ct]
    assert bd==8, (path,bd)
    stride = w*ch
    out = bytearray(h*stride)
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        f = raw[p]; p += 1
        line = bytearray(raw[p:p+stride]); p += stride
        if f==1:
            for x in range(ch, stride): line[x] = (line[x] + line[x-ch]) & 255
        elif f==2:
            for x in range(stride): line[x] = (line[x] + prev[x]) & 255
        elif f==3:
            for x in range(stride):
                a = line[x-ch] if x>=ch else 0
                line[x] = (line[x] + ((a + prev[x])>>1)) & 255
        elif f==4:
            for x in range(stride):
                a = line[x-ch] if x>=ch else 0
                b = prev[x]; c = prev[x-ch] if x>=ch else 0
                pp = a+b-c; pa=abs(pp-a); pb=abs(pp-b); pc=abs(pp-c)
                pr = a if (pa<=pb and pa<=pc) else (b if pb<=pc else c)
                line[x] = (line[x] + pr) & 255
        out[y*stride:(y+1)*stride] = line
        prev = line
    # to RGBA
    rgba = bytearray(w*h*4)
    for idx in range(w*h):
        if ct==6: rgba[idx*4:idx*4+4] = out[idx*4:idx*4+4]
        elif ct==2: rgba[idx*4:idx*4+3] = out[idx*3:idx*3+3]; rgba[idx*4+3]=255
        elif ct==0: v=out[idx]; rgba[idx*4:idx*4+3]=bytes([v,v,v]); rgba[idx*4+3]=255
        elif ct==4: v=out[idx*2]; rgba[idx*4:idx*4+3]=bytes([v,v,v]); rgba[idx*4+3]=out[idx*2+1]
        elif ct==3:
            pi=out[idx]; rgba[idx*4:idx*4+3]=plte[pi*3:pi*3+3]
            rgba[idx*4+3]= trns[pi] if (trns and pi<len(trns)) else 255
    return w,h,rgba

def _filtered(w, h, rgba, adaptive):
    """스캔라인 필터를 적용한 IDAT 원본 바이트."""
    raw = bytearray()
    stride = w*4
    prev = bytes(stride)
    for y in range(h):
        line = rgba[y*stride:(y+1)*stride]
        cands = []
        # 0 = None
        cands.append((0, bytes(line)))
        # 1 = Sub
        sub = bytearray(stride)
        for x in range(stride):
            sub[x] = (line[x] - (line[x-4] if x >= 4 else 0)) & 255
        cands.append((1, bytes(sub)))
        # 2 = Up
        up = bytearray(stride)
        for x in range(stride):
            up[x] = (line[x] - prev[x]) & 255
        cands.append((2, bytes(up)))
        # 4 = Paeth
        pae = bytearray(stride)
        for x in range(stride):
            a = line[x-4] if x >= 4 else 0
            b = prev[x]
            c = prev[x-4] if x >= 4 else 0
            pp = a + b - c
            pa, pb, pc = abs(pp-a), abs(pp-b), abs(pp-c)
            pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
            pae[x] = (line[x] - pr) & 255
        cands.append((4, bytes(pae)))
        if adaptive:
            # 최소 절대합 휴리스틱 (libpng 기본값과 같다)
            best = min(cands, key=lambda c: sum(v if v < 128 else 256-v for v in c[1]))
        else:
            best = cands[0]
        raw.append(best[0]); raw += best[1]
        prev = bytes(line)
    return bytes(raw)


def _quantize(w, h, rgba, maxc=256):
    """RGBA 를 색 인덱스로 바꾼다. 팔레트 밖의 색은 가장 가까운 색으로 붙인다."""
    from collections import Counter
    cnt = Counter()
    for k in range(w * h):
        cnt[bytes(rgba[k * 4:k * 4 + 4])] += 1
    # 반투명한 색을 앞에 몰아 두면 tRNS 청크가 짧아진다
    order = sorted(cnt.items(), key=lambda kv: (kv[0][3] == 255, -kv[1]))
    pal = [c for c, _ in order[:maxc]]
    idx_of = {c: i for i, c in enumerate(pal)}
    if len(cnt) > maxc:
        for c in cnt:
            if c in idx_of:
                continue
            best, bd = 0, 1 << 30
            for i, p in enumerate(pal):
                d = (c[0]-p[0])**2 + (c[1]-p[1])**2 + (c[2]-p[2])**2 + ((c[3]-p[3])*3)**2
                if d < bd:
                    bd, best = d, i
            idx_of[c] = best
    data = bytearray(w * h)
    for k in range(w * h):
        data[k] = idx_of[bytes(rgba[k * 4:k * 4 + 4])]
    return pal, data


def write_png(path, w, h, rgba):
    """
    PNG 저장.

    이 그림들은 넓은 단색 면이 많아서 필터를 안 쓰는 게 이길 때도, 쓰는 게 이길 때도 있다.
    (평평한 면은 zlib 이 그대로 잘 먹고, 그라데이션은 필터가 크게 이긴다)
    둘 다 압축해 보고 작은 쪽을 쓴다.
    """
    body = min(
        zlib.compress(_filtered(w, h, rgba, False), 9),
        zlib.compress(_filtered(w, h, rgba, True), 9),
        key=len,
    )
    # 인덱스 PNG. 이 그림들은 단색 면 위주라 256색이면 충분하고, 픽셀당 32비트가
    # 8비트로 줄어서 파일이 3~4배 작아진다.
    pal, idx = _quantize(w, h, rgba)
    iraw = bytearray()
    for y in range(h):
        iraw.append(0)
        iraw += idx[y * w:(y + 1) * w]
    ibody = zlib.compress(bytes(iraw), 9)
    plte = b''.join(bytes(c[:3]) for c in pal)
    alphas = bytes(c[3] for c in pal)
    while alphas and alphas[-1] == 255:
        alphas = alphas[:-1]
    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t+d) & 0xffffffff)
    rgba_png = (
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
        + chunk(b'IDAT', body)
        + chunk(b'IEND', b'')
    )
    idx_png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 3, 0, 0, 0))
    idx_png += chunk(b'PLTE', plte)
    if alphas:
        idx_png += chunk(b'tRNS', alphas)
    idx_png += chunk(b'IDAT', ibody) + chunk(b'IEND', b'')
    open(path, 'wb').write(min(rgba_png, idx_png, key=len))

def bbox(w,h,rgba):
    x0,y0,x1,y1 = w,h,-1,-1
    for y in range(h):
        row = y*w*4
        for x in range(w):
            if rgba[row+x*4+3] > 8:
                if x<x0: x0=x
                if x>x1: x1=x
                if y<y0: y0=y
                if y>y1: y1=y
    return x0,y0,x1,y1

def blit(dst, dw, dh, src, sw, sh, ox, oy):
    for y in range(sh):
        ty = y+oy
        if ty<0 or ty>=dh: continue
        for x in range(sw):
            tx = x+ox
            if tx<0 or tx>=dw: continue
            a = src[(y*sw+x)*4+3]
            if a==0: continue
            di = (ty*dw+tx)*4
            if a==255:
                dst[di:di+4] = src[(y*sw+x)*4:(y*sw+x)*4+4]
            else:
                sa = a/255.0
                for c in range(3):
                    dst[di+c] = int(src[(y*sw+x)*4+c]*sa + dst[di+c]*(1-sa))
                dst[di+3] = min(255, int(a + dst[di+3]*(1-sa)))
