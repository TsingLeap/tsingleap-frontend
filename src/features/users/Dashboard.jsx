import React from 'react';
import { message, Card } from 'antd';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../utils/auth';
import UserSettings from './UserSettings';

const Dashboard = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    logout(navigate);
    message.success('已退出登录');
  };

  return (
    <div style={{ padding: '2rem' }}>
      <Card style={{ marginTop: '1rem', maxWidth: 700, marginLeft: 'auto', marginRight: 'auto' }}>
        <UserSettings />
      </Card>
    </div>
  );
};

export default Dashboard;