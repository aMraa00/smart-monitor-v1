import { useCallback, useEffect, useState } from 'react';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import { LoadingBlock } from '../../components/Spinner';
import * as devicesApi from '../../api/devices';
import { addRealtimeListener } from '../../hooks/useSocket';
import { describeCapabilityI18n, orderCapabilities } from '../../utils/capabilities';
import { useI18n } from '../../i18n/useI18n';
import { useApiError } from '../../i18n/useApiError';
import { formatDateTime, formatValue } from '../../utils/formatters';

const SEVERITIES = [
  { value: 'info', labelKey: 'alertsPanel.severityInfo' },
  { value: 'warning', labelKey: 'alertsPanel.severityWarning' },
  { value: 'critical', labelKey: 'alertsPanel.severityCritical' },
];

const STATE_TONE = { firing: 'danger', pending: 'warn', resolved: 'ok' };

function alertStateLabel(state, t) {
  const key = `alertsPanel.state${state.charAt(0).toUpperCase()}${state.slice(1)}`;
  const translated = t(key);
  return translated === key ? state : translated;
}

function severityLabel(severity, t) {
  const found = SEVERITIES.find((s) => s.value === severity);
  return found ? t(found.labelKey) : severity;
}

export function AlertsPanel({ deviceId, capabilities = [] }) {
  const { t, dateLocale } = useI18n();
  const { message: apiError } = useApiError();
  const capabilitiesList = orderCapabilities(capabilities);
  const [rules, setRules] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    capability: capabilitiesList[0] || '',
    min: '',
    max: '',
    forSeconds: 60,
    severity: 'warning',
    name: '',
  });

  const reload = useCallback(async () => {
    try {
      const [ruleList, alertList] = await Promise.all([
        devicesApi.listRules(deviceId),
        devicesApi.listAlerts(deviceId, { limit: 20 }),
      ]);
      setRules(ruleList);
      setAlerts(alertList);
      setError(null);
    } catch (err) {
      setError(apiError(err));
      setRules([]);
    }
  }, [deviceId]);

  useEffect(() => {
    setRules(null);
    reload();
  }, [reload]);

  useEffect(() => {
    const off = addRealtimeListener((event, payload) => {
      if (!payload || payload.deviceId !== deviceId) return;
      if (event === 'alert:raised' || event === 'alert:resolved') reload();
    });
    return off;
  }, [deviceId, reload]);

  async function createRule(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await devicesApi.createRule(deviceId, {
        capability: form.capability,
        min: form.min === '' ? null : Number(form.min),
        max: form.max === '' ? null : Number(form.max),
        forSeconds: Number(form.forSeconds),
        severity: form.severity,
        name: form.name.trim(),
      });
      setModalOpen(false);
      await reload();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(rule) {
    await devicesApi.updateRule(deviceId, rule.id, { enabled: !rule.enabled });
    await reload();
  }

  async function removeRule(rule) {
    await devicesApi.deleteRule(deviceId, rule.id);
    await reload();
  }

  if (rules === null) return <LoadingBlock label={t('alertsPanel.loading')} />;

  return (
    <Card
      title={t('alertsPanel.title')}
      subtitle={t('alertsPanel.subtitle')}
      actions={
        <button type="button" className="button button--primary" onClick={() => setModalOpen(true)}>
          {t('alertsPanel.newRule')}
        </button>
      }
    >
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      {rules.length === 0 ? (
        <EmptyState icon="🚨" title={t('alertsPanel.emptyRulesTitle')} hint={t('alertsPanel.emptyRulesHint')} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('alertsPanel.colCapability')}</th>
                <th>{t('alertsPanel.colRange')}</th>
                <th>{t('alertsPanel.colFor')}</th>
                <th>{t('alertsPanel.colSeverity')}</th>
                <th>{t('alertsPanel.colEnabled')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => {
                const meta = describeCapabilityI18n(rule.capability, t);
                const lo = rule.min === null ? t('alertsPanel.rangeNegInf') : formatValue(rule.min, { decimals: meta.decimals });
                const hi = rule.max === null ? t('alertsPanel.rangePosInf') : formatValue(rule.max, { decimals: meta.decimals });
                return (
                  <tr key={rule.id}>
                    <td>{meta.label}</td>
                    <td>
                      {lo} - {hi} {meta.unit}
                    </td>
                    <td>{rule.forSeconds}s</td>
                    <td>
                      <Badge tone={rule.severity === 'critical' ? 'danger' : rule.severity === 'warning' ? 'warn' : 'info'}>
                        {severityLabel(rule.severity, t)}
                      </Badge>
                    </td>
                    <td>
                      <button type="button" className="button button--ghost button--sm" onClick={() => toggleRule(rule)}>
                        {rule.enabled ? t('alertsPanel.on') : t('alertsPanel.off')}
                      </button>
                    </td>
                    <td>
                      <button type="button" className="button button--ghost button--sm" onClick={() => removeRule(rule)}>
                        {t('alertsPanel.delete')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="subsection__title">{t('alertsPanel.recentActivity')}</h3>
      {alerts.length === 0 ? (
        <p className="muted">{t('alertsPanel.recentEmpty')}</p>
      ) : (
        <ul className="alert-list">
          {alerts.map((alert) => (
            <li key={alert.id} className="alert-list__item">
              <Badge tone={STATE_TONE[alert.state] || 'neutral'}>{alertStateLabel(alert.state, t)}</Badge>
              <span className="alert-list__capability">{describeCapabilityI18n(alert.capability, t).label}</span>
              <span className="alert-list__value">{formatValue(alert.lastValue, { decimals: 1 })}</span>
              <span className="alert-list__time">{formatDateTime(alert.startedAt, dateLocale)}</span>
            </li>
          ))}
        </ul>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('alertsPanel.modalTitle')}>
        <form className="form" onSubmit={createRule}>
          <label className="field">
            <span>{t('alertsPanel.colCapability')}</span>
            <select value={form.capability} onChange={(e) => setForm({ ...form, capability: e.target.value })} required>
              {capabilitiesList.map((name) => (
                <option key={name} value={name}>
                  {describeCapabilityI18n(name, t).label}
                </option>
              ))}
            </select>
          </label>

          <div className="form__grid">
            <label className="field">
              <span>{t('alertsPanel.min')}</span>
              <input
                type="number"
                step="any"
                value={form.min}
                onChange={(e) => setForm({ ...form, min: e.target.value })}
                placeholder={t('alertsPanel.minPlaceholder')}
              />
            </label>
            <label className="field">
              <span>{t('alertsPanel.max')}</span>
              <input
                type="number"
                step="any"
                value={form.max}
                onChange={(e) => setForm({ ...form, max: e.target.value })}
                placeholder={t('alertsPanel.maxPlaceholder')}
              />
            </label>
            <label className="field">
              <span>{t('alertsPanel.persistSeconds')}</span>
              <input
                type="number"
                min="0"
                max="86400"
                value={form.forSeconds}
                onChange={(e) => setForm({ ...form, forSeconds: e.target.value })}
              />
            </label>
            <label className="field">
              <span>{t('alertsPanel.severity')}</span>
              <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                {SEVERITIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(item.labelKey)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>{t('alertsPanel.nameOptional')}</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} />
          </label>

          <button type="submit" className="button button--primary button--block" disabled={saving}>
            {saving ? t('alertsPanel.saving') : t('alertsPanel.createRule')}
          </button>
        </form>
      </Modal>
    </Card>
  );
}

export default AlertsPanel;
