# DICTIONARY_GUIDE

## 如何生成词表

可以用 AI 生成候选词表，但不能直接发布。候选词表需要人工筛选，确保词语自然、无重复、无敏感含义，并适合固定模板。

## 如何校验词表

运行：

```bash
npm run validate:dictionaries
```

校验项包括：

- 每个使用中的槽位，每个 0-15 value 至少有 8 条候选短语。
- 同一风格、同一槽位下，短语不能重复，也不能跨 value 复用。
- 模板引用的槽位必须存在。
- 模板渲染后必须包含句末标点，允许一个编码单元包含多个中文句子。
- 样例编码单元不能解析成多个不同 bit 映射。
- 四种风格必须通过固定 payload 的编码/解码往返。

## 为什么旧词表不能重排

Cover Text 通过词表索引还原 bitstream。如果发布后重排、删除或替换旧词表，同一段旧密文会被解码成不同 payload，导致无法解密。需要调整时只能新增 `coverVersion`。

## 封版前检查

发布前必须执行：

```bash
npm run validate:dictionaries
npm test
npm run typecheck
npm run lint
npm run build
```

如果已经公开发布过某个 `coverVersion`，不得继续在该版本上修改、删除或重排模板和词表；新增词表应升级到新的 `coverVersion` 并保留旧版本解析能力。
