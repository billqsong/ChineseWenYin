import { useState } from 'react';
import { DecryptPanel } from './components/DecryptPanel';
import { EncryptPanel } from './components/EncryptPanel';

type Tab = 'encrypt' | 'decrypt';

export default function App() {
  const [tab, setTab] = useState<Tab>('encrypt');
  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">WenYin / ChiCrypt</p>
          <h1>文隐</h1>
          <p className="hero-copy">把秘密加密成一段看起来正常的中文。所有处理都在浏览器本地完成。</p>
          <ul className="hero-points">
            <li>密钥不会被保存，丢失后无法找回。</li>
            <li>中文、英文、数字和符号都可以作为密钥。</li>
            <li>弱密钥会降低整体安全性。</li>
          </ul>
        </div>
      </header>
      <nav className="tabs" aria-label="页面分区">
        <button className={tab === 'encrypt' ? 'active' : ''} onClick={() => setTab('encrypt')}>
          加密
        </button>
        <button className={tab === 'decrypt' ? 'active' : ''} onClick={() => setTab('decrypt')}>
          解密
        </button>
      </nav>
      <section className="panel-stage">
        {tab === 'encrypt' && <EncryptPanel />}
        {tab === 'decrypt' && <DecryptPanel />}
      </section>
    </main>
  );
}
