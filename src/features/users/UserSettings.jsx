import React from 'react';
import { Space } from 'antd';
import ChangeNickname from './ChangeNickname';
import ChangePassword from './ChangePassword';
import PermissionSettings from './PermissionSettings';
import { getUser } from '../../utils/auth';

const UserSettings = () => {
  const user = getUser();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginTop: 64,
        gap: 32,
      }}
    >
      <Space direction="vertical" size="large" style={{ width: '100%', maxWidth: 600 }}>
        <ChangeNickname />
        <ChangePassword />
        <PermissionSettings username={user?.username} />
      </Space>
    </div>
  );
};

export default UserSettings;