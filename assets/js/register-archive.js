/* ZIP32 only. Read in memory; never extract source-controlled paths to disk. */
(function (root) {
  'use strict';
  const table = Uint32Array.from({length:256}, (_, n) => {
    for (let i=0;i<8;i++) n = (n>>>1) ^ (n&1 ? 0xedb88320 : 0);
    return n>>>0;
  });
  function crc(bytes, value=-1) {
    for (const b of bytes) value = (value>>>8) ^ table[(value^b)&255];
    return value;
  }
  function check(ok, message) { if (!ok) throw new Error(message); }
  function read(bytes, inner=false) {
    const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    const u16=i=>v.getUint16(i,true), u32=i=>v.getUint32(i,true);
    const end=bytes.length-22;
    check(end>=0 && u32(end)===0x06054b50 && !u16(end+4) && !u16(end+6) && !u16(end+20), '非対応または破損したZIPです。');
    const count=u16(end+10), start=u32(end+16), entries=new Map();
    check(count===u16(end+8) && count>0 && count<=(inner?128:24) && start+u32(end+12)===end,'ZIP目録が不正です。');
    let p=start,total=0;
    for(let i=0;i<count;i++){
      check(u32(p)===0x02014b50,'ZIPエントリが破損しています。');
      const flags=u16(p+8), method=u16(p+10), sum=u32(p+16), compressed=u32(p+20), size=u32(p+24);
      const nameSize=u16(p+28), local=u32(p+42);
      const rawName=bytes.subarray(p+46,p+46+nameSize);
      const name=new TextDecoder(flags&2048?'utf-8':'shift_jis',{fatal:true}).decode(rawName);
      check(name && !/^[\\/]|[\\:\x00-\x1f]|(?:^|\/)\.{1,2}(?:\/|$)|\/\//.test(name) && !entries.has(name),'不正または重複したZIPパスです。');
      check(!(flags & ~0x80e) && [0,8].includes(method) && u32(local)===0x04034b50 && u16(local+6)===flags && u16(local+8)===method && u16(local+26)===nameSize && rawName.every((b,j)=>bytes[local+30+j]===b),'ZIPヘッダーが一致しません。');
      const offset=local+30+nameSize+u16(local+28);
      total+=size;
      check(offset+compressed<=start && size<=(inner?160:32)*1048576 && total<=(inner?224:128)*1048576 && size<=Math.max(1024,compressed*250),'ZIPの展開容量が上限を超えています。');
      entries.set(name,{size,async consume(fn){
        let stream=new Blob([bytes.subarray(offset,offset+compressed)]).stream();
        if(method===8) stream=stream.pipeThrough(new DecompressionStream('deflate-raw'));
        const reader=stream.getReader();
        let actual=0, integrity=-1;
        try {
          for(;;){const {done,value}=await reader.read(); if(done)break;
            actual+=value.length;
            check(actual<=size,'ZIP展開サイズが一致しません。');
            integrity=crc(value,integrity);fn(value);
          }
          check(actual===size && ((~integrity)>>>0)===sum,'ZIPのCRCまたはサイズが一致しません。');
        }catch(e){await reader.cancel().catch(()=>{});throw e;}
      }});
      p+=46+nameSize+u16(p+30)+u16(p+32);
    }
    check(p===end,'ZIP目録長が一致しません。');
    return entries;
  }
  async function bytes(entry){
    const result=new Uint8Array(entry.size);let offset=0;
    await entry.consume(b=>{result.set(b,offset);offset+=b.length;});return result;
  }
  // Generated paths only. STORE keeps package creation deterministic.
  function pack(files){
    const parts=[],central=[]; let pos=0, directorySize=0;
    const header=n=>{const b=new Uint8Array(n),d=new DataView(b.buffer);return {b,w:(i,x)=>d.setUint16(i,x,true),l:(i,x)=>d.setUint32(i,x,true)};};
    for(const [name,data] of files){
      const n=new TextEncoder().encode(name),sum=~crc(data);
      const a=header(30),c=header(46);
      a.l(0,0x04034b50);a.w(4,20);a.l(14,sum);a.l(18,data.length);a.l(22,data.length);a.w(26,n.length);
      c.l(0,0x02014b50);c.w(4,20);c.w(6,20);c.l(16,sum);c.l(20,data.length);c.l(24,data.length);c.w(28,n.length);c.l(42,pos);
      a.w(6,2048);c.w(8,2048);
      parts.push(a.b,n,data);central.push(c.b,n);pos+=30+n.length+data.length;directorySize+=46+n.length;
    }
    const end=header(22);end.l(0,0x06054b50);end.w(8,files.size);end.w(10,files.size);end.l(12,directorySize);end.l(16,pos);
    return new Blob([...parts,...central,end.b],{type:'application/zip'});
  }
  root.RegisterArchive={read,bytes,pack,check};
})(globalThis);
