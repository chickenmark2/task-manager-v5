import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../firebase';
import DarkToggle from '../DarkToggle';

const TYPE_LABELS = {
  report: 'レポート',
  quiz: '確認テスト',
  other: 'その他',
};

const STATUS_LABELS = {
  pending: '未着手',
  in_progress: '進行中',
  completed: '完了',
};

function getDeadlineInfo(deadline) {
  if (!deadline) return null;
  const now = new Date();
  const due = new Date(deadline);
  const diffMs = due - now;
  const diffH = diffMs / (1000 * 60 * 60);
  const diffD = diffMs / (1000 * 60 * 60 * 24);
  const fmt = due.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
  const fmtTime = due.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

  if (diffMs < 0) {
    const days = Math.floor(-diffD);
    return { label: days > 0 ? `期限切れ (${days}日前)` : '期限切れ (今日)', color: 'var(--danger)', bg: '#fee2e2' };
  }
  if (diffH < 24) {
    return { label: `今日 ${fmtTime} まで`, color: '#ea580c', bg: '#ffedd5' };
  }
  if (diffD < 3) {
    const days = Math.floor(diffD);
    return { label: `${days}日後 (${fmt} ${fmtTime})`, color: '#ca8a04', bg: '#fef9c3' };
  }
  return { label: `${fmt} ${fmtTime}`, color: 'var(--text-muted)', bg: 'var(--surface2)' };
}

