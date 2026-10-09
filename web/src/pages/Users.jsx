import { useCallback, useEffect, useState } from 'react';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { LoadingBlock } from '../components/Spinner';
import { listUsers, createUser, updateUser, deleteUser } from '../api/auth';
import { useAuth } from '../hooks/useAuth';
import { useUiStore } from '../stores/uiStore';
import { useI18n } from '../i18n/useI18n';
import { useApiError } from '../i18n/useApiError';
import { ReportExportPanel } from '../features/reports/ReportExportPanel';
import { formatReportsUntil, hasReportsAccess } from '../utils/reportsAccess';

/** Accent per role, mirroring Settings.jsx. */
const ROLE_TONE = { admin: 'info', manager: 'warn', owner: 'neutral', viewer: 'neutral' };

const ROLE_OPTIONS = [
  { value: 'owner', descKey: 'users.roleDescOwner' },
  { value: 'manager', descKey: 'users.roleDescManager' },
  { value: 'admin', descKey: 'users.roleDescAdmin' },
  { value: 'viewer', descKey: 'users.roleDescViewer' },
];

function RoleSelect({ value, onChange, disabled, t }) {
  return (
    <select className="select" value={value} onChange={onChange} disabled={disabled}>
      {ROLE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {t(opt.descKey)}
        </option>
      ))}
    </select>
  );
}

/**
 * Admin-only account management (list, create, update, delete).
 */
