import type { PasswordStrength } from '../password/passwordStrength';

export function PasswordStrengthMeter({ strength }: { strength: PasswordStrength }) {
  return (
    <div className={`strength strength-${strength.level}`}>
      <div className="strength-label">
        <span>当前密钥强度：{strength.label}</span>
        <span>{strength.score}/4</span>
      </div>
      <div className="strength-track">
        <div style={{ width: `${strength.score * 25}%` }} />
      </div>
      <p>{strength.suggestion}</p>
    </div>
  );
}
