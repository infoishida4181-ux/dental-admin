/* 端末内完結の暗号化JSON保存ユーティリティ */
const BASEUP_SECURE_STORAGE_VERSION = '1.0.0';
const SECURE_FEATURE_BASEUP = 'ベースアップ評価料 賃上げシミュレーター';
const SECURE_FEATURE_EMPLOYEE = '従業員情報管理';

function isSecureStorageAvailable(){
  return Boolean(window.crypto && window.crypto.subtle && window.TextEncoder && window.TextDecoder);
}

function baseupArrayBufferToBase64(buffer){
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function baseupBase64ToArrayBuffer(base64){
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function deriveBaseupEncryptionKey(password, salt){
  const encoded = new TextEncoder().encode(password);
  const baseKey = await crypto.subtle.importKey('raw', encoded, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name:'PBKDF2', salt, iterations:150000, hash:'SHA-256' },
    baseKey,
    { name:'AES-GCM', length:256 },
    false,
    ['encrypt','decrypt']
  );
}

async function encryptSecureJsonPayload(data, password, featureName=SECURE_FEATURE_BASEUP){
  if(!isSecureStorageAvailable()) throw new Error('このブラウザでは暗号化機能を利用できません。');
  if(!password || password.length < 8) throw new Error('パスワードは8文字以上を推奨します。');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBaseupEncryptionKey(password, salt);
  const payload = {
    schema:'baseup-secure-payload',
    version:BASEUP_SECURE_STORAGE_VERSION,
    savedAt:new Date().toISOString(),
    data
  };
  const encrypted = await crypto.subtle.encrypt(
    { name:'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(payload))
  );
  return {
    appName:'歯科保険施設基準管理アプリ',
    featureName,
    version:BASEUP_SECURE_STORAGE_VERSION,
    createdAt:new Date().toISOString(),
    crypto:{
      algorithm:'AES-GCM',
      keyDerivation:'PBKDF2',
      hash:'SHA-256',
      iterations:150000
    },
    salt:baseupArrayBufferToBase64(salt),
    iv:baseupArrayBufferToBase64(iv),
    encryptedData:baseupArrayBufferToBase64(encrypted)
  };
}

async function decryptSecureJsonPayload(encryptedFileObject, password, allowedFeatureNames=[SECURE_FEATURE_BASEUP]){
  if(!isSecureStorageAvailable()) throw new Error('このブラウザでは復号機能を利用できません。');
  if(!encryptedFileObject || !allowedFeatureNames.includes(encryptedFileObject.featureName)){
    throw new Error('ファイル形式が違います。');
  }
  if(encryptedFileObject.version && encryptedFileObject.version.split('.')[0] !== BASEUP_SECURE_STORAGE_VERSION.split('.')[0]){
    throw new Error('読み込んだデータのバージョンが想定外です。');
  }
  try{
    const salt = new Uint8Array(baseupBase64ToArrayBuffer(encryptedFileObject.salt));
    const iv = new Uint8Array(baseupBase64ToArrayBuffer(encryptedFileObject.iv));
    const encrypted = baseupBase64ToArrayBuffer(encryptedFileObject.encryptedData);
    const key = await deriveBaseupEncryptionKey(password, salt);
    const decrypted = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, key, encrypted);
    const payload = JSON.parse(new TextDecoder().decode(decrypted));
    return payload.data;
  }catch(_err){
    throw new Error('復号に失敗しました。パスワードまたはファイルをご確認ください。');
  }
}

async function encryptBaseupData(data, password){
  return encryptSecureJsonPayload(data, password, SECURE_FEATURE_BASEUP);
}

async function decryptBaseupData(encryptedFileObject, password){
  return decryptSecureJsonPayload(encryptedFileObject, password, [SECURE_FEATURE_BASEUP]);
}

function downloadBaseupSecureObject(fileObject){
  const stamp = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const blob = new Blob([JSON.stringify(fileObject,null,2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `baseup-simulation-${stamp}.baseup-secure.json`;
  a.click();
  URL.revokeObjectURL(url);
}
