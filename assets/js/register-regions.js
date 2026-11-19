(function (root) {
  'use strict';
  const names='北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split(' ');
  const codes=Object.fromEntries(names.map((n,i)=>[String(i+1).padStart(2,'0'),n]));
  const kanto='08 09 10 11 12 13 14 15 19 20'.split(' ');
  async function hash(bytes){
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  }
  function active(m,code){
    if (!Array.isArray(m.datasets)) throw new Error('manifest の datasets がありません。');
    const rows=m.datasets.filter(x=>x.prefectureCode===code && x.active===true);
    if(rows.length>1) throw new Error('都道府県の有効データが重複しています。');
    if(rows.length) return rows[0];
    if(code==='13' && !m.manifestVersion){
      return m.datasets.find(x=>x.datasetId===m.activeDatasetId && /^tokyo-dental-/.test(x.datasetId));
    }
  }
  async function verify(meta,text){
    if(meta.prefectureCode && !/^[a-f0-9]{64}$/.test(meta.checksum))throw new Error('checksum が不正です。');
    if(meta.checksum && await hash(new TextEncoder().encode(text))!==meta.checksum)throw new Error('配布データのchecksumが一致しません。');
    const d=JSON.parse(text.replace(/^\uFEFF/,''));
    if(d.datasetId!==meta.datasetId || (meta.prefectureCode && (d.prefectureCode!==meta.prefectureCode ||
      d.asOfDate!==meta.asOfDate || d.institutionCount!==meta.institutionCount || d.facilityCount!==meta.facilityCount ||
      d.recordsByClinic?.length!==d.institutionCount || d.recordsByClinic.reduce((n,c)=>n+c.facilities.length,0)!==d.facilityCount)))throw new Error('manifestと配布データが一致しません。');
    return d;
  }
  root.RegisterRegions={codes,kanto,hash,active,verify};
})(globalThis);
