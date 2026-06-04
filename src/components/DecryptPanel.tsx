import { useState } from 'react';
import { decryptFromChineseCover } from '../index';
import { copyToClipboard } from '../utils/clipboard';
import { toUserMessage, WenyinError } from '../utils/errors';

export function DecryptPanel() {
  const [coverText, setCoverText] = useState('');
  const [password, setPassword] = useState('');
  const [plainText, setPlainText] = useState('');
  const [status, setStatus] = useState('');
  const [copyHint, setCopyHint] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<Record<string, string | number>>({});

  async function runDecrypt() {
    setLoading(true);
    setStatus('正在解析中文密文...');
    setCopyHint('');
    try {
      setStatus('正在校验时间锁...');
      const result = await decryptFromChineseCover(coverText, password);
      setStatus('解密完成');
      setPlainText(result.plainText);
      setDetails({
        状态: 'completed',
        时间来源: result.timeSource ?? 'none',
        密文指纹: result.fingerprint,
        安全等级: result.header.securityLevel,
        时间模式: result.header.timeMode
      });
    } catch (error) {
      setPlainText('');
      setStatus(toUserMessage(error));
      setDetails({ 错误码: error instanceof WenyinError ? error.code : 'UNKNOWN' });
    } finally {
      setLoading(false);
    }
  }

  async function copyPlain() {
    const ok = await copyToClipboard(plainText);
    setCopyHint(ok ? '已复制' : '复制失败，请手动选择复制');
  }

  return (
    <div className="work-panel">
      <label>
        中文密文
        <textarea value={coverText} onChange={(event) => setCoverText(event.target.value)} placeholder="请粘贴中文密文" />
      </label>
      <label>
        密钥
        <input type={passwordVisible ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入解密密钥" />
      </label>
      <div className="button-row">
        <button type="button" onClick={() => setPasswordVisible((value) => !value)}>
          {passwordVisible ? '隐藏密钥' : '显示密钥'}
        </button>
      </div>
      <button className="primary" disabled={!coverText || !password || loading} onClick={runDecrypt}>
        {loading ? '解密中...' : '解密'}
      </button>
      {status && <p className="status">{status}</p>}
      <label>
        原文
        <textarea readOnly value={plainText} placeholder="解密成功后显示原文" />
      </label>
      <button disabled={!plainText} onClick={copyPlain}>
        复制原文
      </button>
      {copyHint && <p className="status">{copyHint}</p>}
      <details>
        <summary>详细信息</summary>
        <pre>{JSON.stringify(details, null, 2)}</pre>
      </details>
    </div>
  );
}
