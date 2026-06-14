import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Login from './components/Auth/Login';
import Dashboard from './components/Dashboard/Dashboard';
import TaskForm from './components/Task/TaskForm';
import TaskRunner from './components/Task/TaskRunner';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('dashboard');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('darkMode') === 'true'
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  const toggleDark = () => setDarkMode(d => !d);

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!user) return <Login />;

  const navigate = (p, taskId = null) => {
    setPage(p);
    setSelectedTaskId(taskId);
  };

  return (
    <>
      {page === 'dashboard' && (
        <Dashboard user={user} navigate={navigate} darkMode={darkMode} toggleDark={toggleDark} />
      )}
      {page === 'new-task' && (
        <TaskForm user={user} navigate={navigate} darkMode={darkMode} toggleDark={toggleDark} />
      )}
      {page === 'run-task' && (
        <TaskRunner taskId={selectedTaskId} user={user} navigate={navigate} darkMode={darkMode} toggleDark={toggleDark} />
      )}
    </>
  );
}
