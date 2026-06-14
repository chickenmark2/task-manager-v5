import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import DarkToggle from '../DarkToggle';

const TIMER_MODES = {
  pomodoro: { focus: 25 * 60, break: 5 * 60, label: 'ポモドーロ', detail: '25分集中 · 5分休憩' },
  '5217': { focus: 52 * 60, break: 17 * 60, label: '52/17ルール', detail: '52分集中 · 17分休憩' },
};

const fmt = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export default function TaskRunner({ taskId, navigate, darkMode, toggleDark }) {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [focusActive, setFocusActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Timer state
  const [timerMode, setTimerMode] = useState(null); // 'pomodoro' | '5217'
  const [timerPhase, setTimerPhase] = useState('idle'); // 'idle' | 'focus' | 'break'
  const [timerSecs, setTimerSecs] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'tasks', taskId), (snap) => {
      if (!snap.exists()) { navigate('dashboard'); return; }
      const data = { id: snap.id, ...snap.data() };
      setTask(data);
      setCurrentStep(data.currentStepIndex ?? 0);
      setLoading(false);
    });
    return unsub;
  }, [taskId, navigate]);

  // Timer engine: restarts whenever focusActive, timerPhase, or timerMode changes
  useEffect(() => {
    if (!focusActive || timerPhase === 'idle' || !timerMode) return;

    const totalSecs = TIMER_MODES[timerMode][timerPhase];
    setTimerSecs(totalSecs);

    let remaining = totalSecs;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        setTimerSecs(0);
        setTimerPhase(p => p === 'focus' ? 'break' : 'focus');
      } else {
        setTimerSecs(remaining);
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [focusActive, timerPhase, timerMode]);

  // Cleanup on unmount
  useEffect(() => () => clearInterval(timerRef.current), []);

  const startFocus = useCallback(async () => {
    try { await document.documentElement.requestFullscreen?.(); } catch {}
    setFocusActive(true);
    setTimerMode(null);
    setTimerPhase('idle');
    if (task?.status === 'pending') {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'in_progress',
        updatedAt: serverTimestamp(),
      });
    }
  }, [task, taskId]);

  const exitFocus = useCallback(async () => {
    clearInterval(timerRef.current);
    setFocusActive(false);
    setTimerMode(null);
    setTimerPhase('idle');
    setTimerSecs(0);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {}
  }, []);

  const selectMode = useCallback((mode) => {
    setTimerMode(mode);
    setTimerPhase('focus');
  }, []);

  const completeStep = useCallback(async () => {
    if (!task) return;
    const steps = task.steps.map((s, i) =>
      i === currentStep ? { ...s, completed: true } : s
    );
    const nextStep = currentStep + 1;
    const allDone = nextStep >= steps.length;

    await updateDoc(doc(db, 'tasks', taskId), {
      steps,
      currentStepIndex: allDone ? currentStep : nextStep,
      status: allDone ? 'completed' : 'in_progress',
      updatedAt: serverTimestamp(),
    });

    if (allDone) {
      exitFocus();
      return;
    }

    setCurrentStep(nextStep);
    clearInterval(timerRef.current);
    setTimerPhase('break');
  }, [task, taskId, currentStep, exitFocus]);

  const completeTask = useCallback(async () => {
    await updateDoc(doc(db, 'tasks', taskId), {
      status: 'completed',
      updatedAt: serverTimestamp(),
    });
    exitFocus();
  }, [taskId, exitFocus]);

  const skipBreak = useCallback(() => {
    clearInterval(timerRef.current);
    setTimerPhase('focus');
  }, []);

  const handleDelete = async () => {
    if (!confirm('この課題を削除しますか？')) return;
    await deleteDoc(doc(db, 'tasks', taskId));
    navigate('dashboard');
  };

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!task) return null;

  const steps = task.steps ?? [];
  const step = steps[currentStep];
  const doneCount = steps.filter(s => s.completed).length;
  const progress = steps.length > 0 ? (doneCount / steps.length) * 100 : 0;
  const allCompleted = task.status === 'completed';

  const statusStyle = allCompleted
    ? { background: 'var(--status-done-bg)', color: 'var(--status-done-text)' }
    : task.status === 'in_progress'
    ? { background: 'var(--status-wip-bg)', color: 'var(--status-wip-text)' }
    : { background: 'var(--surface2)', color: 'var(--text-muted)' };

  if (focusActive) {
    return (
      <FocusOverlay
        task={task}
        step={step}
        currentStep={currentStep}
        totalSteps={steps.length}
        doneCount={doneCount}
        progress={progress}
        allCompleted={allCompleted}
        timerMode={timerMode}
        timerPhase={timerPhase}
        timerSecs={timerSecs}
        onSelectMode={selectMode}
        onCompleteStep={completeStep}
        onCompleteTask={completeTask}
        onSkipBreak={skipBreak}
        onExit={exitFocus}
      />
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <header className="app-header">
        <div className="container">
          <button className="btn btn-outline btn-sm" onClick={() => navigate('dashboard')}>
            ← 戻る
          </button>
          <h1 style={{ fontSize: '16px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.title}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn btn-sm"
              onClick={handleDelete}
              style={{ color: 'var(--danger)', background: 'none', fontSize: '13px', fontWeight: '600' }}
            >
              削除
            </button>
            <DarkToggle darkMode={darkMode} toggleDark={toggleDark} />
          </div>
        </div>
      </header>

      <main className="container" style={{ paddingTop: '24px', paddingBottom: '40px' }}>
        {/* Task info */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <TypeBadge type={task.type} />
            <span style={{
              fontSize: '12px', padding: '3px 10px', borderRadius: '100px', fontWeight: '600',
              ...statusStyle,
            }}>
              {allCompleted ? '完了' : task.status === 'in_progress' ? '進行中' : '未着手'}
            </span>
          </div>
          {task.description && (
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              {task.description}
            </p>
          )}
          {steps.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>進捗 {doneCount}/{steps.length}</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: progress === 100 ? 'var(--success)' : 'var(--primary)' }}>
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%`, background: progress === 100 ? 'var(--success)' : undefined }} />
              </div>
            </div>
          )}
        </div>

        {/* Steps list */}
        {steps.length > 0 && (
          <div className="card" style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
              ステップ一覧
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {steps.map((s, i) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px',
                    borderRadius: '8px',
                    background: s.completed ? 'var(--step-done-bg)' : i === currentStep && !allCompleted ? 'var(--primary-light)' : 'var(--surface2)',
                    border: '1.5px solid',
                    borderColor: s.completed ? 'var(--step-done-border)' : i === currentStep && !allCompleted ? 'var(--primary)' : 'transparent',
                    opacity: s.completed ? 0.7 : 1,
                  }}
                >
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: s.completed ? 'var(--success)' : i === currentStep && !allCompleted ? 'var(--primary)' : 'var(--border)',
                    color: s.completed || (i === currentStep && !allCompleted) ? 'white' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: '700',
                    flexShrink: 0,
                  }}>
                    {s.completed ? '✓' : i + 1}
                  </div>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: '600', textDecoration: s.completed ? 'line-through' : 'none', color: 'var(--text)' }}>
                      {s.title}
                    </p>
                    {s.description && (
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {s.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action button */}
        {allCompleted ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎉</div>
            <p style={{ fontWeight: '700', fontSize: '18px', marginBottom: '6px', color: 'var(--text)' }}>課題完了！</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>お疲れ様でした。</p>
            <button className="btn btn-outline" onClick={() => navigate('dashboard')}>
              ダッシュボードへ
            </button>
          </div>
        ) : (
          <button
            className="btn btn-primary btn-full"
            onClick={startFocus}
            style={{ padding: '16px', fontSize: '16px', borderRadius: '12px' }}
          >
            🎯 集中モードで始める
          </button>
        )}
      </main>
    </div>
  );
}

function FocusOverlay({
  task, step, currentStep, totalSteps, doneCount, progress, allCompleted,
  timerMode, timerPhase, timerSecs,
  onSelectMode, onCompleteStep, onCompleteTask, onSkipBreak, onExit,
}) {
  const focusTotal = timerMode ? TIMER_MODES[timerMode].focus : 1;
  const breakTotal = timerMode ? TIMER_MODES[timerMode].break : 1;
  const C = 2 * Math.PI * 70;
  const elapsedPct = timerPhase === 'focus'
    ? (1 - timerSecs / focusTotal) * 100
    : timerPhase === 'break'
    ? (1 - timerSecs / breakTotal) * 100
    : 0;
  const strokeOffset = C * (1 - elapsedPct / 100);

  const bgColor = timerPhase === 'break'
    ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
    : 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: bgColor,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      color: 'white',
      transition: 'background 0.5s',
    }}>
      {/* Exit button */}
      <button
        onClick={onExit}
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          background: 'rgba(255,255,255,0.15)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          padding: '8px 14px',
          fontSize: '13px',
          fontWeight: '600',
          cursor: 'pointer',
        }}
      >
        終了
      </button>

      {/* Top progress bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'rgba(255,255,255,0.15)' }}>
        <div style={{ height: '100%', background: timerPhase === 'break' ? '#22c55e' : '#818cf8', width: `${progress}%`, transition: 'width 0.5s' }} />
      </div>

      <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
        {/* Mode selection */}
        {timerPhase === 'idle' && (
          <ModeSelection onSelectMode={onSelectMode} />
        )}

        {/* All completed */}
        {allCompleted && timerPhase !== 'idle' && (
          <>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
            <h2 style={{ fontSize: '26px', fontWeight: '700', marginBottom: '8px' }}>すべて完了！</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '32px' }}>お疲れ様でした！</p>
            <button className="btn btn-success" onClick={onExit} style={{ fontSize: '16px', padding: '14px 32px', borderRadius: '12px' }}>
              終わる
            </button>
          </>
        )}

        {/* Break phase */}
        {!allCompleted && timerPhase === 'break' && (
          <BreakView
            timerSecs={timerSecs}
            C={C}
            strokeOffset={strokeOffset}
            currentStep={currentStep}
            totalSteps={totalSteps}
            step={step}
            onSkipBreak={onSkipBreak}
            timerMode={timerMode}
          />
        )}

        {/* Focus phase */}
        {!allCompleted && timerPhase === 'focus' && (
          <FocusView
            step={step}
            currentStep={currentStep}
            totalSteps={totalSteps}
            timerSecs={timerSecs}
            C={C}
            strokeOffset={strokeOffset}
            onCompleteStep={totalSteps === 0 ? onCompleteTask : onCompleteStep}
            timerMode={timerMode}
            taskTitle={task.title}
          />
        )}
      </div>
    </div>
  );
}

function ModeSelection({ onSelectMode }) {
  return (
    <>
      <div style={{ fontSize: '40px', marginBottom: '20px' }}>⏱️</div>
      <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>タイマーモードを選択</h2>
      <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '14px', marginBottom: '32px' }}>
        集中と休憩のリズムを選んでください
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {Object.entries(TIMER_MODES).map(([key, mode]) => (
          <button
            key={key}
            onClick={() => onSelectMode(key)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1.5px solid rgba(255,255,255,0.25)',
              borderRadius: '14px',
              padding: '18px 24px',
              color: 'white',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          >
            <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>{mode.label}</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>{mode.detail}</div>
          </button>
        ))}
      </div>
    </>
  );
}

function TimerRing({ C, strokeOffset, color, children }) {
  return (
    <div style={{ position: 'relative', width: '160px', height: '160px', margin: '0 auto 24px' }}>
      <svg width="160" height="160" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
        <circle
          cx="80" cy="80" r="70"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${C}`}
          strokeDashoffset={`${strokeOffset}`}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  );
}

function FocusView({ step, currentStep, totalSteps, timerSecs, C, strokeOffset, onCompleteStep, timerMode, taskTitle }) {
  return (
    <>
      <div style={{
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '8px',
        padding: '6px 16px',
        display: 'inline-block',
        fontSize: '13px',
        color: 'rgba(255,255,255,0.7)',
        marginBottom: '20px',
      }}>
        {totalSteps > 0 ? `ステップ ${currentStep + 1} / ${totalSteps}` : '集中モード'}
        {timerMode && (
          <span style={{ marginLeft: '8px', opacity: 0.7 }}>
            · {TIMER_MODES[timerMode].label}
          </span>
        )}
      </div>

      <TimerRing C={C} strokeOffset={strokeOffset} color="#818cf8">
        <span style={{ fontSize: '28px', fontWeight: '700' }}>{fmt(timerSecs)}</span>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>集中中</span>
      </TimerRing>

      <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎯</div>
      <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px', lineHeight: 1.3 }}>
        {totalSteps > 0 ? step?.title : taskTitle}
      </h2>
      {step?.description && (
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', marginBottom: '20px', lineHeight: 1.6 }}>
          {step.description}
        </p>
      )}

      {totalSteps > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '28px' }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              style={{
                width: i === currentStep ? '24px' : '8px',
                height: '8px',
                borderRadius: '100px',
                background: i < currentStep ? '#22c55e' : i === currentStep ? '#818cf8' : 'rgba(255,255,255,0.2)',
                transition: 'all 0.3s',
              }}
            />
          ))}
        </div>
      )}

      <button
        className="btn btn-success"
        onClick={onCompleteStep}
        style={{
          fontSize: '16px',
          padding: '14px 36px',
          borderRadius: '14px',
          boxShadow: '0 4px 20px rgba(34,197,94,0.4)',
        }}
      >
        {totalSteps === 0 ? '✓ タスクを完了' : '✓ このステップを完了'}
      </button>
      <p style={{ marginTop: '12px', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
        完了すると休憩タイムになります
      </p>
    </>
  );
}

