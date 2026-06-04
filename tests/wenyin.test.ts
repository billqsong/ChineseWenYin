import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { decodeCoverText } from '../src/cover/coverDecoder';
import { encodeCoverText, validateCoverDictionary } from '../src/cover/coverEncoder';
import { decodePayload, encodePayload, getPayloadAad } from '../src/payload/payloadCodec';
import { decryptFromChineseCover, encryptToChineseCover } from '../src';
import { MockTimeProvider } from '../src/time/MockTimeProvider';
import { normalizePassword } from '../src/password/normalizePassword';
import { generateStrongPassword } from '../src/password/generateStrongPassword';
import { getPasswordStrength } from '../src/password/passwordStrength';
import { EncryptPanel } from '../src/components/EncryptPanel';
import App from '../src/App';
import { randomBytes } from '../src/crypto/random';
import { deriveKey } from '../src/crypto/kdf';
import { encryptAead } from '../src/crypto/cryptoCore';
import { DEFAULT_ALLOWED_DRIFT_SECONDS, type CoverStyle, type Payload, type TimeMode } from '../src/payload/payloadTypes';
import { utf8Encode } from '../src/utils/bytes';

const strongPassword = '青山不改_热汤42_月光不回头!';
const extremePassword = '我在秋天的桥边等过3次风#2026-月光不回头!';

afterEach(() => cleanup());

async function roundTrip(text: string, password = strongPassword) {
  const cover = await encryptToChineseCover(text, password);
  const result = await decryptFromChineseCover(cover, password, { skipAttemptLimiter: true });
  expect(result.plainText).toBe(text);
  return cover;
}

async function buildCustomPayloadCover(
  plainText: string,
  password: string,
  overrides: Partial<Payload['header']> = {}
): Promise<string> {
  const salt = randomBytes(16);
  const nonce = randomBytes(24);
  const ciphertextLength = utf8Encode(plainText).length + 16;
  const argonParamCode = overrides.argonParamCode ?? 1;
  const key = await deriveKey(password, salt, argonParamCode);
  const header: Payload['header'] = {
    version: 2,
    coverVersion: 2,
    compression: 'none',
    kdf: 'argon2id',
    cipher: 'xchacha20-poly1305',
    cryptoSuite: 'ARGON2ID_XCHACHA20POLY1305',
    securityLevel: 'standard',
    honeyMode: 'off',
    timeMode: 'none',
    notBefore: 0,
    expiresAt: 0,
    allowedDriftSeconds: DEFAULT_ALLOWED_DRIFT_SECONDS,
    argonParamCode,
    saltLength: 16,
    nonceLength: 24,
    ciphertextLength,
    ...overrides
  };
  const aadPayload: Payload = { header, salt, nonce, ciphertextWithTag: new Uint8Array() };
  const aad = getPayloadAad(encodePayload(aadPayload));
  const ciphertextWithTag = await encryptAead(plainText, aad, nonce, key);
  return encodeCoverText(encodePayload({ header: { ...header, ciphertextLength: ciphertextWithTag.length }, salt, nonce, ciphertextWithTag }));
}

