import React from 'react';
import { Card, Tag } from 'antd';
import dayjs from 'dayjs';

// 根据标签类型返回颜色 - 与赛事板块保持一致
const getTagColor = (tagType) => {
  switch (tagType) {
    case 'sports':
      return 'blue';
    case 'department':
      return 'green';
    case 'highlight':
      return 'red';
    case 'user_liked':
      return 'orange';
    case 'user_follow':
      return 'purple';
    default:
      return 'default';
  }
};

const highlightKeyword = (text, keyword) => {
  if (!keyword?.trim()) return text;

  const parts = text.split(new RegExp(`(${keyword})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === keyword.toLowerCase() ? (
      <span key={i} style={{ backgroundColor: 'yellow' }}>{part}</span>
    ) : (
      part
    )
  );
};

const PostCard = ({ post, searchKeyword, isSearched, onClick }) => {
  const renderTitle = () =>
    isSearched ? highlightKeyword(post.title, searchKeyword) : post.title;

  return (
    <Card
      title={<strong>{renderTitle()}</strong>}
      extra={<span>{post.nickname}</span>}
      style={{
        width: '100%',
        border: '1px solid #d9d9d9',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        marginBottom: '16px',
        cursor: 'pointer'
      }}
      onClick={onClick}
      hoverable
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ marginBottom: 0, color: 'gray' }}>
          发布时间：{dayjs(post.created_at).format('YYYY-MM-DD HH:mm')}
        </p>

        {post.tags && post.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {post.tags.map(tag => (
              <Tag
                key={tag.tag_id}
                color={getTagColor(tag.tag_type)}
              >
                {tag.tag_name}
              </Tag>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};

export default PostCard;