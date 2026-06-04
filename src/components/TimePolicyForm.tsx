import type { TimePolicy } from '../payload/payloadTypes';
import { datetimeLocalToUnixSeconds, unixSecondsToDatetimeLocal } from '../time/timePolicy';

export function TimePolicyForm({ value, onChange }: { value: TimePolicy; onChange: (value: TimePolicy) => void }) {
  const enabled = Boolean(value.notBefore || value.expiresAt || (value.mode && value.mode !== 'none'));
  const update = (patch: Partial<TimePolicy>) => onChange({ ...value, ...patch });
  return (
    <fieldset className="form-group">
      <legend>时间锁</legend>
      <label className="inline-row">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => {
            if (event.target.checked) {
              onChange({ mode: 'local_soft', allowedDriftSeconds: 300 });
            } else {
              onChange({ mode: 'none', allowedDriftSeconds: 300 });
            }
          }}
        />
        设置解密时间范围
      </label>
      <p className="notice">时间锁会根据当前设备时间判断是否允许解密。它用于减少误开，不是绝对防绕过的安全边界。</p>
      {enabled && (
        <div className="grid-two">
          <label>
            可解密开始时间
            <input
              type="datetime-local"
              value={unixSecondsToDatetimeLocal(value.notBefore)}
              onChange={(event) => update({ notBefore: datetimeLocalToUnixSeconds(event.target.value) ?? 0 })}
            />
          </label>
          <label>
            过期时间
            <input
              type="datetime-local"
              value={unixSecondsToDatetimeLocal(value.expiresAt)}
              onChange={(event) => update({ expiresAt: datetimeLocalToUnixSeconds(event.target.value) ?? 0 })}
            />
          </label>
        </div>
      )}
    </fieldset>
  );
}
