import React, { useState, useEffect, useRef } from 'react';
import { Drawer, Typography, Divider, List, Input, Button, message, Card, Spin, Modal } from 'antd';
import dayjs from 'dayjs';
import { getComments, createComment, getUserInfo, deletePost, createReport } from '../../services/api';
import { getUser } from '../../utils/auth';
import CommentReply from './CommentReply';

const PAGE_SIZE = 5;

const PostDetailDrawer = ({ visible, searchKeyword, isSearched, onClose, post, canDelete, currentUsername, onDeleted }) => {
  if (!post) return null;

  const user = getUser();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const nicknameCache = useRef(new Map());
  const [confirmVisible, setConfirmVisible] = useState(false);
  const canDeleteThisPost = canDelete || post?.author === currentUsername;
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);

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

  // 单页数据拉取
  const fetchPage = async (page) => {
    const res = await getComments("Post", post.post_id, page, PAGE_SIZE);
    if (res.code !== 0) throw new Error('加载失败');
    const rawComments = res.data.comments;
    const totalPages = res.data.total_pages

    const sorted = [...rawComments].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );

    const enriched = await Promise.all(
      sorted.map(async (comment) => {
        const cached = nicknameCache.current.get(comment.author);
        if (cached) return { ...comment, nickname: cached };
        try {
          const infoRes = await getUserInfo(comment.author);
          if (infoRes.code === 0) {
            const nick = infoRes.data.nickname;
            nicknameCache.current.set(comment.author, nick);
            return { ...comment, nickname: nick };
          }
        } catch { }
        return { ...comment, nickname: comment.author };
      })
    );

    return { comments: enriched, totalPages }
  };

  // 拉取所有分页
  const fetchAllComments = async () => {
    setLoading(true);
    try {
      const { comments: firstComments, totalPages } = await fetchPage(1);
      let all = [...firstComments];
      for (let page = 2; page <= totalPages; page++) {
        const { comments: pageComments } = await fetchPage(page);
        all = all.concat(pageComments);
      }

      // 全局排序
      all.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      setComments(all);
    } catch (err) {
      message.error(err.message || '评论加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && post) {
      fetchAllComments();
    }
  }, [visible, post]);

  // 发表评论
  const handleSubmitComment = async () => {
    if (!newComment.trim()) {
      message.warning('评论不能为空');
      return;
    }

    try {
      const res = await createComment({
        username: user.username,
        contentType: "Post",
        objectId: post.post_id,
        content: newComment.trim(),
        allowReply: true,
      });

      if (res.code === 0) {
        message.success('评论成功');
        setNewComment('');
        await fetchAllComments();
      } else {
        message.error(res.msg || '评论失败');
      }
    } catch {
      message.error('网络错误');
    }
  };

  // 删除帖子
  const handleDeletePost = async () => {
    try {
      const res = await deletePost({ username: user.username, post_id: post.post_id });
      if (res.code === 0) {
        message.success('帖子删除成功');
        setConfirmVisible(false);
        onDeleted();
      } else if (res.code === 1021) {
        message.error('用户不存在');
      } else if (res.code === 1029) {
        message.error('帖子不存在')
      } else if (res.code === 1030) {
        message.error('用户没有权限')
      }
    } catch {
      message.error('网络错误')
    }
  };

  return (
    <Drawer
      title={post?.title}
      placement="right"
      width={800}
      onClose={onClose}
      open={visible}
    >
      <Typography.Paragraph>
        <strong>作者：</strong>{post?.nickname || post?.author}
      </Typography.Paragraph>
      <Typography.Paragraph>
        <strong>发布时间：</strong>
        {dayjs(post?.created_at).format('YYYY-MM-DD HH:mm')}
      </Typography.Paragraph>
      <Divider />
      <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
        {isSearched ? highlightKeyword(post.content, searchKeyword) : post.content}
      </Typography.Paragraph>

      {post?.author !== currentUsername && (
        <Typography.Paragraph>
          <Button
            type="link"
            danger
            size="small"
            onClick={() => setReportModalVisible(true)}
            style={{ padding: 0 }}
          >
            举报该帖子
          </Button>
        </Typography.Paragraph>
      )}

      <Divider orientation="left">评论</Divider>

      <List
        dataSource={comments}
        loading={loading}
        renderItem={(item, idx) => (
          <List.Item>
            <Card title={`${idx + 1}楼`} style={{ width: '100%' }} bordered>
              <Typography.Text strong>
                {item.nickname || item.author}
              </Typography.Text>
              <Typography.Paragraph style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>
                {item.content}
              </Typography.Paragraph>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
              </Typography.Text>

              <CommentReply commentId={item.comment_id} visible={visible} onDeleted={fetchAllComments} />
            </Card>
          </List.Item>
        )}
      />


      <Modal
        title="举报帖子"
        open={reportModalVisible}
        onCancel={() => {
          setReportModalVisible(false);
          setReportReason('');
        }}
        onOk={async () => {
          if (!reportReason.trim()) {
            message.warning('请输入举报原因');
            return;
          }
          setReporting(true);
          try {
            const res = await createReport(currentUsername, 'Post', post.post_id, reportReason.trim());
            if (res.code === 0) {
              message.success('举报成功');
              setReportModalVisible(false);
              setReportReason('');
            } else if (res.code === 1025) {
              message.error('用户不存在');
            } else if (res.code === 1031) {
              message.error('举报类型错误');
            } else if (res.code === 1032) {
              message.error('帖子不存在');
            } else {
              message.error(res.msg || '举报失败');
            }
          } catch {
            message.error('网络错误');
          } finally {
            setReporting(false);
          }
        }}
        confirmLoading={reporting}
      >
        <Input.TextArea
          rows={4}
          value={reportReason}
          onChange={(e) => setReportReason(e.target.value)}
          placeholder="请输入举报原因，例如包含违规内容或恶意攻击等"
        />
      </Modal>

      <Input.TextArea
        rows={3}
        placeholder="写下你的评论..."
        value={newComment}
        onChange={(e) => setNewComment(e.target.value)}
        style={{ marginTop: 16 }}
      />
      <div style={{ textAlign: 'right', marginTop: 8 }}>
        <Button
          onClick={handleSubmitComment}
          loading={loading}
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
          提交评论
        </Button>
      </div>

      {canDeleteThisPost && (
        <>
          <Divider />
          <div style={{ textAlign: 'right' }}>
            <Button
              danger
              onClick={() => setConfirmVisible(true)}
              style={{
                height: '40px',
                borderRadius: 6,
                padding: '0 20px',
                fontWeight: 'bold',
              }}
            >
              删除帖子
            </Button>
          </div>

          <Modal
            title="确认删除帖子"
            open={confirmVisible}
            onOk={handleDeletePost}
            onCancel={() => setConfirmVisible(false)}
            okText="确认删除"
            cancelText="返回"
            okButtonProps={{ danger: true }}
          >
            <p>确定要删除该帖子吗？此操作不可恢复。</p>
          </Modal>
        </>
      )}
    </Drawer>
  );
};

export default PostDetailDrawer;
