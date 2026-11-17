/* ===== Dekodery PSD i TGA (działają w wątku roboczym albo, awaryjnie, na stronie) ===== */
function decoderLib(){
  const MODES={0:'Bitmap',1:'Skala szarości',2:'Indeksowany',3:'RGB',4:'CMYK',7:'Wielokanałowy',8:'Duotone',9:'Lab'};
  const dv=u=>new DataView(u.buffer,u.byteOffset,u.byteLength);

  async function decode(file,type,max){
    if(type==='psd') return decodePSD(file,max);
    const u=new Uint8Array(await file.arrayBuffer());
    if(type==='tga') return decodeTGA(u,max);
    if(type==='tif') return decodeTIFF(u,max);
    if(type==='exr') return decodeEXR(u,max);
    if(type==='hdr') return decodeHDR(u,max);
    if(type==='raw') return decodeRAW(u,file.name||'');
    throw new Error('Nieobsługiwany format');
  }

  // --- PSD / PSB: czyta tylko nagłówek i spłaszczony obraz z końca pliku, warstwy pomija
  async function decodePSD(file,max){
    const rd=async(a,b)=>new Uint8Array(await file.slice(a,b).arrayBuffer());
    const h=await rd(0,30), hv=dv(h);
    if(h.length<30||hv.getUint32(0)!==0x38425053) throw new Error('To nie jest plik PSD');
    const ver=hv.getUint16(4), ch=hv.getUint16(12), H=hv.getUint32(14), W=hv.getUint32(18),
          depth=hv.getUint16(22), mode=hv.getUint16(24), cmLen=hv.getUint32(26);
    let p=30, pal=null;
    if(mode===2&&cmLen>=768) pal=await rd(p,p+768);
    p+=cmLen;
    const resLen=dv(await rd(p,p+4)).getUint32(0), resStart=p+4;
    p=resStart+resLen;
    const L=ver===2?8:4, lb=dv(await rd(p,p+L*2+2));
    const layerLen=ver===2? lb.getUint32(0)*4294967296+lb.getUint32(4) : lb.getUint32(0);
    // ujemna liczba warstw = pierwszy kanał alfa to przezroczystość spłaszczonego obrazu
    const mergedAlpha=layerLen>L+2&&lb.byteLength>=L*2+2&&lb.getInt16(L*2)<0;
    p+=L+layerLen;
    const meta={format:ver===2?'PSB':'PSD',width:W,height:H,depth,mode:MODES[mode]||String(mode)};
    try{
      const img=composite(await rd(p,file.size),{ver,ch,W,H,depth,mode,pal,mergedAlpha},max);
      img.meta=meta; return img;
    }catch(e){
      const j=await psdThumb(rd,resStart,resLen);
      if(j) return {jpeg:j,meta,note:e.message+' — pokazano miniaturę zapisaną w pliku'};
      throw e;
    }
  }

  function composite(b,o,max){
    const {ver,ch,W,H,depth,mode,pal,mergedAlpha}=o;
    const base=mode===3?3:mode===4?4:(mode===1||mode===2||mode===8)?1:0;
    if(!base) throw new Error('tryb '+(MODES[mode]||mode)+' nieobsługiwany');
    const alpha=mergedAlpha&&ch>base, need=base+(alpha?1:0);
    if(depth!==8&&depth!==16) throw new Error(depth+'-bitowy obraz nieobsługiwany');
    if(ch<base||b.length<2) throw new Error('brak spłaszczonego obrazu');
    const bps=depth/8, rowBytes=W*bps;
    const step=max?Math.max(1,Math.floor(Math.max(W,H)/max)):1;
    const ow=Math.ceil(W/step), oh=Math.ceil(H/step);
    const comp=(b[0]<<8)|b[1], v=dv(b);
    const planes=[]; for(let c=0;c<need;c++) planes.push(new Uint8Array(ow*oh));
    const row=new Uint8Array(rowBytes);
    const sample=(src,off,dst,doff)=>{const s=step*bps;for(let x=0,i=off;x<ow;x++,i+=s)dst[doff+x]=src[i];};
    if(comp===1){
      const cs=ver===2?4:2; let dp=2+ch*H*cs;
      for(let c=0;c<need;c++) for(let y=0;y<H;y++){
        const k=2+(c*H+y)*cs, len=cs===2?v.getUint16(k):v.getUint32(k);
        if(y%step===0){ unpack(b,dp,len,row,rowBytes); sample(row,0,planes[c],(y/step)*ow); }
        dp+=len;
      }
    }else if(comp===0){
      for(let c=0;c<need;c++) for(let y=0;y<H;y+=step) sample(b,2+(c*H+y)*rowBytes,planes[c],(y/step)*ow);
    }else throw new Error('kompresja ZIP nieobsługiwana');
    const N=ow*oh, out=new Uint8ClampedArray(N*4);
    for(let i=0,j=0;i<N;i++,j+=4){
      if(mode===3){out[j]=planes[0][i];out[j+1]=planes[1][i];out[j+2]=planes[2][i];}
      else if(mode===4){const k=planes[3][i];out[j]=planes[0][i]*k/255;out[j+1]=planes[1][i]*k/255;out[j+2]=planes[2][i]*k/255;}
      else if(mode===2&&pal){const x=planes[0][i];out[j]=pal[x];out[j+1]=pal[256+x];out[j+2]=pal[512+x];}
      else out[j]=out[j+1]=out[j+2]=planes[0][i];
      if(alpha){ // Photoshop zapisuje kolor zmieszany z białym tłem — odwracamy to
        const a=planes[base][i]; out[j+3]=a;
        if(a<255){ if(a===0){out[j]=out[j+1]=out[j+2]=0;} else for(let k=0;k<3;k++) out[j+k]=(out[j+k]-(255-a))*255/a; }
      } else out[j+3]=255;
    }
    return {width:ow,height:oh,data:out};
  }

  function unpack(src,sp,len,dst,outLen){ // PackBits
    const end=sp+len; let o=0;
    while(sp<end&&o<outLen){
      let n=src[sp++];
      if(n<128){n++;const m=Math.min(n,outLen-o);dst.set(src.subarray(sp,sp+m),o);o+=m;sp+=n;}
      else if(n>128){n=257-n;const m=Math.min(n,outLen-o);dst.fill(src[sp],o,o+m);o+=m;sp++;}
    }
    if(o<outLen) dst.fill(0,o);
  }

  async function psdThumb(rd,start,len){ // zasób 1036: miniatura JPEG
    const r=await rd(start,start+len), v=dv(r); let p=0;
    while(p+12<=r.length){
      if(v.getUint32(p)!==0x3842494D) break;
      const id=v.getUint16(p+4); p+=6;
      p+=(r[p]+2)&~1;
      const size=v.getUint32(p); p+=4;
      if(id===1036&&v.getUint32(p)===1) return r.slice(p+28,p+size);
      p+=(size+1)&~1;
    }
    return null;
  }

  // --- TGA: typy 1,2,3 i ich wersje RLE 9,10,11
  function decodeTGA(u,max){
    const v=dv(u);
    if(u.length<18) throw new Error('Uszkodzony plik TGA');
    const idLen=u[0],cmType=u[1],type=u[2],cmFirst=v.getUint16(3,true),cmLen=v.getUint16(5,true),cmDepth=u[7];
    const W=v.getUint16(12,true),H=v.getUint16(14,true),bpp=u[16],desc=u[17];
    if(![1,2,3,9,10,11].includes(type)) throw new Error('Nieobsługiwany typ TGA ('+type+')');
    let p=18+idLen, pal=null;
    if(cmType===1){const eb=Math.ceil(cmDepth/8);pal=new Uint8ClampedArray(cmLen*4);for(let i=0;i<cmLen;i++)pix(u,p+i*eb,cmDepth,pal,i*4);p+=cmLen*eb;}
    const base=type&7, bytes=Math.ceil(bpp/8), n=W*H, px=new Uint8ClampedArray(n*4);
    const put=(sp,i)=>{const o=i*4;
      if(base===1){let x=(bytes===1?u[sp]:u[sp]|u[sp+1]<<8)-cmFirst;x*=4;px[o]=pal[x];px[o+1]=pal[x+1];px[o+2]=pal[x+2];px[o+3]=pal[x+3];}
      else if(base===3){px[o]=px[o+1]=px[o+2]=u[sp];px[o+3]=bytes===2?u[sp+1]:255;}
      else pix(u,sp,bpp,px,o);
    };
    if(type<9){for(let i=0;i<n&&p+bytes<=u.length;i++,p+=bytes)put(p,i);}
    else{let i=0;while(i<n&&p<u.length){const hd=u[p++],c=(hd&127)+1;
      if(hd&128){for(let k=0;k<c&&i<n;k++)put(p,i++);p+=bytes;}
      else for(let k=0;k<c&&i<n;k++,p+=bytes)put(p,i++);}}
    if(bpp===32){ // brak sensownej alfy → nieprzezroczysty
      let any=false; for(let i=3;i<px.length;i+=4) if(px[i]){any=true;break;}
      if(!any||(desc&15)===0) for(let i=3;i<px.length;i+=4) px[i]=255;
    }
    const q=new Uint32Array(px.buffer);
    if(!(desc&0x20)) for(let y=0;y<H>>1;y++){const a=y*W,b=(H-1-y)*W;for(let x=0;x<W;x++){const t=q[a+x];q[a+x]=q[b+x];q[b+x]=t;}}
    if(desc&0x10) for(let y=0;y<H;y++){const a=y*W;for(let x=0;x<W>>1;x++){const t=q[a+x];q[a+x]=q[a+W-1-x];q[a+W-1-x]=t;}}
    const meta={format:'TGA',width:W,height:H,depth:bpp,mode:type>=9?'RLE':''};
    const step=max?Math.max(1,Math.floor(Math.max(W,H)/max)):1;
    if(step===1) return {width:W,height:H,data:px,meta};
    const ow=Math.ceil(W/step),oh=Math.ceil(H/step),o32=new Uint32Array(ow*oh);
    for(let y=0;y<oh;y++)for(let x=0;x<ow;x++)o32[y*ow+x]=q[y*step*W+x*step];
    return {width:ow,height:oh,data:new Uint8ClampedArray(o32.buffer),meta};
  }
  function pix(s,p,bits,d,o){
    if(bits===32){d[o]=s[p+2];d[o+1]=s[p+1];d[o+2]=s[p];d[o+3]=s[p+3];}
    else if(bits===24){d[o]=s[p+2];d[o+1]=s[p+1];d[o+2]=s[p];d[o+3]=255;}
    else if(bits===15||bits===16){const x=s[p]|s[p+1]<<8;d[o]=(x>>10&31)*8.226;d[o+1]=(x>>5&31)*8.226;d[o+2]=(x&31)*8.226;d[o+3]=255;}
    else{d[o]=d[o+1]=d[o+2]=s[p];d[o+3]=255;}
  }

  // --- wspólne: próbkowanie do miniatur i mapowanie światła liniowego na sRGB
  function sampler(W,H,max){
    const step=max?Math.max(1,Math.floor(Math.max(W,H)/max)):1;
    const ow=Math.ceil(W/step),oh=Math.ceil(H/step),out=new Uint8ClampedArray(ow*oh*4);
    for(let i=3;i<out.length;i+=4) out[i]=255;
    return {step,ow,oh,out};
  }
  function tone(f){ if(!(f>0)) return 0; if(f>=1) return 255; return 255*(f<=0.0031308?12.92*f:1.055*Math.pow(f,1/2.4)-0.055); }
  let HALF=null;
  function halfLUT(){ if(HALF) return HALF; HALF=new Uint8Array(65536);
    for(let h=0;h<65536;h++){const s=h&0x8000?-1:1,e=(h>>10)&31,f=h&1023;
      const x=e===0?s*f*5.960464477539063e-8:e===31?0:s*(1+f/1024)*Math.pow(2,e-15); HALF[h]=Math.round(tone(x));}
    return HALF; }
  async function inflate(b,need){
    const s=new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate'));
    const a=new Uint8Array(await new Response(s).arrayBuffer());
    if(a.length>=need) return a; const o=new Uint8Array(need); o.set(a); return o;
  }

  // --- TIFF: bez kompresji, LZW, Deflate, PackBits; 8/16-bit, 32-bit float; paski i kafelki
  function ifd(u,v,le,off){
    const n=v.getUint16(off,le), T={};
    for(let i=0;i<n;i++){
      const e=off+2+i*12, tag=v.getUint16(e,le), type=v.getUint16(e+2,le), cnt=v.getUint32(e+4,le);
      if(tag===700||tag===33723||tag===34377||tag===34675) continue; // XMP, IPTC, Photoshop, ICC
      const sz=[0,1,1,2,4,8,1,1,2,4,8,4,8,4,0,0,8][type]||1;
      const p=sz*cnt<=4?e+8:v.getUint32(e+8,le), vals=[];
      for(let k=0;k<cnt&&k<200000;k++){const q=p+k*sz; if(q+sz>u.length)break;
        vals.push(type===3||type===8?v.getUint16(q,le):type===4||type===9||type===13?v.getUint32(q,le):type===5?v.getUint32(q,le)/v.getUint32(q+4,le):type===16?Number(v.getBigUint64(q,le)):u[q]);}
      T[tag]=vals;
    }
    T.next=v.getUint32(off+2+n*12,le); return T;
  }
  function lzw(src,need){
    const out=new Uint8Array(need), ds=new Int32Array(4096), dl=new Int32Array(4096);
    let op=0,bit=0,w=9,next=258,prev=-1,ps=0,pl=0; const total=src.length*8;
    while(bit+w<=total&&op<need){
      const b=bit>>3, x=(src[b]<<16)|((src[b+1]|0)<<8)|(src[b+2]|0);
      const code=(x>>(24-(bit&7)-w))&((1<<w)-1); bit+=w;
      if(code===257) break;
      if(code===256){w=9;next=258;prev=-1;continue;}
      const start=op;
      if(code<256) out[op++]=code;
      else if(code<next&&dl[code]){for(let k=0,s=ds[code];k<dl[code]&&op<need;k++)out[op++]=out[s+k];}
      else if(code===next&&prev>=0){for(let k=0;k<pl&&op<need;k++)out[op++]=out[ps+k]; if(op<need)out[op++]=out[ps];}
      else break;
      if(prev>=0&&next<4096){ds[next]=ps;dl[next]=pl+1;next++;}
      ps=start;pl=op-start;prev=code;
      if(next>=(1<<w)-1&&w<12) w++;
    }
    return out;
  }
  async function decodeTIFF(u,max){
    const le=u[0]===0x49, v=dv(u);
    if(!(le||u[0]===0x4D)) throw new Error('To nie jest plik TIFF');
    const magic=v.getUint16(2,le);
    if(magic===43) throw new Error('BigTIFF nieobsługiwany');
    if(magic!==42) throw new Error('To nie jest plik TIFF');
    let off=v.getUint32(4,le), T=null, guard=0;
    while(off&&off+2<u.length&&guard++<16){const t=ifd(u,v,le,off); if(t[256]&&t[257]&&(!T||t[256][0]*t[257][0]>T[256][0]*T[257][0])) T=t; off=t.next;}
    if(!T) throw new Error('Uszkodzony plik TIFF');
    const g=(k,d)=>T[k]&&T[k].length?T[k][0]:d;
    const W=g(256),H=g(257),spp=g(277,1),bps=g(258,1),comp=g(259,1),photo=g(262,spp>=3?2:1),planar=g(284,1),pred=g(317,1),sf=g(339,1);
    const meta={format:'TIFF',width:W,height:H,depth:bps,mode:({0:'Gray',1:'Gray',2:'RGB',3:'Indeksowany',5:'CMYK'}[photo]||'')+(sf===3?' float':'')};
    if(![8,16,32].includes(bps)) throw new Error(bps+'-bitowy TIFF nieobsługiwany');
    if(![1,5,8,32946,32773].includes(comp)) throw new Error(comp===7?'TIFF z kompresją JPEG nieobsługiwany':'kompresja TIFF ('+comp+') nieobsługiwana');
    if(![0,1,2,3,5].includes(photo)) throw new Error('przestrzeń barw TIFF nieobsługiwana');
    const {step,ow,oh,out}=sampler(W,H,max), B=bps/8;
    const hasA=(photo===2&&spp>=4)||(photo<=1&&spp>=2);
    const nCh=photo===2?Math.min(spp,4):photo===5?4:Math.min(spp,2);
    const map=photo===2?[0,1,2,hasA?3:-1]:photo===5?[0,1,2,3]:[0,hasA?3:-1];
    const tiled=!!T[322], cw=tiled?g(322):W, chH=tiled?g(323):Math.min(g(278,H)||H,H);
    const offs=tiled?T[324]:T[273], cnts=tiled?T[325]:T[279];
    if(!offs) throw new Error('Uszkodzony plik TIFF');
    const across=Math.ceil(W/cw), down=Math.ceil(H/chH), perPlane=across*down;
    const sppC=planar===2?1:spp, rowBytes=cw*sppC*B, fle=pred===3?false:le;
    const rv=bps===8?(b,d,i)=>b[i]:bps===16?(b,d,i)=>b[le?i*2+1:i*2]:sf===3?(b,d,i)=>tone(d.getFloat32(i*4,fle)):(b,d,i)=>b[le?i*4+3:i*4];
    for(let plane=0;plane<(planar===2?Math.min(spp,4):1);plane++)
    for(let ty=0;ty<down;ty++){
      const y0=ty*chH, y1=Math.min(H,y0+chH), first=Math.ceil(y0/step)*step;
      if(first>=y1) continue;
      for(let tx=0;tx<across;tx++){
        const idx=plane*perPlane+ty*across+tx; if(idx>=offs.length) continue;
        const rows=tiled?chH:(y1-y0), need=rowBytes*rows;
        let b=u.subarray(offs[idx],offs[idx]+(cnts?cnts[idx]:need));
        if(comp===1){ if(b.length<need){const o=new Uint8Array(need);o.set(b);b=o;} else b=b.slice(0,need); }
        else if(comp===32773){const o=new Uint8Array(need);unpack(b,0,b.length,o,need);b=o;}
        else if(comp===5) b=lzw(b,need);
        else b=await inflate(b,need);
        if(pred===2){
          if(bps===8){for(let r=0;r<rows;r++){const a=r*rowBytes;for(let i=sppC;i<rowBytes;i++)b[a+i]=(b[a+i]+b[a+i-sppC])&255;}}
          else if(bps===16){const d=dv(b),n=rowBytes/2;for(let r=0;r<rows;r++){const a=r*rowBytes;for(let i=sppC;i<n;i++)d.setUint16(a+i*2,(d.getUint16(a+i*2,le)+d.getUint16(a+(i-sppC)*2,le))&65535,le);}}
        }else if(pred===3){
          const n=rowBytes/4, tmp=new Uint8Array(rowBytes);
          for(let r=0;r<rows;r++){const a=r*rowBytes;
            for(let i=sppC;i<rowBytes;i++)b[a+i]=(b[a+i]+b[a+i-sppC])&255;
            tmp.set(b.subarray(a,a+rowBytes));
            for(let k=0;k<n;k++)for(let j=0;j<4;j++)b[a+k*4+j]=tmp[j*n+k];}
        }
        const d=dv(b), x0=tx*cw, x1=Math.min(W,x0+cw);
        for(let y=first;y<y1;y+=step){
          const oy=y/step, rb=(y-y0)*cw*sppC;
          for(let x=Math.ceil(x0/step)*step;x<x1;x+=step){
            const o=((oy*ow)+x/step)*4, si=rb+(x-x0)*sppC;
            if(planar===2){const m=map[plane];if(m>=0)out[o+m]=rv(b,d,si);}
            else for(let c=0;c<nCh;c++){const m=map[c];if(m>=0)out[o+m]=rv(b,d,si+c);}
          }
        }
      }
    }
    const cm=T[320], N=cm?cm.length/3:0;
    let anyA=false; if(hasA) for(let i=3;i<out.length;i+=4) if(out[i]){anyA=true;break;}
    for(let o=0;o<out.length;o+=4){
      if(photo<=1){const x=photo===0?255-out[o]:out[o];out[o]=out[o+1]=out[o+2]=x;}
      else if(photo===3&&cm){const i=out[o];out[o]=cm[i]>>8;out[o+1]=cm[N+i]>>8;out[o+2]=cm[2*N+i]>>8;}
      else if(photo===5){const k=255-out[o+3];out[o]=(255-out[o])*k/255;out[o+1]=(255-out[o+1])*k/255;out[o+2]=(255-out[o+2])*k/255;out[o+3]=255;}
      if(hasA&&!anyA) out[o+3]=255;
    }
    return {width:ow,height:oh,data:out,meta};
  }

  // --- OpenEXR: linie skanowania, bez kompresji, RLE, ZIPS, ZIP; half i float
  function exrUndo(t){
    for(let i=1;i<t.length;i++) t[i]=(t[i-1]+t[i]-128)&255;
    const o=new Uint8Array(t.length), h=(t.length+1)>>1;
    for(let i=0;i<t.length;i++) o[i]=(i&1)?t[h+(i>>1)]:t[i>>1];
    return o;
  }
  function exrRLE(src,need){
    const o=new Uint8Array(need); let p=0,q=0;
    while(p<src.length&&q<need){let l=src[p++];if(l>127)l-=256;
      if(l<0){for(let k=0;k<-l&&q<need;k++)o[q++]=src[p++];}
      else{const x=src[p++];for(let k=0;k<=l&&q<need;k++)o[q++]=x;}}
    return o;
  }
  async function decodeEXR(u,max){
    const v=dv(u);
    if(u.length<8||v.getUint32(0,true)!==20000630) throw new Error('To nie jest plik EXR');
    const ver=v.getUint32(4,true);
    if(ver&0x200) throw new Error('kafelkowy EXR nieobsługiwany');
    if(ver&0x1000) throw new Error('wieloczęściowy EXR nieobsługiwany');
    let p=8; const str=()=>{let s='';while(p<u.length&&u[p])s+=String.fromCharCode(u[p++]);p++;return s;};
    const ch=[]; let comp=0, dw=null;
    for(let guard=0;guard<200;guard++){
      const name=str(); if(!name) break; str(); const size=v.getInt32(p,true); p+=4; const q=p;
      if(name==='channels'){let r=q;while(u[r]){let n='';while(u[r])n+=String.fromCharCode(u[r++]);r++;ch.push({name:n,type:v.getInt32(r,true)});r+=16;}}
      else if(name==='compression') comp=u[q];
      else if(name==='dataWindow') dw=[v.getInt32(q,true),v.getInt32(q+4,true),v.getInt32(q+8,true),v.getInt32(q+12,true)];
      p=q+size;
    }
    if(!dw||!ch.length) throw new Error('Uszkodzony plik EXR');
    const W=dw[2]-dw[0]+1, H=dw[3]-dw[1]+1;
    const CN=['brak','RLE','ZIPS','ZIP','PIZ','PXR24','B44','B44A','DWAA','DWAB'];
    const meta={format:'EXR',width:W,height:H,mode:CN[comp]||'',depth:ch.some(c=>c.type===2)?32:16};
    const LPB={0:1,1:1,2:1,3:16}[comp];
    if(!LPB) throw new Error('kompresja EXR '+(CN[comp]||comp)+' nieobsługiwana');
    const nb=Math.ceil(H/LPB), offs=[];
    for(let i=0;i<nb;i++) offs.push(Number(v.getBigUint64(p+i*8,true)));
    let lb=0; for(const c of ch){c.off=lb;lb+=W*(c.type===1?2:4);}
    const find=k=>ch.find(c=>c.name===k)||ch.find(c=>c.name.endsWith('.'+k));
    let R=find('R'),G=find('G'),Bc=find('B'); const Y=find('Y');
    if(!R||!G||!Bc){R=G=Bc=Y||ch[0];}
    const L=halfLUT(), {step,ow,oh,out}=sampler(W,H,max);
    for(const off of offs){
      if(off+8>u.length) continue;
      const y=v.getInt32(off,true)-dw[1], size=v.getInt32(off+4,true), lines=Math.min(LPB,H-y);
      if(y<0||lines<=0) continue;
      const first=Math.ceil(y/step)*step; if(first>=y+lines) continue;
      const need=lb*lines; let data=u.subarray(off+8,off+8+size);
      if(size<need) data=exrUndo(comp===1?exrRLE(data,need):await inflate(data,need));
      const d=dv(data);
      const val=(c,base,x)=>c.type===1?L[d.getUint16(base+c.off+x*2,true)]:c.type===2?tone(d.getFloat32(base+c.off+x*4,true)):Math.min(255,d.getUint32(base+c.off+x*4,true));
      for(let yy=first;yy<y+lines;yy+=step){
        const base=(yy-y)*lb, oy=yy/step;
        for(let ox=0;ox<ow;ox++){const x=ox*step,o=(oy*ow+ox)*4;out[o]=val(R,base,x);out[o+1]=val(G,base,x);out[o+2]=val(Bc,base,x);}
      }
    }
    return {width:ow,height:oh,data:out,meta};
  }

  // --- Radiance HDR (RGBE)
  function decodeHDR(u,max){
    let p=0; const line=()=>{let s='';while(p<u.length&&u[p]!==10)s+=String.fromCharCode(u[p++]);p++;return s;};
    if(!line().startsWith('#?')) throw new Error('To nie jest plik HDR');
    while(p<u.length) if(line().trim()==='') break;
    const r=line().trim().split(/\s+/);
    if(r[0]!=='-Y'||r[2]!=='+X') throw new Error('orientacja HDR nieobsługiwana');
    const H=+r[1], W=+r[3], {step,ow,oh,out}=sampler(W,H,max), sl=new Uint8Array(W*4);
    for(let y=0;y<H&&p<u.length;y++){
      if(W>=8&&W<32768&&u[p]===2&&u[p+1]===2&&!(u[p+2]&128)){
        p+=4;
        for(let c=0;c<4;c++){let x=0;while(x<W&&p<u.length){let n=u[p++];
          if(n>128){n-=128;const val=u[p++];for(let k=0;k<n&&x<W;k++)sl[(x++)*4+c]=val;}
          else for(let k=0;k<n&&x<W;k++)sl[(x++)*4+c]=u[p++];}}
      }else{sl.set(u.subarray(p,p+W*4));p+=W*4;}
      if(y%step) continue;
      const oy=y/step;
      for(let ox=0;ox<ow;ox++){const x=ox*step*4,e=sl[x+3],o=(oy*ow+ox)*4;
        if(!e){out[o]=out[o+1]=out[o+2]=0;continue;}
        const f=Math.pow(2,e-136); out[o]=tone(sl[x]*f);out[o+1]=tone(sl[x+1]*f);out[o+2]=tone(sl[x+2]*f);}
    }
    return {width:ow,height:oh,data:out,meta:{format:'HDR',width:W,height:H,depth:32,mode:'RGBE'}};
  }

  // --- RAW z aparatów: największy podgląd JPEG zapisany w pliku
  function jpegAt(u,p){
    let q=p+2,w=0,h=0;
    while(q+4<u.length){
      if(u[q]!==0xFF) return null;
      const m=u[q+1]; if(m===0xFF){q++;continue;}
      if(m===0xD8||m===0x01||(m>=0xD0&&m<=0xD7)){q+=2;continue;}
      const len=(u[q+2]<<8)|u[q+3];
      if(m>=0xC0&&m<=0xCF&&m!==0xC4&&m!==0xC8&&m!==0xCC){ if(m===0xC3) return null; h=(u[q+5]<<8)|u[q+6]; w=(u[q+7]<<8)|u[q+8]; }
      if(m===0xDA){let r=q+2+len;while(r+1<u.length){if(u[r]===0xFF&&u[r+1]===0xD9)return w&&h?{s:p,e:r+2,w,h}:null;r++;}return null;}
      q+=2+len;
    }
    return null;
  }
  function decodeRAW(u,name){
    let best=null;
    for(let p=0;p+3<u.length;p++){
      if(u[p]!==0xFF||u[p+1]!==0xD8||u[p+2]!==0xFF) continue;
      const j=jpegAt(u,p);
      if(j){ if(!best||j.w*j.h>best.w*best.h) best=j; p=j.e-1; }
    }
    if(!best) throw new Error('w pliku RAW nie ma podglądu JPEG');
    const ext=(name.split('.').pop()||'').toUpperCase();
    return {jpeg:u.slice(best.s,best.e),meta:{format:ext||'RAW',width:best.w,height:best.h,mode:'podgląd JPEG z pliku'}};
  }
  return {decode};
}
