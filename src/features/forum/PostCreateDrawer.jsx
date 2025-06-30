import React, { useEffect, useState } from 'react';
import { Drawer, Input, Button, Typography, message, Space, Tag, Select } from 'antd';
import { getTagList, searchTagByPrefix } from '../../services/api';
import TagSelector from '../../components/TagSelector';
import { TagOutlined } from '@ant-design/icons';


const { TextArea, Search } = Input

const PostCreateDrawer = ({
  open,
  onClose,
  postTitle,
  setPostTitle,
  postContent,
  setPostContent,
  onSubmit,
  canPost,
  selectedTagIds,
  setSelectedTagIds,
}) => {
  const [allTags, setAllTags] = useState([]);
  const [searchPrefix, setSearchPrefix] = useState('');
  const [searchTagType, setSearchTagType] = useState('全部类型');

  const fetchPostTags = async () => {
    try {
      const res = await getTagList();
      if (res.code === 0) {
        const filtered = res.data.filter((tag) => tag.is_post_tag);
        setAllTags(filtered);
      } else {
        message.error('标签加载失败');
      }
    } catch (error) {
      message.error('网络错误');
    }
  };

  useEffect(() => {
    if (open) {
      fetchPostTags();
    }
  }, [open]);

  return (
    <Drawer
      title="发表新帖"
      placement="right"
      width={600}
      onClose={onClose}
      open={open}
    >
      <Input
        placeholder="请输入帖子标题"
        value={postTitle}
        onChange={(e) => setPostTitle(e.target.value)}
        disabled={!canPost}
        style={{ marginBottom: 16 }}
      />
      <Input.TextArea
        rows={12}
        placeholder="请输入帖子内容"
        value={postContent}
        onChange={(e) => setPostContent(e.target.value)}
        disabled={!canPost}
      />

      {/* 标签搜索与选择 */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <TagOutlined style={{ marginRight: 8 }} />
          <Typography.Text strong>选择标签（最多 5 个）</Typography.Text>
        </div>

        <TagSelector
          value={selectedTagIds}
          onChange={setSelectedTagIds}
          placeholder="请选择用于本帖的标签"
          maxSelectCount={5}
          onlyPostTags
          style={{ flexWrap: 'wrap' }}
        />
      </div>


      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Button
          onClick={onClose}
          style={{
            marginRight: 8,
            height: '40px',
            borderRadius: 6,
            padding: '0 20px',
            fontWeight: 'bold',
          }}
        >
          取消
        </Button>
        <Button type="primary" onClick={onSubmit} disabled={!canPost}
          style={{
            backgroundColor: '#A566CC',
            color: '#fff',
            fontWeight: 'bold',
            border: 'none',
            borderRadius: 6,
            padding: '0 20px',
            height: '40px'
          }}
        >
          确认发表
        </Button>
      </div>
      {!canPost && (
        <Typography.Text type="danger" style={{ display: 'block', marginTop: 12 }}>
          您没有发帖权限，请联系管理员。
        </Typography.Text>
      )}
    </Drawer>
  );
};

export default PostCreateDrawer;