import { useMemo, useState } from 'react';
import { encryptToChineseCover } from '../index';
import type { CoverMode, CoverStyle, HoneyMode, SecurityLevel, TimePolicy } from '../payload/payloadTypes';
import { generateStrongPassword } from '../password/generateStrongPassword';
import { getPasswordStrength } from '../password/passwordStrength';
import { copyToClipboard } from '../utils/clipboard';
import { toUserMessage } from '../utils/errors';
import { fingerprint } from '../utils/hash';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { SecurityLevelSelector } from './SecurityLevelSelector';
import { TimePolicyForm } from './TimePolicyForm';

export function EncryptPanel() {
  const [plainText, setPlainText] = useState('');
  const [password, setPassword] = useState('');
  const [securityLevel, setSecurityLevel] = useState<SecurityLevel>('standard');
  const [coverStyle, setCoverStyle] = useState<CoverStyle>('novel');
  const [coverMode, setCoverMode] = useState<CoverMode>('compact');
  const [timePolicy, setTimePolicy] = useState<TimePolicy>({ mode: 'none', allowedDriftSeconds: 300 });
  const [honeyMode, setHoneyMode] = useState<HoneyMode>('off');
  const [honeyConfirmed, setHoneyConfirmed] = useState(false);
  const [coverText, setCoverText] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [copyHint, setCopyHint] = useState('');
  const [passwordCopyHint, setPasswordCopyHint] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(true);
  const [details, setDetails] = useState<Record<string, string | number>>({});
  const [resultSummary, setResultSummary] = useState<Record<string, string>>({});
  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const extremeReady = strength.score >= 4;
  const disabledReasons = [
    !plainText ? '请输入需要加密的原文。' : '',
    !password ? '请输入密钥，或点击“生成强密钥”。' : '',
    securityLevel === 'extreme' && !extremeReady
      ? `当前密钥强度为 ${strength.label}（${strength.score}/4），极高安全要求达到 4/4。请使用更长的现代中文短语，或混合中文、数字、英文字母和符号，也可以点击“生成强密钥”。`
      : '',
    honeyMode !== 'off' && !honeyConfirmed ? '开启蜜罐假明文前，需要勾选风险确认。' : ''
  ].filter(Boolean);
  const disabled = disabledReasons.length > 0;

  async function handleEncrypt() {
    setLoading(true);
    setStatus('加密中...');
    setCopyHint('');
    try {
      const result = await encryptToChineseCover(plainText, password, { securityLevel, coverStyle, coverMode, timePolicy, honeyMode });
      const coverFingerprint = await fingerprint(result);
      setCoverText(result);
      setResultSummary({
        密文指纹: coverFingerprint,
        安全等级: securityLevel === 'standard' ? '标准' : '极高安全',
        时间锁: timePolicy.mode === 'none' ? '未启用' : '已启用',
        长度模式: coverMode === 'compact' ? '紧凑' : '平衡',
        蜜罐模式: honeyMode === 'off' ? '未启用' : '已启用',
        密文版本: 'WenYin V2'
      });
      setDetails({
        原文字数: Array.from(plainText).length,
        密文字数: Array.from(result).length,
        密文指纹: coverFingerprint,
        安全等级: securityLevel,
        时间模式: timePolicy.mode ?? 'none',
        长度模式: coverMode,
        蜜罐模式: honeyMode,
        密文版本: 'WenYin V2'
      });
      setStatus('中文密文已生成');
    } catch (error) {
      setStatus(toUserMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function copyCover() {
    const ok = await copyToClipboard(coverText);
    setCopyHint(ok ? '已复制' : '复制失败，请手动选择复制');
  }

  async function copyPassword() {
    if (!password) {
      setPasswordCopyHint('请输入或生成密钥后再复制');
      return;
    }
    const ok = await copyToClipboard(password);
    setPasswordCopyHint(ok ? '密钥已复制' : '复制失败，请手动选择复制');
  }

  function handleGeneratePassword() {
    const nextPassword = generateStrongPassword();
    setPassword(nextPassword);
    setPasswordVisible(true);
    setPasswordCopyHint('已生成 4 级强度密钥，请妥善保存');
  }

  return (
    <div className="work-panel">
      <label>
        原文
        <textarea value={plainText} maxLength={5000} onChange={(event) => setPlainText(event.target.value)} placeholder="请输入需要加密的原文，例如：今晚八点老地方见" />
      </label>
      <label>
        密钥
        <input type={passwordVisible ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入密钥，可以使用中文、英文、数字和符号" />
      </label>
      <div className="button-row">
        <button type="button" onClick={handleGeneratePassword}>
          生成强密钥
        </button>
        <button type="button" onClick={copyPassword} disabled={!password}>
          复制密钥
        </button>
        <button type="button" onClick={() => setPasswordVisible((value) => !value)}>
          {passwordVisible ? '隐藏密钥' : '显示密钥'}
        </button>
      </div>
      <p className="notice">请妥善保存密钥。密钥不会被保存，丢失后无法找回。</p>
      {passwordCopyHint && <p className="status">{passwordCopyHint}</p>}
      <PasswordStrengthMeter strength={strength} />
      {securityLevel === 'standard' && password && strength.level === 'weak' && (
        <p className="notice">当前密钥较弱，仍可使用标准模式加密，但整体安全性会降低。建议使用更长的中文短语或混合数字、字母、符号。</p>
      )}
      {securityLevel === 'extreme' && !extremeReady && (
        <p className="notice">
          当前密钥强度为 {strength.label}（{strength.score}/4）。极高安全要求 4/4，请使用更长的现代中文短语，或点击“生成强密钥”。
        </p>
      )}
      <SecurityLevelSelector
        value={securityLevel}
        onChange={(value) => {
          setSecurityLevel(value);
          if (value !== 'extreme') {
            setHoneyMode('off');
            setHoneyConfirmed(false);
          }
        }}
      />
      <label>
        伪装风格
        <select value={coverStyle} onChange={(event) => setCoverStyle(event.target.value as CoverStyle)}>
          <option value="daily">日常风</option>
          <option value="chat">聊天风</option>
          <option value="novel">小说风</option>
          <option value="classical">古文风</option>
        </select>
      </label>
      <label>
        长度模式
        <select value={coverMode} onChange={(event) => setCoverMode(event.target.value as CoverMode)}>
          <option value="compact">紧凑，优先缩短密文</option>
          <option value="balanced">平衡，保留更强文学感</option>
        </select>
      </label>
      <details>
        <summary>高级选项</summary>
        <div className="details-content">
          <TimePolicyForm value={timePolicy} onChange={setTimePolicy} />
          {securityLevel === 'extreme' && (
            <fieldset className="form-group">
              <legend>蜜罐假明文</legend>
              <label className="inline-row">
                <input type="checkbox" checked={honeyMode !== 'off'} disabled={!extremeReady} onChange={(event) => setHoneyMode(event.target.checked ? 'unrelated_fake_on_failure' : 'off')} />
                启用错误密钥无关假结果
              </label>
              {!extremeReady && <p className="error-text">蜜罐假明文需要极高安全模式，并且密钥强度达到 4/4。</p>}
              {honeyMode !== 'off' && (
                <label className="inline-row">
                  <input type="checkbox" checked={honeyConfirmed} onChange={(event) => setHoneyConfirmed(event.target.checked)} />
                  我理解错误密钥可能显示无关假结果，该功能不替代强密钥。
                </label>
              )}
            </fieldset>
          )}
        </div>
      </details>
      <button className="primary" disabled={disabled || loading} onClick={handleEncrypt}>
        {loading ? '加密中...' : '生成中文密文'}
      </button>
      {disabledReasons.length > 0 && (
        <div className="reason-box">
          <strong>无法生成：</strong>
          <ul>
            {disabledReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
      {status && <p className="status">{status}</p>}
      {coverText && (
        <section className="result-box" aria-label="加密结果">
          <h2>加密结果</h2>
          <div className="summary-grid">
            {Object.entries(resultSummary).map(([key, value]) => (
              <div key={key}>
                <span>{key}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <label>
            中文密文
            <textarea readOnly value={coverText} placeholder="生成后显示中文自然密文" />
          </label>
          <p className="notice">请完整复制密文，不要修改任何字、标点、换行或头部标识。密文和密钥请分开复制，避免误发。</p>
          <div className="button-row">
            <button disabled={!coverText} onClick={copyCover}>
              复制中文密文
            </button>
            <button disabled={!password} onClick={copyPassword}>
              复制密钥
            </button>
          </div>
        </section>
      )}
      {copyHint && <p className="status">{copyHint}</p>}
      <details>
        <summary>详细信息</summary>
        <pre>{JSON.stringify(details, null, 2)}</pre>
      </details>
    </div>
  );
}
