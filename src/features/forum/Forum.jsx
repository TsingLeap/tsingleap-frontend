import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Typography, Button, message, Space, Select, Input, Tag, Card } from 'antd';
import { TagOutlined } from '@ant-design/icons';
import { getUser } from '../../utils/auth';
import { getForumPosts, createForumPost, getUserPermissionInfo, getUserInfo, createPostWithTag, getTagListByPostId, getPostListByTag, getTagList, searchTagByPrefix } from '../../services/api';
import PostList from './PostList';
import PostDetailDrawer from './PostDetailDrawer';
import PostCreateDrawer from './PostCreateDrawer';
import TagSelector from '../../components/TagSelector';


const PAGE_SIZE = 10;
const { Search } = Input;
const { Title, Text } = Typography;

const Forum = () => {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [isSearched, setIsSearched] = useState(false);
  const [activeKeyword, setActiveKeyword] = useState('');

  // 权限相关
  const [canPost, setCanPost] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [canManageTag, setCanManageTag] = useState(false);

  // 发帖相关
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [selectedTagIds, setSelectedTagIds] = useState([]);

  // Tag 筛选相关
  const [selectedSearchTagIds, setSelectedSearchTagIds] = useState([]);

  const loader = useRef(null);
  const user = getUser();
  const isFetchingRef = useRef(false);

  const [createVisible, setCreateVisible] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');

  const nicknameCache = useRef(new Map());

  // 加载用户权限
  useEffect(() => {
    const checkPermission = async () => {
      if (!user?.username) return;
      try {
        const res = await getUserPermissionInfo(user.username);
        if (res.code === 0) {
          const hasPostPermission = res.data.some(p => p.permission_name === 'forum.post');
          const hasDeletePermission = res.data.some(p => p.permission_name === 'forum.manage_forum');
          const hasManageTagPermission = res.data.some(p => p.permission_name === 'tag.manage_tag');
          setCanPost(hasPostPermission);
          setCanDelete(hasDeletePermission);
          setCanManageTag(hasManageTagPermission);
        } else {
          message.error('权限获取失败');
        }
      } catch (error) {
        message.error('权限校验网络错误');
      }
    };
    checkPermission();
  }, [user?.username]);

  // 加载帖子
  const fetchPosts = useCallback(async () => {
    if (loading || isFetchingRef.current || !hasMore) return;

    isFetchingRef.current = true;
    setLoading(true);

    try {
      const res = await getForumPosts(
        selectedSearchTagIds,
        searchKeyword.trim(),
        page,
        PAGE_SIZE
      );

      if (res.code === 0) {
        const rawPosts = res.data.posts;
        const nextHasMore = page < res.data.total_pages;

        // 组装帖子的 tag, 作者nickname
        const newPosts = await Promise.all(
          rawPosts.map(async post => {
            let nickname = nicknameCache.current.get(post.author) || post.author;
            if (!nicknameCache.current.has(post.author)) {
              try {
                const uRes = await getUserInfo(post.author);
                if (uRes.code === 0) {
                  nickname = uRes.data.nickname;
                  nicknameCache.current.set(post.author, nickname);
                }
              } catch { }
            }
            let tags = [];
            try {
              const tRes = await getTagListByPostId(post.post_id);
              if (tRes.code === 0) tags = tRes.data.filter(t => t.is_post_tag);
            } catch { }
            return { ...post, nickname, tags };
          })
        );

        setPosts(prev => (page === 1 ? newPosts : [...prev, ...newPosts]));
        setHasMore(nextHasMore);
        setInitialLoaded(true);
      } else if (res.code === 1023) {
        message.error('页码超出范围');
        return;
      }
    } catch {
      message.error('加载帖子失败');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [page, hasMore, loading, selectedSearchTagIds, searchKeyword])

  useEffect(() => {
    fetchPosts();
  }, [page, reloadKey]);

  // 监听滚动到底部
  useEffect(() => {
    if (!initialLoaded) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loading && hasMore) {
        setPage(prev => prev + 1);
      }
    },
      {
        root: null,
        rootMargin: '0px 0px 100px 0px',
        threshold: 0.1,
      }
    );
    if (loader.current) observer.observe(loader.current);
    return () => {
      if (loader.current) observer.unobserve(loader.current);
    };
  }, [fetchPosts, initialLoaded]);

  // 发帖
  const handlePostSubmit = async () => {
    if (!postTitle.trim()) {
      message.warning('标题不能为空');
      return;
    }
    if (!postContent.trim()) {
      message.warning('内容不能为空');
      return;
    }
    if (selectedTagIds.length === 0) {
      message.warning('至少选择一个标签');
      return;
    }
    try {
      const res = await createPostWithTag({
        username: user.username,
        title: postTitle.trim(),
        content: postContent.trim(),
        tag_ids: selectedTagIds,
      });
      if (res.code === 0) {
        message.success('发帖成功');
        setCreateVisible(false);
        setPostTitle('');
        setPostContent('');
        setPosts([]);
        setHasMore(true);
        setInitialLoaded(false);
        setPage(1);
        setSelectedTagIds([]);
        setReloadKey(prev => prev + 1);
      } else if (res.code === 1022) {
        message.warning('帖子标题过长，请缩短标题')
      } else if (res.code === 1021) {
        message.warning('用户不存在！')
      } else {
        message.error(res.msg || '发帖失败');
      }
    } catch {
      message.error('网络错误');
    }
  };


  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      {/* 标题 + 发帖按钮 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={3} style={{ margin: 0, marginLeft: 8 }}>体育论坛</Title>
          {canPost && (
            <Button
              type="primary"
              onClick={() => setCreateVisible(true)}
              style={{
                height: 40,
                padding: '0 20px',
                fontWeight: 'bold',
              }}
            >
              发表帖子
            </Button>
          )}
        </div>
      </Card>

      {/* 搜索 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {/* 关键词搜索框 */}
          <Input
            placeholder="搜索帖子标题、内容等关键词"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            allowClear
            onPressEnter={() => {
              const keyword = searchKeyword.trim();
              const hasKeyword = keyword !== '';
              const hasTag = selectedSearchTagIds.length > 0;

              if (hasKeyword || hasTag) {
                setPage(1);
                setPosts([]);
                setHasMore(true);
                setInitialLoaded(false);
                setReloadKey(prev => prev + 1);
                setIsSearched(true);
                setActiveKeyword(keyword);
              }
            }}
          />

          {/* 标签筛选标题 */}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
            <TagOutlined style={{ marginRight: 8 }} />
            <Typography.Text strong>按标签筛选</Typography.Text>
          </div>

          {/* 标签选择器 */}
          <TagSelector
            value={selectedSearchTagIds}
            onChange={(newIds) => setSelectedSearchTagIds(newIds)}
            placeholder="请选择用于筛选帖子的标签"
            maxSelectCount={5}
            onlyPostTags
          />
        </Space>
      </Card>

      {/* 搜索触发按钮区域 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          onClick={() => {
            setPage(1);
            setPosts([]);
            setHasMore(true);
            setInitialLoaded(false);
            setReloadKey(prev => prev + 1);
            setIsSearched(true);
            setActiveKeyword(searchKeyword.trim());
          }}
        >
          搜索
        </Button>
      </Card>

      <PostList
        posts={posts}
        searchKeyword={activeKeyword}
        isSearched={isSearched}
        onClickPost={post => {
          setSelectedPost(post);
          setDrawerVisible(true);
        }}
        loaderRef={loader}
        loading={loading}
        hasMore={hasMore}
        initialLoaded={initialLoaded}
      />

      <PostDetailDrawer
        visible={drawerVisible}
        searchKeyword={activeKeyword}
        isSearched={isSearched}
        onClose={() => setDrawerVisible(false)}
        post={selectedPost}
        canDelete={canDelete}
        currentUsername={user?.username}
        onDeleted={() => {
          setDrawerVisible(false);
          setPosts((prev) => prev.filter(p => p.post_id !== selectedPost.post_id));
        }}
      />

      <PostCreateDrawer
        open={createVisible}
        onClose={() => setCreateVisible(false)}
        postTitle={postTitle}
        setPostTitle={setPostTitle}
        postContent={postContent}
        setPostContent={setPostContent}
        onSubmit={handlePostSubmit}
        canPost={canPost}
        selectedTagIds={selectedTagIds}
        setSelectedTagIds={setSelectedTagIds}
      />
    </div>
  );
};

export default Forum;