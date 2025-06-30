import React, { useEffect, useState, useCallback } from 'react';
import { Card, Tag, Space, Typography, Divider, Tooltip, Button, Popconfirm, List, Badge, Spin } from 'antd';
import { EditOutlined, UserAddOutlined, TeamOutlined, DeleteOutlined, StarOutlined, StarFilled, TagOutlined, LikeOutlined, LikeFilled } from '@ant-design/icons';
import moment from 'moment';
import { getTagListByCompetition, likeParticipant, unlikeParticipant, getParticipantList, getLikeCount } from '../../../services/api';
import { getUser } from '../../../utils/auth';
import HighlightText from './HighlightText';
import { getTagColor } from '../../../components/TagSelector';

const { Text, Title } = Typography;

const MatchCard = ({
  item,
  canEdit,
  canManage,
  isOnlyScoreEditor,
  onEdit,
  onGrantPermission,
  onManageUpdaters,
  onDelete,
  isFocused,
  onFocus,
  onUnfocus,
  isUserLoggedIn,
  searchText = '',
  onUpdate,
}) => {
  const [tags, setTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [loadingLikes, setLoadingLikes] = useState({});
  const [lastUpdatedAt, setLastUpdatedAt] = useState(item.updated_at);

  // 创建一个刷新所有数据的函数
  const refreshAllData = useCallback(async (shouldNotifyParent = false) => {
    const currentUser = getUser();
    const userId = currentUser?.id || -1;

    // 获取标签
    setLoadingTags(true);
    try {
      const tagRes = await getTagListByCompetition(item.id);
      if (tagRes.code === 0) {
        setTags(tagRes.data?.tag_list || []);
      }
    } catch (error) {
      console.error('获取赛事标签失败:', error);
    } finally {
      setLoadingTags(false);
    }

    // 获取参赛者信息（含点赞数和点赞状态）
    try {
      const participantRes = await getParticipantList(item.id, userId);
      if (participantRes.code === 0) {
        setParticipants(participantRes.data?.participant_list || []);
      }
    } catch (error) {
      console.error('获取参赛者列表失败:', error);
    }

    // 只在需要时通知父组件更新
    if (shouldNotifyParent) {
      onUpdate?.();
    }
  }, [item.id]);

  // 监听item的变化，特别是updated_at字段
  useEffect(() => {
    // 如果更新时间变化了，说明数据被修改过，需要刷新
    if (item.updated_at !== lastUpdatedAt) {
      setLastUpdatedAt(item.updated_at);
      refreshAllData(false);
    }
  }, [item, lastUpdatedAt, refreshAllData]);

  // 初始加载数据
  useEffect(() => {
    refreshAllData(false);
  }, [refreshAllData]);

  // 处理点赞/取消点赞
  const handleLikeToggle = async (participantId) => {
    if (!isUserLoggedIn) return;
    
    const currentUser = getUser();
    if (!currentUser) return;
    
    setLoadingLikes(prev => ({ ...prev, [participantId]: true }));
    
    try {
      const participant = participants.find(p => p.id === participantId);
      if (!participant) return;
      
      const res = participant.like 
        ? await unlikeParticipant(currentUser.id, participantId)
        : await likeParticipant(currentUser.id, participantId);
        
      if (res.code === 0) {
        // 只更新当前参赛者的点赞状态
        const likeRes = await getLikeCount(participantId, currentUser.id);
        if (likeRes.code === 0) {
          setParticipants(prev => prev.map(p => 
            p.id === participantId 
              ? { 
                  ...p, 
                  like: likeRes.data.is_like,
                  like_count: likeRes.data.like_count 
                }
              : p
          ));
        }
      }
    } catch (error) {
      console.error('处理点赞操作失败:', error);
    } finally {
      setLoadingLikes(prev => ({ ...prev, [participantId]: false }));
    }
  };

  // --- Determine Actions ---
  const actions = [];
  
  // 关注/取消关注按钮
  if (isUserLoggedIn) {
    if (isFocused) {
      actions.push(
        <Tooltip title="取消关注" key="unfocus">
          <Button type="text" icon={<StarFilled style={{ color: '#fadb14' }} />} onClick={() => onUnfocus(item.id)} />
        </Tooltip>
      );
    } else {
      actions.push(
        <Tooltip title="关注比赛" key="focus">
          <Button type="text" icon={<StarOutlined />} onClick={() => onFocus(item.id)} />
        </Tooltip>
      );
    }
  }
  
  if (canEdit) {
    actions.push(
      <Tooltip title={isOnlyScoreEditor ? "更新比分/状态" : "编辑赛事信息/比分"} key="edit">
        <Button type="text" icon={<EditOutlined />} onClick={() => onEdit(item)} />
      </Tooltip>
    );
  }
  if (canManage) {
    actions.push(
      <Tooltip title="快速授予比分更新权限" key="grant">
        <Button type="text" icon={<UserAddOutlined />} onClick={() => onGrantPermission(item)} />
      </Tooltip>
    );
    actions.push(
      <Tooltip title="管理比分更新权限用户" key="manage_updaters">
        <Button type="text" icon={<TeamOutlined />} onClick={() => onManageUpdaters(item)} />
      </Tooltip>
    );
    actions.push(
      <Popconfirm
        key="delete"
        title="确定删除这场赛事吗？此操作不可恢复！"
        onConfirm={() => onDelete(item.id)}
        okText="确定删除"
        cancelText="取消"
      >
        <Tooltip title="删除赛事">
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Tooltip>
      </Popconfirm>
    );
  }

  // --- Render Card ---
  return (
    <Card
      title={searchText ? (
        <HighlightText text={item.name || '未命名赛事'} highlight={searchText} />
      ) : (
        item.name || '未命名赛事'
      )}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      bodyStyle={{ flexGrow: 1 }}
      actions={actions}
      extra={
        <Space>
          <Tag color="blue">ID: {item.id}</Tag>
          {(loadingTags || Object.values(loadingLikes).some(Boolean)) && (
            <Spin size="small" />
          )}
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%', height: '100%' }}>
        <Typography.Text>
          <strong>项目:</strong>{' '}
          {searchText ? (
            <HighlightText text={item.sport || 'N/A'} highlight={searchText} />
          ) : (
            item.sport || 'N/A'
          )}
        </Typography.Text>
        <Divider style={{ margin: '8px 0' }} />
        
        {/* Participants and Scores */}
        <div>
          {participants && participants.length > 0 ? (
            participants.length === 2 ? (
              // 两个参赛方使用对阵图布局
              <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                <Space direction="vertical" align="center" style={{ flex: 1 }}>
                  <Typography.Text strong style={{ minHeight: '2.5em', display: 'block', textAlign: 'center', wordBreak: 'break-word' }}>
                    {searchText ? (
                      <HighlightText text={participants[0].name || 'N/A'} highlight={searchText} />
                    ) : (
                      participants[0].name || 'N/A'
                    )}
                  </Typography.Text>
                  <Title level={4} style={{ margin: 0 }}>{participants[0].score ?? '?'}</Title>
                  {isUserLoggedIn && (
                    <Space>
                      <Button
                        type="text"
                        icon={participants[0].like ? <LikeFilled style={{ color: '#1890ff' }} /> : <LikeOutlined />}
                        loading={loadingLikes[participants[0].id]}
                        onClick={() => handleLikeToggle(participants[0].id)}
                      />
                      <Text type="secondary" style={{ fontSize: '14px' }}>
                        {participants[0].like_count || 0}
                      </Text>
                    </Space>
                  )}
                </Space>
                <Typography.Text strong style={{ fontSize: '1.2em', margin: '0 10px' }}>VS</Typography.Text>
                <Space direction="vertical" align="center" style={{ flex: 1 }}>
                  <Typography.Text strong style={{ minHeight: '2.5em', display: 'block', textAlign: 'center', wordBreak: 'break-word' }}>
                    {searchText ? (
                      <HighlightText text={participants[1].name || 'N/A'} highlight={searchText} />
                    ) : (
                      participants[1].name || 'N/A'
                    )}
                  </Typography.Text>
                  <Title level={4} style={{ margin: 0 }}>{participants[1].score ?? '?'}</Title>
                  {isUserLoggedIn && (
                    <Space>
                      <Button
                        type="text"
                        icon={participants[1].like ? <LikeFilled style={{ color: '#1890ff' }} /> : <LikeOutlined />}
                        loading={loadingLikes[participants[1].id]}
                        onClick={() => handleLikeToggle(participants[1].id)}
                      />
                      <Text type="secondary" style={{ fontSize: '14px' }}>
                        {participants[1].like_count || 0}
                      </Text>
                    </Space>
                  )}
                </Space>
              </div>
            ) : (
              // 其他数量的参赛方使用列表布局
              participants.map((participant, index) => (
                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: index < participants.length - 1 ? 8 : 0 }}>
                  <Typography.Text strong style={{ flex: 1, wordBreak: 'break-word' }}>
                    {searchText ? (
                      <HighlightText text={participant.name || 'N/A'} highlight={searchText} />
                    ) : (
                      participant.name || 'N/A'
                    )}
                  </Typography.Text>
                  <Space>
                    <Title level={4} style={{ margin: 0 }}>{participant.score ?? '?'}</Title>
                    {isUserLoggedIn && (
                      <Space>
                        <Button
                          type="text"
                          icon={participant.like ? <LikeFilled style={{ color: '#1890ff' }} /> : <LikeOutlined />}
                          loading={loadingLikes[participant.id]}
                          onClick={() => handleLikeToggle(participant.id)}
                        />
                        <Text type="secondary" style={{ fontSize: '14px' }}>
                          {participant.like_count || 0}
                        </Text>
                      </Space>
                    )}
                  </Space>
                </div>
              ))
            )
          ) : (
            <Typography.Text type="secondary">无参赛方信息</Typography.Text>
          )}
        </div>
        
        <Divider style={{ margin: '8px 0' }} />
        
        {/* Status and Time */}
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text>
            <strong>状态:</strong>{' '}
            {item.is_finished ? <Tag color="default">已结束</Tag> : <Tag color="green">进行中/未开始</Tag>}
          </Typography.Text>
          <Typography.Text>
            <strong>时间:</strong>{' '}
            {item.time_begin ? moment(item.time_begin).format('YYYY-MM-DD HH:mm') : '未定'}
          </Typography.Text>
        </Space>
        
        {/* 显示标签 */}
        {tags && tags.length > 0 && (
          <>
            <Divider style={{ margin: '8px 0' }} />
            <div>
              <Space size={[0, 4]} wrap>
                <TagOutlined style={{ marginRight: 8 }} />
                {tags.map(tag => (
                  <Tag
                    key={tag.id}
                    color={getTagColor(tag.tag_type)}
                    style={{ margin: '2px' }}
                  >
                    {tag.name}
                  </Tag>
                ))}
              </Space>
            </div>
          </>
        )}
        
        {/* Spacer to push Updated At to bottom */}
        <div style={{ flexGrow: 1 }}></div>
        
        {/* Updated At */}
        <Text type="secondary" style={{ fontSize: '0.8em', textAlign: 'right', marginTop: 'auto' }}>
          更新于: {moment(item.updated_at).fromNow()}
        </Text>
      </Space>
    </Card>
  );
};

export default MatchCard;