describe('WenYin core encryption', () => {
  it('中文短句可逆', async () => {
    await roundTrip('今晚八点老地方见');
  });

  it('中文长文可逆', async () => {
    await roundTrip('雨后的街道显得清爽，路边的灯光慢慢落在树影里。'.repeat(30));
  });

  it('英文数字可逆', async () => {
    await roundTrip('Meet at gate A12 with code 2048.');
  });

  it('Emoji 可逆', async () => {
    await roundTrip('今天很好🙂，记得带上🍵和📘。');
  });

  it('换行文本可逆', async () => {
    await roundTrip('第一行\n第二行\n第三行');
  });

  it('中文密钥可用', async () => {
    await roundTrip('中文密钥测试', '床前明月光-2026-橘子在桥边!');
  });

  it('数字、字母、中文和混合短语都可作为密钥', async () => {
    await roundTrip('中文短语密钥', '窗前明月光');
    await roundTrip('拼音数字密钥', 'chuangqian123');
    await roundTrip('混合密钥', '窗前明月光123ABC');
  });

  it('前后空格密钥规范化一致', async () => {
    const cover = await encryptToChineseCover('空格规范化', ' 床前明月光-2026! ');
    const result = await decryptFromChineseCover(cover, '床前明月光-2026!', { skipAttemptLimiter: true });
    expect(result.plainText).toBe('空格规范化');
  });

  it('NFKC 规范化一致', async () => {
    expect(normalizePassword('ＡＢＣ１２３')).toBe('ABC123');
    const cover = await encryptToChineseCover('全角规范化', 'ＡＢＣ１２３中文!');
    const result = await decryptFromChineseCover(cover, 'ABC123中文!', { skipAttemptLimiter: true });
    expect(result.plainText).toBe('全角规范化');
  });

  it('错误密钥失败', async () => {
    const cover = await encryptToChineseCover('不能被错误密钥打开', strongPassword);
    await expect(decryptFromChineseCover(cover, '错误密钥-2026!', { skipAttemptLimiter: true })).rejects.toMatchObject({
      code: 'DECRYPT_FAILED'
    });
  });

  it('密文篡改失败', async () => {
    const cover = await encryptToChineseCover('篡改检测', strongPassword);
    const payloadBytes = await decodeCoverText(cover);
    payloadBytes[payloadBytes.length - 1] ^= 1;
    const tampered = await encodeCoverText(payloadBytes);
    await expect(decryptFromChineseCover(tampered, strongPassword, { skipAttemptLimiter: true })).rejects.toMatchObject({
      code: 'DECRYPT_FAILED'
    });
  });

  it('payload 时间策略篡改失败', async () => {
    const cover = await encryptToChineseCover('时间策略不可篡改', strongPassword);
    const payloadBytes = await decodeCoverText(cover);
    payloadBytes[12] = 1;
    const tampered = await encodeCoverText(payloadBytes);
    await expect(decryptFromChineseCover(tampered, strongPassword, { skipAttemptLimiter: true })).rejects.toMatchObject({
      code: 'DECRYPT_FAILED'
    });
  });

  it('同文同密钥多次加密输出不同', async () => {
    const first = await encryptToChineseCover('同文同密钥', strongPassword);
    const second = await encryptToChineseCover('同文同密钥', strongPassword);
    expect(first).not.toBe(second);
  });

  it('standard / extreme 均可正常加解密', async () => {
    for (const securityLevel of ['standard', 'extreme'] as const) {
      const cover = await encryptToChineseCover(`安全等级 ${securityLevel}`, extremePassword, { securityLevel });
      const result = await decryptFromChineseCover(cover, extremePassword, { skipAttemptLimiter: true });
      expect(result.plainText).toBe(`安全等级 ${securityLevel}`);
      expect(result.header.securityLevel).toBe(securityLevel);
    }
  });

  it('standard 模式允许弱密钥但记录弱强度', async () => {
    const cover = await encryptToChineseCover('标准弱密钥仍可生成', '123456', { securityLevel: 'standard' });
    const result = await decryptFromChineseCover(cover, '123456', { skipAttemptLimiter: true });
    expect(result.plainText).toBe('标准弱密钥仍可生成');
    expect(getPasswordStrength('123456').score).toBeLessThan(4);
  });

  it('extreme 模式非强密钥禁止加密', async () => {
    await expect(encryptToChineseCover('极高安全弱密钥', 'abc123456', { securityLevel: 'extreme' })).rejects.toMatchObject({
      code: 'INVALID_PASSWORD_STRENGTH'
    });
  });

  it('extreme 模式要求 4 级强度密钥', async () => {
    await expect(encryptToChineseCover('极高安全需要四级', strongPassword, { securityLevel: 'extreme' })).rejects.toMatchObject({
      code: 'INVALID_PASSWORD_STRENGTH'
    });
  });

  it('现代中文长句可以达到 4 级，常见名句不会轻易达到 4 级', () => {
    expect(getPasswordStrength('雨后的书店门口我把蓝色车票放进旧信封里然后沿着河岸慢慢回家').score).toBe(4);
    expect(getPasswordStrength('床前明月光疑是地上霜').score).toBeLessThan(4);
  });

  it('一键生成强密钥达到 4 级且多次不同', async () => {
    const generated = Array.from({ length: 24 }, () => generateStrongPassword());
    for (const password of generated) {
      expect(getPasswordStrength(password).score).toBe(4);
    }
    expect(new Set(generated).size).toBeGreaterThan(1);
    expect(new Set(generated.map((password) => password.split('-')[0])).size).toBeGreaterThan(3);
  });

  it('一键生成强密钥可用于极高安全加解密', async () => {
    const password = generateStrongPassword();
    const cover = await encryptToChineseCover('生成强密钥可逆', password, { securityLevel: 'extreme' });
    const result = await decryptFromChineseCover(cover, password, { skipAttemptLimiter: true });
    expect(result.plainText).toBe('生成强密钥可逆');
  });

  it('新加密路径只生成 standard / extreme 参数码', async () => {
    const standardCover = await encryptToChineseCover('标准参数码', '123456', { securityLevel: 'standard' });
    const extremeCover = await encryptToChineseCover('极高参数码', extremePassword, { securityLevel: 'extreme' });
    expect(decodePayload(await decodeCoverText(standardCover)).header.argonParamCode).toBe(1);
    expect(decodePayload(await decodeCoverText(extremeCover)).header.argonParamCode).toBe(3);
  });

  it('新生成 payload 使用 cover v2', async () => {
    const cover = await encryptToChineseCover('v2 payload', strongPassword);
    expect(decodePayload(await decodeCoverText(cover)).header.coverVersion).toBe(2);
  });

  it('长文本压缩后仍可逆且记录压缩模式', async () => {
    const plainText = '雨后的街道显得清爽，路边的灯光慢慢落在树影里。'.repeat(80);
    const cover = await encryptToChineseCover(plainText, strongPassword);
    const result = await decryptFromChineseCover(cover, strongPassword, { skipAttemptLimiter: true });
    expect(result.plainText).toBe(plainText);
    expect(result.header.compression).toBe('deflate_raw');
  });
});

