# FORMAT

## Payload

Payload version 固定为 `2`，magic 固定为 `WYIN`。字段顺序：

```text
magic                4 bytes     "WYIN"
version              1 byte      0x02
coverVersion         1 byte      0x02
compression          1 byte      0x00 none / 0x01 deflate_raw
kdf                  1 byte      0x01 argon2id
cipher               1 byte      0x01 xchacha20-poly1305
cryptoSuite          1 byte      0x01 ARGON2ID_XCHACHA20POLY1305
securityLevel        1 byte      0 standard / 1 legacy middle / 2 extreme
honeyMode            1 byte      0 off / 1 unrelated_fake_on_failure
timeMode             1 byte      0 none / 1 local_soft / 2 legacy online preferred / 3 legacy online required
notBefore            8 bytes     uint64 unix seconds, 0 = no limit
expiresAt            8 bytes     uint64 unix seconds, 0 = no limit
allowedDriftSeconds  4 bytes     uint32, default 300
argonParamCode       1 byte      1 standard / 2 legacy middle / 3 extreme
saltLength           1 byte      16
nonceLength          1 byte      24
ciphertextLength     4 bytes
salt                 16 bytes
nonce                24 bytes
ciphertextWithTag    N bytes
```

## AAD

AAD 使用 payload header bytes 中除 magic 外的认证字段，覆盖 version、coverVersion、compression、cryptoSuite、securityLevel、honeyMode、timeMode、notBefore、expiresAt、allowedDriftSeconds、argonParamCode 和 ciphertextLength。

修改时间策略、算法版本、压缩标记、安全等级或密文长度应导致认证失败或格式错误。

当前 UI 只生成 `standard` 与 `extreme` 两档安全等级，对应 Argon2id 参数码 `1` 与 `3`。

当前 UI 启用时间锁时只生成 `local_soft`，并使用本地设备时间校验。历史 payload v2 中的旧时间校验字段和值仍会兼容读取，但当前版本不再作为 UI 功能暴露，也不再进行网络取时。

## Cover Input

自然中文编码前输入：

```text
coverInput = uint32be(payload.length) + payload
```

解码时根据长度忽略末尾 padding bits。

## Compression

加密前会尝试 `deflate_raw` 压缩 UTF-8 明文字节。只有压缩结果经 base64 表示后仍短于原始 UTF-8 字节时，才将 `compression` 写为 `0x01` 并加密压缩文本；否则保持 `none`。
