import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import DarkToggle from '../DarkToggle';

const TASK_TYPES = [
  { value: 'report', label: 'レポート' },
  { value: 'quiz', label: '確認テスト' },
  { value: 'other', label: 'その他' },
];

export default function TaskForm({ user, navigate, darkMode, toggleDark }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('report');
  const [description, setDescription] = useState('');
  const [rewardMinutes, setRewardMinutes] = useState(10);
  const [deadline, setDeadline] = useState('');
  const [steps, setSteps] = useState([{ id: Date.now(), title: '', description: '' }]);
  const [saving, setSaving] = useState(false);

  const addStep = () => {
    setSteps([...steps, { id: Date.now(), title: '', description: '' }]);
  };

  const removeStep = (id) => {
    setSteps(steps.filter(s => s.id !== id));
  };

  const updateStep = (id, field, value) => {
    setSteps(steps.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const moveStep = (index, dir) => {
    const next = [...steps];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setSteps(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const validSteps = steps.filter(s => s.title.trim());

    setSaving(true);
    try {
      await addDoc(collection(db, 'tasks'), {
        userId: user.uid,
        title: title.trim(),
        type,
        description: description.trim(),
        rewardMinutes,
        deadline: deadline || null,
        steps: validSteps.map(s => ({
          id: s.id,
          title: s.title.trim(),
          description: s.description.trim(),
          completed: false,
        })),
        status: 'pending',
        currentStepIndex: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      navigate('dashboard');
    } catch (e) {
      alert('保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <header className="app-header">
        <div className="container">
          <button className="btn btn-outline btn-sm" onClick={() => navigate('dashboard')}>
            ← 戻る
          </button>
          <h1 style={{ fontSize: '16px' }}>新しい課題</h1>
          <DarkToggle darkMode={darkMode} toggleDark={toggleDark} />
        </div>
      </header>

      <main className="container" style={{ paddingTop: '24px', paddingBottom: '40px' }}>
        <form onSubmit={handleSubmit}>
          {/* Basic info */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              基本情報
            </h2>
            <div className="form-group">
              <label className="form-label">課題タイトル *</label>
              <input
                type="text"
                className="form-input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="例: 数学のレポート"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">種類 *</label>
              <select
                className="form-select"
                value={type}
                onChange={e => setType(e.target.value)}
              >
                {TASK_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">締め切り日時 (任意)</label>
              <input
                type="datetime-local"
                className="form-input"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">メモ (任意)</label>
              <textarea
                className="form-textarea"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="課題の概要や注意点など..."
              />
            </div>
          </div>

          {/* Reward setting */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ご褒美タイム
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              ステップを完了するたびに休憩できる時間
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <input
                type="range"
                min="1"
                max="30"
                value={rewardMinutes}
                onChange={e => setRewardMinutes(Number(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--primary)' }}
              />
              <span style={{
                fontSize: '20px',
                fontWeight: '700',
                color: 'var(--primary)',
                minWidth: '60px',
                textAlign: 'right'
              }}>
                {rewardMinutes}分
              </span>
            </div>
          </div>

          {/* Steps */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ステップ
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  課題を小さな手順に分割する (任意)
                </p>
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={addStep}>
                + 追加
              </button>
            </div>

            {steps.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                ステップなし — 「+ 追加」で追加できます
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {steps.map((step, i) => (
                  <div
                    key={step.id}
                    style={{
                      border: '1.5px solid var(--border)',
                      borderRadius: '10px',
                      padding: '14px',
                      background: 'var(--surface2)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <span style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: 'var(--primary)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: '700',
                        flexShrink: 0,
                      }}>
                        {i + 1}
                      </span>
                      <span style={{ flex: 1, fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}>
                        ステップ {i + 1}
                      </span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button type="button" className="btn btn-sm" style={{ background: 'none', padding: '2px 6px', fontSize: '14px', color: 'var(--text-muted)' }} onClick={() => moveStep(i, -1)} disabled={i === 0}>↑</button>
                        <button type="button" className="btn btn-sm" style={{ background: 'none', padding: '2px 6px', fontSize: '14px', color: 'var(--text-muted)' }} onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1}>↓</button>
                        <button type="button" className="btn btn-sm" style={{ background: 'none', padding: '2px 6px', fontSize: '16px', color: 'var(--danger)' }} onClick={() => removeStep(step.id)}>×</button>
                      </div>
                    </div>
                    <input
                      type="text"
                      className="form-input"
                      value={step.title}
                      onChange={e => updateStep(step.id, 'title', e.target.value)}
                      placeholder={`ステップ${i + 1}のタイトル`}
                      style={{ marginBottom: '8px', background: 'var(--surface)' }}
                    />
                    <textarea
                      className="form-textarea"
                      value={step.description}
                      onChange={e => updateStep(step.id, 'description', e.target.value)}
                      placeholder="詳細 (任意)"
                      style={{ minHeight: '60px', background: 'var(--surface)' }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={saving || !title.trim()}
            style={{ padding: '14px', fontSize: '16px' }}
          >
            {saving ? '保存中...' : '課題を作成する'}
          </button>
        </form>
      </main>
    </div>
  );
}
