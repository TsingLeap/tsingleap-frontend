import React from 'react';
import { List, Typography, Spin } from 'antd';
import PostCard from './PostCard';

const PostList = ({ posts, searchKeyword, isSearched, onClickPost, loaderRef, loading, hasMore, initialLoaded}) => (
  <>
    <List
      dataSource={posts}
      renderItem={(post) => (
        <List.Item style={{ padding: '1rem 0' }}>
          <PostCard post={post} searchKeyword={searchKeyword} isSearched={isSearched} onClick={() => onClickPost(post)} />
        </List.Item>
      )}
    />
    {initialLoaded && (
      <div ref={loaderRef} style={{ textAlign: 'center', padding: 20 }}>
        {loading && <Spin />}
        {!hasMore && <Typography.Text type="secondary">已加载所有帖子</Typography.Text>}
      </div>
    )}
  </>
);

export default PostList;