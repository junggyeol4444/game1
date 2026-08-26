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

def write_png(path, w, h, rgba):
    raw = bytearray()
    stride = w*4
    for y in range(h):
        raw.append(0); raw += rgba[y*stride:(y+1)*stride]
    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t+d) & 0xffffffff)
    out = b'\x89PNG\r\n\x1a\n'
    out += chunk(b'IHDR', struct.pack('>IIBBBBB', w,h,8,6,0,0,0))
    out += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    out += chunk(b'IEND', b'')
    open(path,'wb').write(out)

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
