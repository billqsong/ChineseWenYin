export type WenyinErrorCode =
  | 'INVALID_HEADER'
  | 'INVALID_COVER_TEXT'
  | 'UNSUPPORTED_VERSION'
  | 'TIME_NOT_YET_VALID'
  | 'TIME_EXPIRED'
  | 'TIME_CHECK_FAILED'
  | 'DECRYPT_FAILED'
  | 'LOCAL_ATTEMPT_LOCKED'
  | 'INVALID_PASSWORD_STRENGTH'
  | 'INVALID_INPUT'
  | 'HONEY_FAKE_RESULT';

export class WenyinError extends Error {
  readonly code: WenyinErrorCode;

  constructor(code: WenyinErrorCode, message: string) {
    super(message);
    this.name = 'WenyinError';
    this.code = code;
  }
}

export function toUserMessage(error: unknown): string {
  if (error instanceof WenyinError) {
    switch (error.code) {
      case 'INVALID_HEADER':
        return '密文格式不支持';
      case 'INVALID_COVER_TEXT':
        return '密文内容不完整或被修改';
      case 'UNSUPPORTED_VERSION':
        return '当前版本不支持该密文，请升级';
      case 'TIME_NOT_YET_VALID':
        return '尚未到解密时间';
      case 'TIME_EXPIRED':
        return '该密文已过期';
      case 'TIME_CHECK_FAILED':
        return '无法读取当前设备时间，暂不能解密';
      case 'LOCAL_ATTEMPT_LOCKED':
        return '当前设备上该密文已多次解密失败，请稍后再试';
      case 'INVALID_PASSWORD_STRENGTH':
        return error.message;
      case 'HONEY_FAKE_RESULT':
        return '解密完成';
      default:
        return '解密失败：密钥错误、密文被修改、时间不符合要求或格式不支持';
    }
  }
  return '操作失败，请检查输入后重试';
}
