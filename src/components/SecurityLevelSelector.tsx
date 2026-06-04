import type { SecurityLevel } from '../payload/payloadTypes';

export function SecurityLevelSelector({
  value,
  onChange
}: {
  value: SecurityLevel;
  onChange: (value: SecurityLevel) => void;
}) {
  return (
    <fieldset className="segmented">
      <legend>安全等级</legend>
      {[
        ['standard', '标准'],
        ['extreme', '极高安全']
      ].map(([level, label]) => (
        <button key={level} type="button" className={value === level ? 'active' : ''} onClick={() => onChange(level as SecurityLevel)}>
          {label}
        </button>
      ))}
      <p>{value === 'standard' ? '适合日常内容，加密和解密更快。弱密钥会降低整体安全性。' : '适合重要内容，加密和解密更慢，并要求密钥强度达到 4/4。'}</p>
    </fieldset>
  );
}
