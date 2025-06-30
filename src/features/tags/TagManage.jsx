import React, { useEffect, useState } from 'react';
import { Typography, Input, Table, message, Modal, Form, Checkbox, Select, Button, Popconfirm, Space } from 'antd';
import { getTagList, createTag, deleteTag, searchTagByPrefix } from '../../services/api';
import { getUser } from '../../utils/auth';

const { Title } = Typography;
const user = getUser();

const TagManage = () => {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [searchPrefix, setSearchPrefix] = useState('');
  const [searchTagType, setSearchTagType] = useState('0');
  const { Search } = Input;

  const tagTypeOptions = [
    { label: '运动', value: 'sports' },
    { label: '院系', value: 'department' },
    { label: '赛事', value: 'event' },
    { label: '精华帖', value: 'highlight' },
    { label: '默认', value: 'default' }
  ];

  const fetchTags = async () => {
    setLoading(true);
    try {
      const res = await getTagList();
      if (res.code === 0) {
        setTags(res.data);
      } else {
        message.error(res.msg || '标签加载失败');
      }
    } catch {
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTag = async (tagId) => {
    try {
      const res = await deleteTag({ username: user.username, tag_id: tagId });
      if (res.code === 0) {
        message.success('删除成功');
        fetchTags();
      } else {
        message.error(res.msg || '删除失败');
      }
    } catch {
      message.error('网络错误');
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  // Table columns
  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'tag_type', key: 'tag_type' },
    {
      title: '帖子 Tag',
      dataIndex: 'is_post_tag',
      key: 'is_post_tag',
      render: (val) => (val ? '是' : '否'),
    },
    {
      title: '赛事 Tag',
      dataIndex: 'is_competition_tag',
      key: 'is_competition_tag',
      render: (val) => (val ? '是' : '否'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Popconfirm
          title="确定删除该标签？"
          onConfirm={() => handleDeleteTag(record.id)}
          okText="删除"
          cancelText="取消"
        >
          <Button danger size="small">删除</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      <Title level={3}>标签管理</Title>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space.Compact style={{ maxWidth: '75%' }}>
          <Select
            value={searchTagType}
            onChange={(value) => setSearchTagType(value)}
            options={[{ label: '全部类型', value: '0' }, ...tagTypeOptions]}
            style={{ width: 160 }}
          />
          <Search
            placeholder="输入标签名前缀"
            value={searchPrefix}
            onChange={(e) => setSearchPrefix(e.target.value)}
            onSearch={async () => {
              try {
                const res = await searchTagByPrefix(searchPrefix.trim(), searchTagType);
                if (res.code === 0) {
                  setTags(res.data);
                } else {
                  message.error(res.msg || '搜索失败');
                }
              } catch {
                message.error('网络错误');
              }
            }}
            enterButton="搜索"
            allowClear
          />
        </Space.Compact>

        <Button
          type="primary"
          onClick={() => setCreateModalVisible(true)}
          style={{
            backgroundColor: '#A566CC',
            color: '#fff',
            fontWeight: 'bold',
            border: 'none',
            borderRadius: 6,
          }}
        >
          创建标签
        </Button>
      </div>

      <Modal
        title="创建新标签"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => {
          form.validateFields().then(async (values) => {
            try {
              const res = await createTag({
                username: user.username,
                tag_name: values.name,
                tag_type: values.tag_type,
                is_post_tag: values.is_post_tag || false,
                is_competition_tag: values.is_competition_tag || false,
              });
              if (res.code === 0) {
                message.success('创建成功');
                setCreateModalVisible(false);
                form.resetFields();
                fetchTags(); // 重新加载 tag 列表
              } else {
                message.error(res.msg || '创建失败');
              }
            } catch {
              message.error('网络错误');
            }
          });
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="标签名称"
            name="name"
            rules={[{ required: true, message: '请输入标签名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="标签类型"
            name="tag_type"
            rules={[{ required: true, message: '请选择标签类型' }]}
          >
            <Select options={tagTypeOptions} />
          </Form.Item>
          <Form.Item name="is_post_tag" valuePropName="checked">
            <Checkbox>作为帖子标签</Checkbox>
          </Form.Item>
          <Form.Item name="is_competition_tag" valuePropName="checked">
            <Checkbox>作为赛事标签</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      {/* 表格展示标签列表 */}
      <Table
        dataSource={tags}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSizeOptions: ['10', '20', '50', '100'], 
          showSizeChanger: true,                     
          defaultPageSize: 10,                       
        }}
        bordered
      />
    </div>
  );

};

export default TagManage;