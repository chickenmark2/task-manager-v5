import { useState } from 'react';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, googleProvider } from '../../firebase';

export default function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setError('Googleログインに失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleEmail = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignup) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e) {
      const msgs = {
        'auth/email-already-in-use': 'このメールアドレスは既に使用されています。',
        'auth/wrong-password': 'パスワードが間違っています。',
        'auth/user-not-found': 'アカウントが見つかりません。',
        'auth/weak-password': 'パスワードは6文字以上にしてください。',
        'auth/invalid-email': 'メールアドレスの形式が正しくありません。',
      };
      setError(msgs[e.code] || 'エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'var(--bg)'
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>📚</div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text)' }}>課題管理アプリ</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '6px', fontSize: '14px' }}>
            集中して課題を終わらせよう
          </p>
        </div>

        <div className="card">
          <button
            className="btn btn-outline btn-full"
            onClick={handleGoogle}
            disabled={loading}
            style={{ marginBottom: '20px', fontSize: '15px', padding: '12px' }}
          >
            <GoogleIcon />
            Googleでログイン
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
            color: 'var(--text-muted)',
            fontSize: '13px'
          }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            または
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>

          <form onSubmit={handleEmail}>
            <div className="form-group">
              <label className="form-label">メールアドレス</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">パスワード</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="6文字以上"
                required
              />
            </div>
            {error && (
              <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '12px' }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loading}
              style={{ fontSize: '15px', padding: '12px' }}
            >
              {isSignup ? '新規登録' : 'ログイン'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
            {isSignup ? 'すでにアカウントをお持ちですか？' : 'アカウントをお持ちでないですか？'}
            <button
              style={{ background: 'none', color: 'var(--primary)', fontWeight: '600', marginLeft: '4px', cursor: 'pointer', fontSize: '13px' }}
              onClick={() => { setIsSignup(!isSignup); setError(''); }}
            >
              {isSignup ? 'ログイン' : '新規登録'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.706c-.18-.54-.282-1.117-.282-1.706s.102-1.166.282-1.706V4.962H.957C.347 6.175 0 7.548 0 9s.348 2.825.957 4.038l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 6.294C4.672 4.169 6.656 3.58 9 3.58z"/>
    </svg>
  );
}