describe('WenYin time policy', () => {
  it('新生成时间锁密文统一使用本地时间校验', async () => {
    const now = Math.floor(Date.now() / 1000);
    const cover = await encryptToChineseCover('本地时间策略', strongPassword, {
      timePolicy: { notBefore: now - 10, expiresAt: now + 3600 }
    });
    const payload = decodePayload(await decodeCoverText(cover));
    expect(payload.header.timeMode).toBe('local_soft');
    expect(payload.header.allowedDriftSeconds).toBe(DEFAULT_ALLOWED_DRIFT_SECONDS);
  });

  it('未到时间不能解密', async () => {
    const now = Math.floor(Date.now() / 1000);
    const cover = await encryptToChineseCover('未到时间', strongPassword, {
      timePolicy: { mode: 'local_soft', notBefore: now + 3600, allowedDriftSeconds: 300 }
    });
    await expect(decryptFromChineseCover(cover, strongPassword, { skipAttemptLimiter: true })).rejects.toMatchObject({
      code: 'TIME_NOT_YET_VALID'
    });
  });

  it('过期不能解密', async () => {
    const now = Math.floor(Date.now() / 1000);
    const cover = await encryptToChineseCover('已经过期', strongPassword, {
      timePolicy: { mode: 'local_soft', expiresAt: now - 10, allowedDriftSeconds: 300 }
    });
    await expect(decryptFromChineseCover(cover, strongPassword, { skipAttemptLimiter: true })).rejects.toMatchObject({
      code: 'TIME_EXPIRED'
    });
  });

  it('允许时间范围内可以正常解密', async () => {
    const now = Math.floor(Date.now() / 1000);
    const cover = await encryptToChineseCover('时间范围内', strongPassword, {
      timePolicy: { mode: 'local_soft', notBefore: now - 60, expiresAt: now + 3600, allowedDriftSeconds: 300 }
    });
    const result = await decryptFromChineseCover(cover, strongPassword, {
      timeProvider: new MockTimeProvider(now),
      skipAttemptLimiter: true
    });
    expect(result.plainText).toBe('时间范围内');
    expect(result.timeSource).toBe('mock');
  });

  it('历史时间校验字段仍按本地时间兼容解密', async () => {
    const now = Math.floor(Date.now() / 1000);
    for (const timeMode of ['online_time_preferred', 'online_time_required'] as TimeMode[]) {
      const cover = await buildCustomPayloadCover(`旧时间字段 ${timeMode}`, strongPassword, {
        timeMode,
        notBefore: now - 60,
        expiresAt: now + 3600,
        allowedDriftSeconds: 300
      });
      const result = await decryptFromChineseCover(cover, strongPassword, {
        timeProvider: new MockTimeProvider(now),
        skipAttemptLimiter: true
      });
      expect(result.plainText).toBe(`旧时间字段 ${timeMode}`);
      expect(result.header.timeMode).toBe(timeMode);
      expect(result.timeSource).toBe('mock');
    }
  });

  it('时间锁逻辑不依赖网络失败兜底', async () => {
    const now = Math.floor(Date.now() / 1000);
    const cover = await buildCustomPayloadCover('本地时间失败', strongPassword, {
      timeMode: 'online_time_required',
      expiresAt: now + 3600
    });
    await expect(
      decryptFromChineseCover(cover, strongPassword, {
        timeProvider: new MockTimeProvider(now, true),
        skipAttemptLimiter: true
      })
    ).rejects.toMatchObject({ code: 'TIME_CHECK_FAILED' });
  });
});

