import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Card, List, Button, AutoComplete, message, Spin, Space, Typography } from 'antd';
import { UserAddOutlined, UserDeleteOutlined } from '@ant-design/icons';
import { getMatchAdminList, searchUsernamePrefix, userAddPermission, userRemovePermission } from '../../../services/api';
import { getUser } from '../../../utils/auth';

const { Text } = Typography;

const ManageUpdatersModal = ({ visible, match, onCancel }) => {
  const [updaters, setUpdaters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addOptions, setAddOptions] = useState([]);
  const [addSearchTerm, setAddSearchTerm] = useState('');
  const [selectedUserToAdd, setSelectedUserToAdd] = useState(null); // { label, value }
  const [adding, setAdding] = useState(false);
  const [removingUsername, setRemovingUsername] = useState(null);
  const currentUser = getUser();

  // Fetch updaters when modal becomes visible or match changes
  const fetchUpdaters = useCallback(async () => {
    if (!visible || !match?.id) {
      setUpdaters([]); // Clear if not visible or no match ID
      return;
    }
    setLoading(true);
    try {
      // Ensure getMatchAdminList exists and returns expected format
      // Assuming { code: 0, data: { users: [{ username, nickname }, ...] } }
      const res = await getMatchAdminList(match.id);
      if (res.code === 0) {
        setUpdaters(res.data?.users || []);
      } else {
        message.error(res.msg || '无法加载更新者列表');
        setUpdaters([]);
      }
    } catch (error) {
      message.error('网络错误，无法加载更新者列表');
      setUpdaters([]);
    } finally {
      setLoading(false);
    }
  }, [visible, match?.id]); // Depend on visibility and match ID

  useEffect(() => {
    fetchUpdaters();
  }, [fetchUpdaters]); // Run fetcher when it changes (due to dependencies)

  // --- Add Updater Logic ---
  const handleSearchToAdd = async (value) => {
    setAddSearchTerm(value);
    if (!value) {
      setAddOptions([]);
      setSelectedUserToAdd(null); // Clear selection
      return;
    }
    try {
      const res = await searchUsernamePrefix(value);
      if (res.code === 0 && res.data?.users) {
        const currentUpdaterUsernames = new Set(updaters.map(u => u.username));
        const filteredOptions = res.data.users
          .filter(user => user.username !== currentUser.username && !currentUpdaterUsernames.has(user.username)) // Exclude self and existing updaters
          .map(user => ({
            label: `${user.nickname || user.username} (${user.username})`,
            value: user.username,
          }));
        setAddOptions(filteredOptions);
      } else {
        setAddOptions([]);
      }
    } catch (error) {
      console.error('Search user to add failed:', error);
      setAddOptions([]);
    }
  };

  const handleSelectToAdd = (value, option) => {
    setSelectedUserToAdd(option);
    setAddSearchTerm(option.label); // Show selection in input
  };

  const handleAdd = async () => {
    if (!selectedUserToAdd || !match) return;
    setAdding(true);
    try {
      const res = await userAddPermission({
        operator: currentUser.username,
        username: selectedUserToAdd.value,
        permission_name: 'match.update_match_info',
        permission_info: String(match.id),
      });
      if (res.code === 0) {
        message.success(`成功添加用户 ${selectedUserToAdd.label} 为更新者`);
        // Add locally and clear search
        const approxNickname = selectedUserToAdd.label.split(' (')[0];
        setUpdaters(prev => [...prev, { username: selectedUserToAdd.value, nickname: approxNickname }]);
        setSelectedUserToAdd(null);
        setAddSearchTerm('');
        setAddOptions([]);
      } else {
        message.error(`添加失败: ${res.msg || res.code}`);
      }
    } catch (error) {
      message.error('网络错误，添加权限失败');
    } finally {
      setAdding(false);
    }
  };

  // Handle input change, clear selection if text doesn't match label
  const handleAddChange = (value) => {
      setAddSearchTerm(value);
      if (selectedUserToAdd && value !== selectedUserToAdd.label) {
          setSelectedUserToAdd(null); // Clear selection if user types something else
      }
  };

  // --- Remove Updater Logic ---
  const handleRemove = async (usernameToRemove) => {
    if (!match) return;
    setRemovingUsername(usernameToRemove);
    try {
      const res = await userRemovePermission({
        operator: currentUser.username,
        username: usernameToRemove,
        permission_name: 'match.update_match_info',
        permission_info: String(match.id),
      });
      if (res.code === 0) {
        message.success(`成功移除用户 ${usernameToRemove} 的更新权限`);
        setUpdaters(prev => prev.filter(u => u.username !== usernameToRemove)); // Update list locally
      } else {
        message.error(`移除失败: ${res.msg || res.code}`);
      }
    } catch (error) {
      message.error('网络错误，移除权限失败');
    } finally {
      setRemovingUsername(null);
    }
  };

  return (
    <Modal
      title={`管理赛事比分更新者: ${match?.name ?? ''} (ID: ${match?.id})`}
      open={visible}
      onCancel={onCancel}
      footer={[<Button key="close" onClick={onCancel}> 关闭 </Button>]}
      width={600}
      destroyOnClose // Reset states inside when closed
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Add Updater Section */}
        <Card size="small" title="添加更新者">
          <Space.Compact style={{ width: '100%' }}>
            <AutoComplete
              value={addSearchTerm} // Controlled input
              options={addOptions}
              style={{ width: 'calc(100% - 100px)' }}
              onSelect={handleSelectToAdd}
              onSearch={handleSearchToAdd}
              onChange={handleAddChange} // Use handleChange
              placeholder="搜索用户添加 (用户名或昵称)"
              allowClear
            />
            <Button
              type="primary"
              onClick={handleAdd}
              loading={adding}
              disabled={!selectedUserToAdd}
              icon={<UserAddOutlined />}
            >
              添加
            </Button>
          </Space.Compact>
          {selectedUserToAdd && (
            <Text type="secondary" style={{ display: 'block', marginTop: '8px' }}>
              准备添加: {selectedUserToAdd.label}
            </Text>
          )}
        </Card>

        {/* List Current Updaters Section */}
        <Card size="small" title="当前有权限的用户 (可更新比分/状态)">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}><Spin /></div>
          ) : updaters.length === 0 ? (
            <Text type="secondary">尚无用户被授予此赛事的特定更新权限。</Text>
          ) : (
            <List
              itemLayout="horizontal"
              dataSource={updaters}
              renderItem={(user) => (
                <List.Item
                  actions={[
                    <Button
                      type="text" danger size="small" icon={<UserDeleteOutlined />}
                      onClick={() => handleRemove(user.username)}
                      loading={removingUsername === user.username}
                      key={`remove-${user.username}`}
                      disabled={removingUsername === user.username} // Disable while removing this specific user
                    >
                      移除权限
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={user.nickname || user.username}
                    description={`用户名: ${user.username}`}
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
      </Space>
    </Modal>
  );
};

export default ManageUpdatersModal;