export default function Dashboard({ user, navigate, darkMode, toggleDark }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created');

  useEffect(() => {
    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error('[Dashboard] Firestoreクエリエラー:', err.code, err.message);
      setLoading(false);
    });
    return unsub;
  }, [user.uid]);

  const handleDelete = async (e, taskId) => {
    e.stopPropagation();
    if (!confirm('この課題を削除しますか？')) return;
    await deleteDoc(doc(db, 'tasks', taskId));
  };

  const handleDeleteAll = async () => {
    if (!confirm(`全${tasks.length}件の課題を削除しますか？この操作は取り消せません。`)) return;
    const batch = writeBatch(db);
    tasks.forEach(t => batch.delete(doc(db, 'tasks', t.id)));
    await batch.commit();
  };

  const filtered = (filter === 'all' ? tasks : tasks.filter(t => t.status === filter))
    .slice()
    .sort((a, b) => {
      if (sortBy === 'deadline') {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      }
      return 0;
    });

  const completedCount = tasks.filter(t => t.status === 'completed').length;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <header className="app-header">
        <div className="container">
          <h1>📚 課題管理</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {user.displayName || user.email?.split('@')[0]}
            </span>
            {tasks.length > 0 && (
              <button
                className="btn btn-sm"
                onClick={handleDeleteAll}
                style={{ background: 'none', border: '1.5px solid #ef4444', color: '#ef4444', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}
              >
                全削除
              </button>
            )}
            <button
              className="btn btn-outline btn-sm"
              onClick={() => signOut(auth)}
            >
              ログアウト
            </button>
            <DarkToggle darkMode={darkMode} toggleDark={toggleDark} />
          </div>
        </div>
      </header>

      <main className="container" style={{ paddingTop: '24px', paddingBottom: '80px' }}>
        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          marginBottom: '24px'
        }}>
          <StatCard label="合計" value={tasks.length} color="var(--primary)" />
          <StatCard label="進行中" value={tasks.filter(t => t.status === 'in_progress').length} color="var(--warning)" />
          <StatCard label="完了" value={completedCount} color="var(--success)" />
        </div>

        {/* Filter tabs */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px',
          overflowX: 'auto',
          paddingBottom: '4px'
        }}>
          {[
            { key: 'all', label: 'すべて' },
            { key: 'pending', label: '未着手' },
            { key: 'in_progress', label: '進行中' },
            { key: 'completed', label: '完了' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '6px 14px',
                borderRadius: '100px',
                fontSize: '13px',
                fontWeight: '600',
                border: '1.5px solid',
                borderColor: filter === f.key ? 'var(--primary)' : 'var(--border)',
                background: filter === f.key ? 'var(--primary-light)' : 'var(--surface)',
                color: filter === f.key ? 'var(--primary-dark)' : 'var(--text-muted)',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>並び替え:</span>
          {[
            { key: 'created', label: '作成日順' },
            { key: 'deadline', label: '締め切り順' },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => setSortBy(s.key)}
              style={{
                padding: '4px 12px',
                borderRadius: '100px',
                fontSize: '12px',
                fontWeight: '600',
                border: '1.5px solid',
                borderColor: sortBy === s.key ? 'var(--primary)' : 'var(--border)',
                background: sortBy === s.key ? 'var(--primary-light)' : 'var(--surface)',
                color: sortBy === s.key ? 'var(--primary-dark)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Task list */}
        {loading ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
            読み込み中...
          </p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <p>課題がありません</p>
            <button className="btn btn-primary" onClick={() => navigate('new-task')}>
              + 課題を追加
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filtered.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => navigate('run-task', task.id)}
                onDelete={(e) => handleDelete(e, task.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* FAB */}
      <button
        className="btn btn-primary"
        onClick={() => navigate('new-task')}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          borderRadius: '100px',
          padding: '14px 22px',
          fontSize: '15px',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        + 新しい課題
      </button>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '14px' }}>
      <div style={{ fontSize: '24px', fontWeight: '700', color }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{label}</div>
    </div>
  );
}

function TaskCard({ task, onClick, onDelete }) {
  const doneSteps = task.steps?.filter(s => s.completed).length ?? 0;
  const totalSteps = task.steps?.length ?? 0;
  const progress = totalSteps > 0 ? (doneSteps / totalSteps) * 100 : 0;
  const deadlineInfo = getDeadlineInfo(task.deadline);

  const statusStyle = task.status === 'completed'
    ? { background: 'var(--status-done-bg)', color: 'var(--status-done-text)' }
    : task.status === 'in_progress'
    ? { background: 'var(--status-wip-bg)', color: 'var(--status-wip-text)' }
    : { background: 'var(--surface2)', color: 'var(--text-muted)' };

  return (
    <div
      className="card"
      onClick={onClick}
      style={{ cursor: 'pointer', transition: 'box-shadow 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow)'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span className={`badge badge-${task.type}`}>
              {TYPE_LABELS[task.type] || task.type}
            </span>
            <span style={{
              fontSize: '12px',
              padding: '2px 8px',
              borderRadius: '100px',
              fontWeight: '600',
              ...statusStyle,
            }}>
              {STATUS_LABELS[task.status]}
            </span>
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.title}
          </h3>
          {deadlineInfo && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: '4px',
              fontSize: '12px',
              fontWeight: '600',
              color: deadlineInfo.color,
              background: deadlineInfo.bg,
              borderRadius: '6px',
              padding: '2px 8px',
            }}>
              🕐 {deadlineInfo.label}
            </div>
          )}
        </div>
        <button
          className="btn btn-sm"
          onClick={onDelete}
          style={{ background: 'none', color: 'var(--text-muted)', padding: '4px 8px', fontSize: '16px', marginLeft: '8px' }}
        >
          ×
        </button>
      </div>

      {totalSteps > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              ステップ {doneSteps}/{totalSteps}
            </span>
            <span style={{ fontSize: '12px', fontWeight: '600', color: progress === 100 ? 'var(--success)' : 'var(--primary)' }}>
              {Math.round(progress)}%
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%`, background: progress === 100 ? 'var(--success)' : 'var(--primary)' }} />
          </div>
        </div>
      )}

      {task.description && (
        <p style={{ marginTop: '10px', fontSize: '13px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {task.description}
        </p>
      )}
    </div>
  );
}