describe('WenYin honey fake plaintext', () => {
  it('蜜罐模式下任意错误密钥生成无关假明文', async () => {
    const real = '今晚八点老地方见';
    const cover = await encryptToChineseCover(real, extremePassword, {
      securityLevel: 'extreme',
      honeyMode: 'unrelated_fake_on_failure'
    });
    const result = await decryptFromChineseCover(cover, '错误密钥-2026-秋天!', { skipAttemptLimiter: true });
    expect(result.status).toBe('honey_fake');
    expect(result.plainText).not.toBe(real);
    expect(result.plainText).not.toContain('今晚');
    expect(result.plainText).not.toContain('老地方');
    expect(result.plainText).not.toMatch(/（[0-9A-F]{4}）$/);
  });

  it('同一错误密钥 + 同一密文生成相同假文', async () => {
    const cover = await encryptToChineseCover('真实内容甲', extremePassword, {
      securityLevel: 'extreme',
      honeyMode: 'unrelated_fake_on_failure'
    });
    const first = await decryptFromChineseCover(cover, '错误密钥-A!', { skipAttemptLimiter: true });
    const second = await decryptFromChineseCover(cover, '错误密钥-A!', { skipAttemptLimiter: true });
    expect(first.plainText).toBe(second.plainText);
  });

  it('不同错误密钥 + 同一密文生成不同假文', async () => {
    const cover = await encryptToChineseCover('真实内容乙', extremePassword, {
      securityLevel: 'extreme',
      honeyMode: 'unrelated_fake_on_failure'
    });
    const first = await decryptFromChineseCover(cover, '错误密钥-A!', { skipAttemptLimiter: true });
    const second = await decryptFromChineseCover(cover, '错误密钥-B!', { skipAttemptLimiter: true });
    expect(first.plainText).not.toBe(second.plainText);
  });

  it('蜜罐假明文不得使用真实明文长度、关键词或语义类型', async () => {
    const real = '银行转账金额九千元，地点在上海会议室。';
    const cover = await encryptToChineseCover(real, extremePassword, {
      securityLevel: 'extreme',
      honeyMode: 'unrelated_fake_on_failure'
    });
    const result = await decryptFromChineseCover(cover, '另一个错误密钥!', { skipAttemptLimiter: true });
    expect(Array.from(result.plainText).length).not.toBe(Array.from(real).length);
    for (const keyword of ['银行', '转账', '九千', '上海', '会议室']) {
      expect(result.plainText).not.toContain(keyword);
    }
  });
});

