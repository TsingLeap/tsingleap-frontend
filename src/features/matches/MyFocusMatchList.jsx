import React, { useState, useCallback, useRef, useEffect } from 'react';
import { List, Card, Typography, Space, Spin, Tabs, Empty, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useMatchData } from './hooks/useMatchData';
import MatchCard from './components/MatchCard';
import { getUser } from '../../utils/auth';

const { Title, Text } = Typography;

const MyFocusMatchList = () => {
  const navigate = useNavigate();
  const {
    matches, loading, loadingMore, hasMore, queryFinishedStatus,
    handleStatusChange, loadMoreMatches,
    handleFocusMatch, handleUnfocusMatch, isMatchFocused
  } = useMatchData();

  // 在组件挂载时自动切换到"关注"视图模式并检查登录状态
  const { switchViewMode } = useMatchData();
  const currentUser = getUser();
  
  // 只在组件挂载时执行一次，避免重复渲染和API调用
  useEffect(() => {
    if (currentUser?.id) {
      console.log("MyFocusMatchList: 初始化为关注视图");
      // 只需要切换视图模式，useEffect观察viewMode的变化会自动触发数据获取
      switchViewMode('focus');
    } else {
      message.error('请先登录');
      navigate('/login');
    }
  }, []); // 空依赖数组，只在挂载时执行一次

  // 无限滚动设置
  const loaderRef = useRef(null);

  useEffect(() => {
    if (!loadMoreMatches || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (firstEntry.isIntersecting && hasMore && !loading && !loadingMore) {
          loadMoreMatches();
        }
      },
      { threshold: 1.0 }
    );

    const currentLoader = loaderRef.current;
    if (currentLoader) {
      observer.observe(currentLoader);
    }

    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader);
      }
    };
  }, [loadMoreMatches, hasMore, loading, loadingMore]);

  const isUserLoggedIn = !!currentUser;

  // 处理跳转到所有赛事页面
  const navigateToAllMatches = useCallback(() => {
    navigate('/matches');
  }, [navigate]);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 标题区域 */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>我关注的赛事</Title>
          </div>
        </Card>

        {/* 筛选标签页 */}
        <Card size="small" style={{ marginBottom: '-16px' }}>
          <Tabs
            activeKey={String(queryFinishedStatus)}
            onChange={(key) => handleStatusChange(key === 'true')}
            items={[
              { key: 'false', label: '进行中 / 未开始' },
              { key: 'true', label: '已结束' }
            ]}
          />
        </Card>

        {/* 内容区域 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>
        ) : matches.length === 0 ? (
          <Card>
            <Empty
              description={queryFinishedStatus ? '没有已关注且已结束的赛事' : '没有已关注且进行中或未开始的赛事'}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <div style={{ marginTop: '15px' }}>
                <Typography.Link onClick={navigateToAllMatches}>
                  去浏览更多赛事并关注你感兴趣的比赛
                </Typography.Link>
              </div>
            </Empty>
          </Card>
        ) : (
          <>
            <List
              grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3, xxl: 3 }}
              dataSource={matches}
              renderItem={(item) => (
                <List.Item key={item.id}>
                  <MatchCard
                    item={item}
                    canEdit={false}
                    canManage={false}
                    isOnlyScoreEditor={false}
                    isFocused={isMatchFocused(item.id)}
                    onFocus={handleFocusMatch}
                    onUnfocus={handleUnfocusMatch}
                    isUserLoggedIn={isUserLoggedIn}
                    onUpdate={() => {
                      // 刷新当前列表
                      refreshCurrentList();
                    }}
                  />
                </List.Item>
              )}
            />
            <div ref={loaderRef} style={{ textAlign: 'center', padding: 20, height: 50 }}>
              {loadingMore && <Spin />}
              {!loadingMore && !hasMore && matches.length > 0 && (
                <Typography.Text type="secondary">没有更多赛事了</Typography.Text>
              )}
            </div>
          </>
        )}
      </Space>
    </div>
  );
};

export default MyFocusMatchList;