export function UsersPage() {
  const { t, dateLocale } = useI18n();
  const { message: apiError } = useApiError();
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const toast = useUiStore((s) => s.toast);

  const total = meta?.total ?? users.length;
  const usersWithReports = users.filter((u) => u.role !== 'admin' && hasReportsAccess(u));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { users: items, meta: pageMeta } = await listUsers({ limit: 100 });
      setUsers(items);
      setMeta(pageMeta);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(payload) {
    setCreating(true);
    try {
      const created = await createUser(payload);
      setUsers((prev) => [created, ...prev]);
      toast(t('users.createdToast', { email: created.email, role: created.role }), 'ok');
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(userId, patch, { closeModal = true } = {}) {
    const updated = await updateUser(userId, patch);
    setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    if (patch.extendReportsMonths) {
      const until = updated.reportsAccessUntil
        ? new Date(updated.reportsAccessUntil).toLocaleDateString(dateLocale)
        : '—';
      toast(t('users.reportsExtended', { date: until }), 'ok');
    } else if (patch.revokeReportsAccess || patch.canAccessReports === false) {
      toast(t('users.reportsRevoked'), 'ok');
    } else if (patch.canAccessReports === true) {
      const until = updated.reportsAccessUntil
        ? new Date(updated.reportsAccessUntil).toLocaleDateString(dateLocale)
        : '—';
      toast(t('users.reportsOpened', { date: until }), 'ok');
    } else {
      toast(t('users.updatedToast', { email: updated.email }), 'ok');
    }
    if (closeModal) setEditUser(null);
    else setEditUser(updated);
  }

  async function handleDelete(userId) {
    const target = users.find((u) => u.id === userId);
    setDeleting(true);
    try {
      await deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      if (target) toast(t('users.deletedToast', { email: target.email }), 'ok');
      setDeleteTarget(null);
    } catch (err) {
      toast(apiError(err), 'danger');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{t('users.title')}</h1>
          <p className="muted">
            {t('users.subtitle')} · {total === 1 ? t('users.accountOne') : t('users.accountMany', { count: total })}
          </p>
        </div>
      </header>

      {error && <p className="form__error">{apiError(error)}</p>}
      {loading ? (
        <LoadingBlock label={t('users.loading')} />
      ) : (
        <>
          <UserCreateForm onCreate={handleCreate} creating={creating} t={t} apiError={apiError} />

          <Card title={t('users.reportsExportTitle')} subtitle={t('users.reportsExportHint')}>
            <ReportExportPanel showNote={false} />
          </Card>

          {usersWithReports.length > 0 && (
            <Card title={t('users.reportsEntitledTitle')} subtitle={t('users.reportsEntitledHint')}>
              <ul className="bullet-list">
                {usersWithReports.map((u) => (
                  <li key={u.id}>
                    <strong>{u.email}</strong>
                    <span className="muted"> · {formatReportsUntil(u.reportsAccessUntil, t, dateLocale)}</span>
                    <Badge tone="ok">{t('users.reportsYes')}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title={t('users.listTitle')} subtitle={t('users.listSubtitle')}>
            {users.length === 0 ? (
              <EmptyState icon="👥" title={t('users.emptyTitle')} hint={t('users.emptyHint')} />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('users.colEmail')}</th>
                      <th>{t('users.colName')}</th>
                      <th>{t('users.colRole')}</th>
                      <th>{t('users.colReports')}</th>
                      <th>{t('users.colCreated')}</th>
                      <th>{t('users.colActions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const isSelf = me?.id === u.id;
                      return (
                        <tr key={u.id}>
                          <td>{u.email}</td>
                          <td>{u.name || '—'}</td>
                          <td>
                            <Badge tone={ROLE_TONE[u.role] || 'neutral'}>{u.role}</Badge>
                          </td>
                          <td>
                            {u.role === 'admin' ? (
                              <div className="reports-cell">
                                <Badge tone="ok">{t('users.reportsAlways')}</Badge>
                                <span className="muted reports-cell__sub">{t('users.reportsAdminHint')}</span>
                              </div>
                            ) : (
                              <div className="reports-cell">
                                <Badge tone={hasReportsAccess(u) ? 'ok' : 'warn'}>
                                  {hasReportsAccess(u) ? t('users.reportsYes') : t('users.reportsNo')}
                                </Badge>
                                <span className="muted reports-cell__sub">
                                  {formatReportsUntil(u.reportsAccessUntil, t, dateLocale)}
                                </span>
                                <div className="table-actions">
                                  {hasReportsAccess(u) ? (
                                    <button
                                      type="button"
                                      className="button button--ghost button--sm"
                                      onClick={() => handleUpdate(u.id, { revokeReportsAccess: true }, { closeModal: false })}
                                    >
                                      {t('users.closeReports')}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="button button--ghost button--sm"
                                      onClick={() => handleUpdate(u.id, { canAccessReports: true }, { closeModal: false })}
                                    >
                                      {t('users.openReports')}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="button button--ghost button--sm"
                                    onClick={() => handleUpdate(u.id, { extendReportsMonths: 1 }, { closeModal: false })}
                                  >
                                    {t('users.extendReports')}
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="muted">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                          <td>
                            <div className="table-actions">
                              <button type="button" className="button button--ghost button--sm" onClick={() => setEditUser(u)}>
                                {t('common.edit')}
                              </button>
                              <button
                                type="button"
                                className="button button--danger button--sm"
                                disabled={isSelf}
                                title={isSelf ? t('users.selfNoDelete') : undefined}
                                onClick={() => setDeleteTarget(u)}
                              >
                                {t('common.delete')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      <UserEditModal
        user={editUser}
        selfId={me?.id}
        onClose={() => setEditUser(null)}
        onSave={handleUpdate}
        t={t}
        apiError={apiError}
        dateLocale={dateLocale}
      />

      <Modal
        open={Boolean(deleteTarget)}
        title={t('users.deleteTitle')}
        onClose={() => !deleting && setDeleteTarget(null)}
        footer={
          <>
            <button type="button" className="button button--ghost" disabled={deleting} onClick={() => setDeleteTarget(null)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="button button--danger"
              disabled={deleting}
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
            >
              {deleting ? t('users.deleting') : t('common.delete')}
            </button>
          </>
        }
      >
        <p>{deleteTarget ? t('users.deleteConfirm', { email: deleteTarget.email }) : ''}</p>
      </Modal>
    </>
  );
}

function UserCreateForm({ onCreate, creating, t, apiError }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('owner');
  const [canAccessReports, setCanAccessReports] = useState(false);
  const [message, setMessage] = useState(null);

  async function submit(event) {
    event.preventDefault();
    setMessage(null);
    try {
      await onCreate({
        email: email.trim(),
        password,
        name: name.trim(),
        role,
        canAccessReports: role === 'admin' ? false : canAccessReports,
      });
      setEmail('');
      setName('');
      setPassword('');
      setRole('owner');
      setCanAccessReports(false);
      setMessage({ tone: 'ok', text: t('users.createOk') });
    } catch (err) {
      setMessage({ tone: 'danger', text: apiError(err) });
    }
  }

  return (
    <Card title={t('users.createTitle')} subtitle={t('users.createSubtitle')}>
      <form className="form" onSubmit={submit}>
        <div className="form__grid">
          <label className="field">
            <span>{t('users.email')}</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="manager@example.com" />
          </label>
          <label className="field">
            <span>{t('users.name')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Fleet Manager" />
          </label>
          <label className="field">
            <span>{t('users.tempPassword')}</span>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </label>
          <label className="field">
            <span>{t('users.role')}</span>
            <RoleSelect value={role} onChange={(e) => setRole(e.target.value)} t={t} />
          </label>
        </div>
        {role !== 'admin' && (
          <>
            <label className="settings-toggle">
              <span className="settings-toggle__label">{t('users.reportsAccessLabel')}</span>
              <input type="checkbox" checked={canAccessReports} onChange={(e) => setCanAccessReports(e.target.checked)} />
            </label>
            <p className="field__hint">{t('users.reportsGrantHint')}</p>
          </>
        )}
        {message && <p className={`form__${message.tone === 'ok' ? 'success' : 'error'}`}>{message.text}</p>}
        <button type="submit" className="button button--primary" disabled={creating}>
          {creating ? t('users.creating') : t('users.create')}
        </button>
      </form>
    </Card>
  );
}

function UserEditModal({ user, selfId, onClose, onSave, t, apiError, dateLocale }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('owner');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isSelf = user && selfId === user.id;

  useEffect(() => {
    if (!user) return;
    setEmail(user.email);
    setName(user.name || '');
    setRole(user.role || 'owner');
    setPassword('');
    setError('');
  }, [user]);

  if (!user) return null;

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const patch = {
        email: email.trim(),
        name: name.trim(),
        role,
      };
      if (password.trim().length >= 8) patch.password = password;
      await onSave(user.id, patch);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function extendReports() {
    setError('');
    setSaving(true);
    try {
      await onSave(user.id, { extendReportsMonths: 1 }, { closeModal: false });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function revokeReports() {
    setError('');
    setSaving(true);
    try {
      await onSave(user.id, { revokeReportsAccess: true }, { closeModal: false });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function openReports() {
    setError('');
    setSaving(true);
    try {
      await onSave(user.id, { canAccessReports: true }, { closeModal: false });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  const reportsActive = hasReportsAccess(user);

  return (
    <Modal open={Boolean(user)} title={t('users.editTitle')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
        <label className="field">
          <span>{t('users.email')}</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>{t('users.name')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </label>
        <label className="field">
          <span>{t('users.role')}</span>
          <RoleSelect value={role} onChange={(e) => setRole(e.target.value)} disabled={isSelf} t={t} />
        </label>
        {role !== 'admin' && (
          <div className="subsection">
            <p className="subsection__title">{t('users.reportsSection')}</p>
            {hasReportsAccess(user) && (
              <p className="form__success">{t('users.reportsUserCanExport')}</p>
            )}
            <label className="settings-toggle">
              <span className="settings-toggle__label">{t('users.reportsToggleLabel')}</span>
              <input
                type="checkbox"
                checked={reportsActive}
                disabled={saving}
                onChange={(e) => (e.target.checked ? openReports() : revokeReports())}
              />
            </label>
            <p className="muted">{formatReportsUntil(user.reportsAccessUntil, t, dateLocale)}</p>
            <div className="button-row">
              <button type="button" className="button button--secondary" disabled={saving || !reportsActive} onClick={extendReports}>
                {t('users.extendReports')}
              </button>
              <button type="button" className="button button--ghost" disabled={saving || !reportsActive} onClick={revokeReports}>
                {t('users.closeReports')}
              </button>
            </div>
          </div>
        )}
        <label className="field">
          <span>{t('users.newPassword')}</span>
          <input
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="••••••••"
          />
          <span className="field__hint">{t('users.passwordOptional')}</span>
        </label>
        <div className="button-row">
          <button type="button" className="button button--ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="button button--primary" disabled={saving}>
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default UsersPage;