describe('WenYin cover styles', () => {
  const styles: CoverStyle[] = ['chat', 'daily', 'novel', 'classical'];

  it('四种伪装风格都可以生成中文密文并还原原文', async () => {
    for (const coverStyle of styles) {
      const cover = await encryptToChineseCover(`风格可逆 ${coverStyle}`, strongPassword, { coverStyle });
      const result = await decryptFromChineseCover(cover, strongPassword, { skipAttemptLimiter: true });
      expect(result.plainText).toBe(`风格可逆 ${coverStyle}`);
    }
  });

  it('同一 payload 使用四种风格输出不同且具备风格特征', async () => {
    const payload = new Uint8Array([1, 35, 69, 103, 137, 171, 205, 239]);
    const covers = Object.fromEntries(await Promise.all(styles.map(async (style) => [style, await encodeCoverText(payload, style)]))) as Record<CoverStyle, string>;
    expect(new Set(Object.values(covers)).size).toBe(4);
    expect(covers.daily).toMatch(/今天|早上|下午|晚上|路上|厨房|东西|感觉|还挺|没什么|放好|收起/u);
    expect(covers.chat).toMatch(/我跟你说|你先别急|哈哈|等下|回头|晚点|问题不大|先这样/u);
    expect(covers.novel).toMatch(/他|她|巷子|旧门|街角|雨声|灯光|沉默|脚步/u);
    expect(covers.classical).toMatch(/昔者|未几|既而|乃|遂|其心|桥边|林下|舟中/u);
    for (const style of styles) {
      expect(await decodeCoverText(covers[style])).toEqual(payload);
    }
  });

  it('伪装结果不包含原文和密钥', async () => {
    const plainText = '不要泄露这段原文';
    const password = '窗前明月光-2026-橘子在桥边!';
    for (const coverStyle of styles) {
      const cover = await encryptToChineseCover(plainText, password, { coverStyle });
      expect(cover).not.toContain(plainText);
      expect(cover).not.toContain(password);
    }
  });

  it('缺少风格字段的历史密文仍按默认风格生成并解码', async () => {
    const payload = new Uint8Array([9, 8, 7, 6, 5]);
    const cover = await encodeCoverText(payload);
    expect(await decodeCoverText(cover)).toEqual(payload);
  });

  it('古文风使用本地仿古模板，不包含暴露性质词汇', async () => {
    const cover = await encodeCoverText(new Uint8Array([3, 1, 4, 1, 5, 9]), 'classical');
    expect(cover).toMatch(/昔者|未几|既而|乃|遂|桥边|林下|舟中/u);
    expect(cover).not.toMatch(/加密|密钥|解密|payload/u);
  });

  it('四种风格各生成 100 次，完整句重复比例较低', async () => {
    for (const style of styles) {
      const sentences: string[] = [];
      for (let index = 0; index < 100; index += 1) {
        const cover = await encodeCoverText(new Uint8Array([index, index + 1, index + 2, index + 3, index + 4, index + 5]), style);
        sentences.push(...(cover.match(/[^。！？]+[。！？]/g) ?? []));
        expect(await decodeCoverText(cover)).toEqual(new Uint8Array([index, index + 1, index + 2, index + 3, index + 4, index + 5]));
      }
      const duplicateRatio = 1 - new Set(sentences).size / sentences.length;
      expect(duplicateRatio).toBeLessThan(0.25);
    }
  });

  it('同一明文重复加密 50 次，不出现明显模板堆叠', async () => {
    const covers = [];
    for (let index = 0; index < 50; index += 1) {
      const cover = await encryptToChineseCover('重复加密观察', strongPassword, { coverStyle: 'chat' });
      covers.push(cover);
    }
    expect(new Set(covers).size).toBeGreaterThan(45);
    expect(covers.join('').match(/我跟你说/g)?.length ?? 0).toBeLessThan(120);
    expect(covers.join('').match(/还挺正常/g)?.length ?? 0).toBeLessThan(120);
    expect(covers.join('').match(/挺顺的/g)?.length ?? 0).toBeLessThan(120);
  }, 30000);

  it('原文 5、20、80、200 字长度倍率可观测且全部可解密', async () => {
    for (const length of [5, 20, 80, 200]) {
      const plainText = '甲'.repeat(length);
      const cover = await encryptToChineseCover(plainText, strongPassword, { coverStyle: 'daily' });
      const result = await decryptFromChineseCover(cover, strongPassword, { skipAttemptLimiter: true });
      const ratio = Array.from(cover).length / Array.from(plainText).length;
      expect(result.plainText).toBe(plainText);
      expect(ratio).toBeGreaterThan(1);
    }
  });

  it('古文风和其他风格避开低质量组合', async () => {
    for (let index = 0; index < 50; index += 1) {
      const classical = await encodeCoverText(new Uint8Array([index, 2, 4, 6, 8, 10]), 'classical');
      expect(classical).not.toMatch(/昔者乃|厨房之厨房|云声响起/u);
      const daily = await encodeCoverText(new Uint8Array([index, 3, 5, 7, 9, 11]), 'daily');
      expect(daily.match(/杯子，放好了/g)?.length ?? 0).toBeLessThan(3);
      const novel = await encodeCoverText(new Uint8Array([index, 4, 6, 8, 10, 12]), 'novel');
      expect(novel.match(/雨停以后，巷子里/g)?.length ?? 0).toBeLessThan(3);
    }
  });
});