function BreakView({ timerSecs, C, strokeOffset, currentStep, totalSteps, step, onSkipBreak, timerMode }) {
  return (
    <>
      <div style={{ fontSize: '40px', marginBottom: '16px' }}>☕</div>
      <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>休憩タイム！</h2>
      <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', marginBottom: '24px' }}>
        {timerMode && TIMER_MODES[timerMode].label} · リラックスしましょう
      </p>

      <TimerRing C={C} strokeOffset={strokeOffset} color="#22c55e">
        <span style={{ fontSize: '28px', fontWeight: '700' }}>{fmt(timerSecs)}</span>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>残り時間</span>
      </TimerRing>

      {totalSteps > 0 && step && (
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginBottom: '20px' }}>
          次: ステップ {currentStep + 1}/{totalSteps} — {step.title}
        </p>
      )}

      <button
        onClick={onSkipBreak}
        style={{
          background: 'rgba(255,255,255,0.15)',
          color: 'white',
          border: '1.5px solid rgba(255,255,255,0.3)',
          borderRadius: '10px',
          padding: '10px 24px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
        }}
      >
        スキップして集中を続ける
      </button>
    </>
  );
}

function TypeBadge({ type }) {
  const map = { report: ['badge-report', 'レポート'], quiz: ['badge-quiz', '確認テスト'], other: ['badge-other', 'その他'] };
  const [cls, label] = map[type] ?? ['badge-other', type];
  return <span className={`badge ${cls}`}>{label}</span>;
}
