import React, { useEffect, useState, useCallback } from 'react'; // Import useCallback
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  message,
  Space,
  Select,
  AutoComplete,
  Typography,
  InputNumber
} from 'antd';
import {
  getUserPermissionInfo,
  userAddPermission,
  userRemovePermission,
  searchUsernamePrefix,
  getCompetitionInfo,
} from '../../services/api';
import { getUser } from '../../utils/auth';

const { Text } = Typography;

const PERMISSION_MAP = {
  'forum.manage_forum': '管理论坛',
  'forum.post': '发帖',
  'forum.post_highlight': '精华帖',
  'match.manage_match': '管理赛事 (全局)',
  'match.update_match_info': '更新特定赛事信息 (需赛事ID)',
  'tag.manage_tag': '管理标签',
  'user.is_superadmin': '超级管理员',
};

const PERMISSION_OPTIONS = Object.entries(PERMISSION_MAP)
  .filter(([value]) => value !== 'user.is_superadmin')
  .map(([value, label]) => ({
    value,
    label,
  }));

const PermissionSettings = () => {
  const [form] = Form.useForm();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [autocompleteOptions, setAutocompleteOptions] = useState([]);
  const currentUser = getUser();
  // State to track the selected permission in the modal's dropdown
  const [selectedPermission, setSelectedPermission] = useState(null);

  // --- Fetch Permissions ---
  const fetchPermissions = useCallback(async (targetUsername) => { // Wrap in useCallback
     if (!targetUsername) {
       setData([]);
       return;
     };
     setLoading(true);
     try {
       const res = await getUserPermissionInfo(targetUsername);
       if (res.code === 0) {
         setData((res.data || []).map((p, index) => ({
           ...p,
           key: `${p.username}-${p.permission_name}-${p.permission_info}-${index}`
         })));
       } else {
         message.error(`获取用户 ${targetUsername} 权限失败: ${res.msg || res.code}`);
         setData([]);
       }
     } catch {
       message.error('网络错误，获取权限失败');
       setData([]);
     } finally {
       setLoading(false);
     }
  }, []); // fetchPermissions itself doesn't depend on changing state/props

  // --- Check Admin Status ---
  const checkAdmin = useCallback(async () => { // Wrap in useCallback
     if (!currentUser?.username) return;
     // Removed setLoading(true) here as fetchPermissions will handle it
     // setLoading(true);
     try {
       const res = await getUserPermissionInfo(currentUser.username);
       if (res.code === 0) {
         const perms = (res.data || []).map(p => p.permission_name);
         const admin = perms.includes('user.is_superadmin');
         setIsAdmin(admin);
         const defaultUser = admin ? '' : currentUser.username;
         // Setting searchUser will trigger the useEffect below to fetch permissions
         setSearchUser(defaultUser);
       } else {
         message.error(`无法检查您的管理员状态: ${res.msg || res.code}`);
         setIsAdmin(false);
         setSearchUser(currentUser.username); // Default to self on error
       }
     } catch (error) {
       message.error('网络错误，无法获取您的权限信息');
       setIsAdmin(false);
       setSearchUser(currentUser.username); // Default to self on error
     }
     // finally { setLoading(false); } // setLoading handled by fetchPermissions trigger
  // Depend on currentUser?.username as it might change if login/logout happens elsewhere
  }, [currentUser?.username]);

  // --- Effects ---
  useEffect(() => {
    checkAdmin();
  }, [checkAdmin]); // Depend on the stable checkAdmin function

  // Re-fetch permissions whenever the target user changes
  useEffect(() => {
    if (searchUser) {
        fetchPermissions(searchUser);
    } else {
        setData([]); // Clear table if admin clears search
    }
    // Depend on searchUser and the stable fetchPermissions function
  }, [searchUser, fetchPermissions]);

  // --- Username Search Handler ---
  const handleSearchUsername = async (value) => {
     if (!value) {
       setAutocompleteOptions([]);
       return;
     }
     try {
       const res = await searchUsernamePrefix(value);
       if (res.code === 0) {
         const users = res.data?.users || [];
         setAutocompleteOptions(
           users.map((user) => ({
             label: `${user.nickname || user.username} (${user.username})`,
             value: user.username,
           }))
         );
       } else {
         setAutocompleteOptions([]);
       }
     } catch {
       console.error('Username search failed');
       setAutocompleteOptions([]);
     }
  };

   // --- User Selection Handler ---
   const handleUserSelect = (value) => {
       setSearchUser(value);
       // No need to clear options manually here if AutoComplete behaves as expected
       // setAutocompleteOptions([]);
   };

    // --- AutoComplete Input Change Handler ---
    const handleAutoCompleteChange = (data) => {
        // Reset searchUser only when the clear button is explicitly used
        if (!data) {
            setSearchUser('');
            // setData([]); // This will be cleared by the useEffect watching searchUser
            setAutocompleteOptions([]);
        }
        // Do nothing while user is just typing
    };


  // --- Add Permission ---
  const handleAdd = async (values) => {
    const { permission_name, match_id, permission_info: otherInfo } = values; // Destructure values

    // Start loading indicator immediately
    setLoading(true);

    try {
        // --- Match ID Validation Step ---
        if (permission_name === 'match.update_match_info') {
            // Check if match_id is provided (basic check, Form validation should handle requirement)
            if (match_id === null || match_id === undefined || match_id === '') {
                 message.error('为 "更新特定赛事信息" 权限添加时必须提供有效的赛事 ID。');
                 form.validateFields(['match_id']); // Trigger validation feedback if needed
                 setLoading(false); // Stop loading
                 return; // Exit early
            }

             // Call API to check if match exists
            console.log(`Validating match ID: ${match_id}`); // Debug log
            const validationRes = await getCompetitionInfo(match_id);

            // Check response code - 0 means success (match found)
            if (validationRes.code !== 0) {
                 // Handle specific "not found" code if available, otherwise show generic error
                const errorMsg = validationRes.code === 1101
                    ? `赛事 ID ${match_id} 不存在，请检查后重试。`
                    : `验证赛事 ID ${match_id} 失败: ${validationRes.msg || '未知错误'}`;
                message.error(errorMsg);
                setLoading(false); // Stop loading
                return; // Exit early if validation fails
            }
             console.log(`Match ID ${match_id} validated successfully.`); // Debug log
        }
        // --- End Match ID Validation ---


        // --- Proceed with adding permission if validation passed or wasn't needed ---

        if (permission_name === 'user.is_superadmin') {
            message.error('超级管理员权限不能在此处添加。');
            setLoading(false); // Stop loading
            return;
        }

        const permissionInfoValue = permission_name === 'match.update_match_info'
            ? String(match_id) // Use validated match_id
            : otherInfo || ''; // Use other info field

        console.log("Attempting to add permission:", { // Debug log
            operator: currentUser.username,
            username: searchUser,
            permission_name: permission_name,
            permission_info: permissionInfoValue,
        });

        const res = await userAddPermission({
            operator: currentUser.username,
            username: searchUser,
            permission_name: permission_name,
            permission_info: permissionInfoValue,
        });

        if (res.code === 0) {
            message.success('权限添加成功');
            fetchPermissions(searchUser); // Refresh the table
            setAddModalVisible(false); // Close modal on success
            // State reset handled by afterClose/destroyOnClose
        } else {
            message.error(`添加失败: ${res.msg || res.code}`);
            // Keep modal open on failure
        }
    } catch (error) {
        // Catch errors from either validation or add permission calls
        console.error("Error during permission add process:", error);
        message.error('网络错误，操作失败');
        // Keep modal open on network error
    } finally {
        // Ensure loading is turned off regardless of success/failure/validation result
         setLoading(false);
    }
  };

  // --- Remove Permission ---
  const handleRemove = useCallback(async (record) => { // Wrap in useCallback
    if (record.permission_name === 'user.is_superadmin') {
      message.warning('不可移除超级管理员权限');
      return;
    }
    // Maybe add a Popconfirm here for safety?
    setLoading(true);
    try {
      const res = await userRemovePermission({
        operator: currentUser.username,
        username: record.username,
        permission_name: record.permission_name,
        permission_info: record.permission_info,
      });
      if (res.code === 0) {
        message.success('权限移除成功');
        // Re-fetch permissions for the user whose permission was removed
        fetchPermissions(record.username);
      } else {
        message.error(`移除失败: ${res.msg || res.code}`);
      }
    } catch (error) {
      message.error('网络错误，移除权限失败');
    } finally {
        setLoading(false);
    }
  // Depend on fetchPermissions and currentUser (for operator)
  }, [currentUser, fetchPermissions]);

  // --- Table Columns ---
  const columns = [
    ...(isAdmin ? [{ title: '用户名', dataIndex: 'username', key: 'username', width: 150 }] : []),
    {
      title: '权限名称',
      dataIndex: 'permission_name',
      key: 'permission_name',
      render: (text) => PERMISSION_MAP[text] || text,
      width: 200,
    },
    { title: '权限信息 (ID/详情)', dataIndex: 'permission_info', key: 'permission_info', width: 150 },
    ...(isAdmin
      ? [
          {
            title: '操作',
            key: 'action',
            fixed: 'right',
            width: 80,
            render: (_, record) =>
              record.permission_name !== 'user.is_superadmin' && (
                // Consider adding Popconfirm here:
                // <Popconfirm title="确定移除此权限吗？" onConfirm={() => handleRemove(record)} okText="确定" cancelText="取消">
                <Button danger size="small" onClick={() => handleRemove(record)} loading={loading && record.key === 'removing_key_state'}> {/* Better loading state if needed */}
                  移除
                </Button>
                // </Popconfirm>
              ),
          },
        ]
      : []),
  ];

  // --- Modal Control ---

  // Opens the modal
  const openAddPermissionModal = () => {
    // Reset the selected permission state *before* opening
    setSelectedPermission(null);
    // Explicitly reset form fields when opening the modal for safety
    form.resetFields();
    setAddModalVisible(true);
  };

  // Handles Cancel button or clicking outside modal (if maskClosable were true)
  const handleAddModalCancel = () => {
      setAddModalVisible(false);
      // State reset will be handled by afterClose
  };

  // Ensures reset *after* the modal is fully closed
  const handleModalAfterClose = () => {
      console.log("Modal fully closed. Resetting state.");
      setSelectedPermission(null); // Reset the state controlling conditional fields
      form.resetFields(); // Reset the form fields
  }

  // Handles selection change in the permission dropdown
  const handlePermissionChange = (value) => {
      console.log("Permission selected:", value);
      setSelectedPermission(value); // Update state to trigger re-render
      // Reset potentially dependent fields when selection changes,
      // needed if user switches between permission types *within* the same modal opening
      if (value !== 'match.update_match_info') {
        form.setFieldsValue({ match_id: null });
      }
      if (value === 'match.update_match_info') {
         form.setFieldsValue({ permission_info: '' });
      }
  };


  // --- Render ---
  return (
    <Card title={isAdmin ? "用户权限管理" : "我的权限"}>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* Admin Search Section */}
        {isAdmin && (
          <Space wrap>
            <AutoComplete
              style={{ width: 300 }}
              options={autocompleteOptions}
              onSearch={handleSearchUsername}
              onSelect={handleUserSelect}
              onChange={handleAutoCompleteChange}
              placeholder="搜索用户 (用户名或昵称)"
              allowClear
            />
            <Button
                type="primary"
                onClick={openAddPermissionModal}
                disabled={!searchUser || loading} // Disable if no user or during loading
            >
              为 {searchUser || '...'} 添加权限
            </Button>
          </Space>
        )}

        {/* Informational Text */}
        {!isAdmin && data.length > 0 && (
             <Typography.Text type="secondary">您当前拥有的权限列表。</Typography.Text>
         )}
         {isAdmin && !searchUser && (
             <Typography.Text type="secondary">请输入用户名前缀进行搜索以查看或管理其权限。</Typography.Text>
         )}
         {isAdmin && searchUser && (
             <Typography.Text type="secondary">
                 正在管理用户 <Typography.Text strong>{searchUser}</Typography.Text> 的权限。
                 注意：特定赛事的更新权限需要提供赛事ID，也可以在 <a href="/matches" target="_blank" rel="noopener noreferrer">赛事列表</a> 中进行管理。
             </Typography.Text>
         )}

        {/* Permissions Table */}
        <Table
            rowKey="key"
            columns={columns}
            dataSource={data}
            loading={loading} // Use main loading state for table
            pagination={{ pageSize: 10, size: 'small', hideOnSinglePage: true }}
            scroll={{ x: isAdmin ? 600 : 400 }}
            size="small"
            locale={{ emptyText: isAdmin && searchUser ? '该用户当前无任何特定权限' : '无权限信息' }}
        />
      </Space>

      {/* Add Permission Modal */}
      <Modal
        title={`为 ${searchUser} 添加权限`}
        open={addModalVisible}
        onCancel={handleAddModalCancel} // Handle click on 'x' or Cancel button
        onOk={() => form.submit()} // Trigger Form's onFinish (handleAdd)
        okText="确认添加"
        cancelText="取消"
        // Use the main loading state for the confirm button as well
        confirmLoading={loading}
        // *** destroyOnClose is often the cleanest way to ensure reset ***
        destroyOnClose
        // *** afterClose provides an extra layer of safety for resetting ***
        afterClose={handleModalAfterClose}
        maskClosable={false} // Good practice during operations
        // Force re-render might help sometimes, but destroyOnClose should be enough
        // forceRender
      >
        {/* Form instance is passed. destroyOnClose + afterClose ensure it's reset */}
        <Form form={form} onFinish={handleAdd} layout="vertical" name="addPermissionForm">
          {/* Permission Name Dropdown */}
          <Form.Item
            label="权限名"
            name="permission_name" // Form item name
            rules={[{ required: true, message: '请选择权限' }]}
          >
            <Select
              options={PERMISSION_OPTIONS}
              placeholder="选择要添加的权限"
              showSearch
              optionFilterProp="label"
              onChange={handlePermissionChange} // Update state to show/hide fields
              // No need for `value` prop here, Form.Item handles it
            />
          </Form.Item>

          {/* Conditional Field: Match ID */}
          {selectedPermission === 'match.update_match_info' && (
             <Form.Item
                label="赛事 ID"
                name="match_id" // Needs to match name used in handleAdd
                // Add validation rule directly here
                rules={[{ required: true, message: '请输入此权限对应的赛事 ID' }]}
                tooltip="请提供需要授予更新权限的具体赛事 ID。"
             >
                {/* Ensure InputNumber allows clearing */}
                <InputNumber min={1} style={{ width: '100%' }} placeholder="例如: 123" controls={false}/>
            </Form.Item>
          )}

          {/* Conditional Field: Permission Info */}
          {selectedPermission && selectedPermission !== 'match.update_match_info' && (
             <Form.Item
                label="权限信息 (可选)"
                name="permission_info" // Needs to match name used in handleAdd
                tooltip="某些权限可能需要附加信息（如论坛版块ID）。如果无需附加信息请留空。"
             >
                <Input placeholder="例如: forum_section_1"/>
             </Form.Item>
          )}
        </Form>
      </Modal>
    </Card>
  );
};

export default PermissionSettings;