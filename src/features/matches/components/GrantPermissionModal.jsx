import React, { useState, useEffect } from 'react';
import { Modal, Space, AutoComplete, Button, message, Typography, Alert } from 'antd';
import { TeamOutlined } from '@ant-design/icons';
import { searchUsernamePrefix, userAddPermission } from '../../../services/api';
import { getUser } from '../../../utils/auth';

const { Text, Paragraph } = Typography;

const GrantPermissionModal = ({ visible, match, onGrantSuccess, onCancel }) => {
  const [selectedUser, setSelectedUser] = useState(null); // { label, value }
  const [options, setOptions] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const currentUser = getUser();

  // Clear state when modal becomes hidden or match changes
  useEffect(() => {
    if (!visible) {
      setSelectedUser(null);
      setOptions([]);
      setSearchTerm('');
      setSubmitting(false);
    }
  }, [visible]);

  const handleSearch = async (value) => {
    setSearchTerm(value); // Update input value
    if (!value) {
      setOptions([]);
      setSelectedUser(null); // Clear selection if search is cleared
      return;
    }
    try {
      const res = await searchUsernamePrefix(value);
      if (res.code === 0 && res.data?.users) {
        setOptions(
          res.data.users
            .filter(user => user.username !== currentUser.username) // Exclude the current user
            .map((user) => ({
              label: `${user.nickname || user.username} (${user.username})`,
              value: user.username,
            }))
        );
      } else {
        setOptions([]); // Clear options if API fails or returns no users
      }
    } catch (error) {
      console.error('Search user failed:', error);
      setOptions([]);
    }
  };

  const handleSelect = (value, option) => {
    setSelectedUser(option);
    setSearchTerm(option.label); // Display selection in input
  };

  const handleGrant = async () => {
    if (!selectedUser || !match) {
      message.warning('请先搜索并选择一个用户');
      return;
    }
    setSubmitting(true);
    try {
      const res = await userAddPermission({
        operator: currentUser.username,
        username: selectedUser.value,
        permission_name: 'match.update_match_info',
        permission_info: String(match.id),
      });
      if (res.code === 0) {
        message.success(`成功授予用户 ${selectedUser.label} 更新赛事 ${match.name} 比分/状态的权限`);
        if(onGrantSuccess) {
           onGrantSuccess(selectedUser); // Pass back selected user info if needed
        }
        onCancel(); // Close modal on success
      } else {
        message.error(`授权失败: ${res.msg || `错误码 ${res.code}`}`);
      }
    } catch (error) {
      message.error('网络错误，授权失败');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle input change, clear selection if text doesn't match label
  const handleChange = (value) => {
    setSearchTerm(value);
    if (selectedUser && value !== selectedUser.label) {
        setSelectedUser(null); // Clear selection if user types something else
    }
  };

  return (
    <Modal
      title={`授予比分更新权限: ${match?.name ?? ''}`}
      open={visible}
      onCancel={onCancel}
      onOk={handleGrant}
      confirmLoading={submitting}
      okText="授予权限"
      cancelText="取消"
      maskClosable={!submitting}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text>
          将为赛事 <Text strong>{match?.name}</Text> (ID: {match?.id})
          授予 <Text code>match.update_match_info</Text> 权限给单个用户。
        </Text>
        <Alert message="该权限允许用户更新此赛事的比分和结束状态。" type="info" showIcon style={{ marginBottom: 8 }}/>
        <Paragraph type="secondary">如需查看或移除已有权限的用户，请使用卡片上的 <TeamOutlined /> "管理比分更新权限用户" 功能。</Paragraph>
        <AutoComplete
          value={searchTerm} // Controlled input
          options={options}
          style={{ width: '100%' }}
          onSelect={handleSelect}
          onSearch={handleSearch}
          onChange={handleChange} // Use handleChange to manage input state
          placeholder="搜索用户名或昵称以授予权限"
          allowClear
        />
        {selectedUser && (
          <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
            已选择用户: {selectedUser.label}
          </Text>
        )}
      </Space>
    </Modal>
  );
};

export default GrantPermissionModal;