describe('WenYin cover dictionaries', () => {
  it('词表无重复', async () => {
    expect(await validateCoverDictionary()).toEqual([]);
  });

  it('模板可解析', async () => {
    const payload = new Uint8Array([1, 2, 3, 4, 5, 6, 7]);
    const cover = await encodeCoverText(payload);
    expect(await decodeCoverText(cover)).toEqual(payload);
  });

  it('生成 100 段中文密文无 undefined', async () => {
    for (let index = 0; index < 100; index += 1) {
      const cover = await encodeCoverText(new Uint8Array([index, index + 1, index + 2, index + 3]));
      expect(cover).not.toContain('undefined');
    }
  });

  it('生成密文全部可解码', async () => {
    for (let index = 0; index < 100; index += 1) {
      const payload = new Uint8Array([index, index + 1, index + 2, index + 3, index + 4]);
      const cover = await encodeCoverText(payload, index % 2 === 0 ? 'daily' : 'chat');
      expect(await decodeCoverText(cover)).toEqual(payload);
    }
  });

  it('四种风格固定边界 payload、多句模板和换行粘贴均可逆', async () => {
    const payloads = [
      new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]),
      new Uint8Array([15, 240, 85, 170, 51, 204, 17, 238]),
      new Uint8Array([255, 0, 127, 128, 64, 32, 16, 8, 4])
    ];
    for (const style of ['chat', 'daily', 'novel', 'classical'] as CoverStyle[]) {
      for (const payload of payloads) {
        const cover = await encodeCoverText(payload, style);
        expect(await decodeCoverText(cover)).toEqual(payload);
        expect(await decodeCoverText(cover.replace(/。/gu, '。\n'))).toEqual(payload);
      }
    }
  });

  it('payload 编码解码稳定', async () => {
    const cover = await encryptToChineseCover('payload 稳定', strongPassword);
    const payload = decodePayload(await decodeCoverText(cover));
    expect(decodePayload(encodePayload(payload)).header.cryptoSuite).toBe('ARGON2ID_XCHACHA20POLY1305');
  });

});

