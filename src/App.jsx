import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Register from './features/users/Register';
import Login from './features/users/Login';
import Dashboard from './features/users/Dashboard';
import NavBar from './components/NavBar';
import UserSettings from './features/users/UserSettings';
import Forum from './features/forum/Forum';
import MatchList from './features/matches/MatchList';
import { getUser } from './utils/auth';
import TagManage from './features/tags/TagManage';
import ForumManage from './features/forum/ForumManage';

// --- PrivateRoute  ---
const PrivateRoute = ({ children }) => {
  const user = getUser();
  return user ? children : <Navigate to="/login" replace />;
};

// --- 404 page ---
function NotFound() {
  const user = getUser();
  return <Navigate to={user ? '/matches' : '/login'} replace />;
}

function App() {
  const [user, setUser] = useState(getUser());
  useEffect(() => {
    const syncUser = () => setUser(getUser());
    window.addEventListener('storage', syncUser);
    window.addEventListener('focus', syncUser);
    return () => {
        window.removeEventListener('storage', syncUser);
        window.removeEventListener('focus', syncUser);
    };
  }, []);

  return (
    <Router>
      <NavBar />
      <Routes>
        <Route path="/" element={<Navigate to={user ? '/matches' : '/login'} replace />} />
        <Route path="/login" element={user ? <Navigate to="/matches" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/matches" replace /> : <Register />} />

        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/forum" element={<PrivateRoute><Forum /></PrivateRoute>} />
        <Route path="/matches" element={<PrivateRoute><MatchList /></PrivateRoute>} />
        
        <Route path="/tag-manage"   element={<PrivateRoute><TagManage /></PrivateRoute>} />
        <Route path="/forum-manage" element={<PrivateRoute><ForumManage /></PrivateRoute>} />


        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;