describe('WenYin simplified V2 UI', () => {
  it('加密页只输入一次密钥，并提供真实长度模式', () => {
    render(createElement(EncryptPanel));
    expect(screen.getByLabelText('密钥')).toBeTruthy();
    expect(screen.queryByText('确认密钥')).toBeNull();
    expect(screen.getByLabelText('长度模式')).toBeTruthy();
    expect(screen.getByRole('option', { name: '紧凑，优先缩短密文' })).toBeTruthy();
    expect(screen.getByRole('option', { name: '平衡，保留更强文学感' })).toBeTruthy();
    expect(screen.getByText('请妥善保存密钥。密钥不会被保存，丢失后无法找回。')).toBeTruthy();
  });

  it('安全等级只展示标准和极高安全', () => {
    render(createElement(EncryptPanel));
    const group = screen.getByRole('group', { name: '安全等级' });
    expect(within(group).getByRole('button', { name: '标准' })).toBeTruthy();
    expect(within(group).getByRole('button', { name: '极高安全' })).toBeTruthy();
    expect(within(group).queryAllByRole('button')).toHaveLength(2);
  });

  it('时间锁 UI 只保留开始和过期时间', () => {
    render(createElement(EncryptPanel));
    fireEvent.click(screen.getByText('高级选项'));
    fireEvent.click(screen.getByLabelText('设置解密时间范围'));
    expect(screen.getByLabelText('可解密开始时间')).toBeTruthy();
    expect(screen.getByLabelText('过期时间')).toBeTruthy();
    expect(screen.queryByText('时间校验模式')).toBeNull();
    expect(screen.queryByText('允许时钟偏差')).toBeNull();
    expect(screen.queryByText(/在线时间|强制在线|时钟偏差/)).toBeNull();
    expect(screen.getByText(/当前设备时间/)).toBeTruthy();
  });

  it('伪装风格展示四种真实风格', () => {
    render(createElement(EncryptPanel));
    const selector = screen.getByLabelText('伪装风格');
    expect(within(selector).getByRole('option', { name: '日常风' })).toBeTruthy();
    expect(within(selector).getByRole('option', { name: '聊天风' })).toBeTruthy();
    expect(within(selector).getByRole('option', { name: '小说风' })).toBeTruthy();
    expect(within(selector).getByRole('option', { name: '古文风' })).toBeTruthy();
    expect(within(selector).queryAllByRole('option')).toHaveLength(4);
  });

  it('标准模式弱密钥可直接生成中文密文并显示风险提示', async () => {
    render(createElement(EncryptPanel));
    fireEvent.change(screen.getByLabelText('原文'), { target: { value: '手动输入密钥直接加密' } });
    fireEvent.change(screen.getByLabelText('密钥'), { target: { value: '123456' } });
    expect(screen.getByText(/仍可使用标准模式加密/)).toBeTruthy();
    const button = screen.getByRole('button', { name: '生成中文密文' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByText('中文密文已生成')).toBeTruthy(), { timeout: 10000 });
  });

  it('生成强密钥后不需要确认即可加密', async () => {
    render(createElement(EncryptPanel));
    fireEvent.change(screen.getByLabelText('原文'), { target: { value: '生成强密钥直接加密' } });
    fireEvent.click(screen.getByRole('button', { name: '生成强密钥' }));
    fireEvent.click(screen.getByRole('button', { name: '生成中文密文' }));
    await waitFor(() => expect(screen.getByText('中文密文已生成')).toBeTruthy(), { timeout: 10000 });
  });

  it('极高安全弱密钥会阻止生成密文', () => {
    render(createElement(EncryptPanel));
    fireEvent.change(screen.getByLabelText('原文'), { target: { value: '极高安全阻止弱密钥' } });
    fireEvent.change(screen.getByLabelText('密钥'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '极高安全' }));
    const button = screen.getByRole('button', { name: '生成中文密文' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText(/极高安全要求达到 4\/4/)).toBeTruthy();
  });

  it('首页删除说明分区入口，并把信任说明放在顶部', () => {
    render(createElement(App));
    expect(screen.getByRole('button', { name: '加密' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '解密' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '说明' })).toBeNull();
    expect(screen.getByText('所有处理都在浏览器本地完成。', { exact: false })).toBeTruthy();
    expect(screen.getByText('密钥不会被保存，丢失后无法找回。')).toBeTruthy();
  });
});
