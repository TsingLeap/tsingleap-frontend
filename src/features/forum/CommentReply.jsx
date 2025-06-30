import React, { useState, useEffect, useRef } from 'react';
import { List, Typography, Input, Button, message, Modal } from 'antd';
import { getReplies, createComment, getUserInfo, deleteComment, getCommentDetail, createReport } from '../../services/api';
import { getUser } from '../../utils/auth';
import dayjs from 'dayjs';

const { TextArea } = Input;
const LIMIT = 3;

const CommentReply = ({ commentId, visible, onDeleted }) => {
  const user = getUser();

  /* ---------- state ---------- */
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [replyReachLimit, setReplyReachLimit] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);    // replyingTo = { mode: 'comment' | 'reply', target: {...} }
  const [commentAuthor, setCommentAuthor] = useState(null);

  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportTarget, setReportTarget] = useState(null); // { objectId, nickname }
  const [reporting, setReporting] = useState(false);

  /* ---------- nickname 缓存 ---------- */
  const nicknameCache = useRef(new Map());
  const getNickname = async (username) => {
    if (nicknameCache.current.has(username)) return nicknameCache.current.get(username);
    try {
      const { code, data } = await getUserInfo(username);
      const nick = code === 0 ? data.nickname || username : username;
      nicknameCache.current.set(username, nick);
      return nick;
    } catch {
      return username;
    }
  };

  /* ---------- fetch replies ---------- */
  const fetchReplies = async () => {
    setLoading(true);
    try {
      const res = await getReplies(commentId);
      if (res.code !== 0) {
        message.error('回复加载失败');
        return;
      }

      // 去除根节点
      const rawList = res.data.filter((r) => r.comment_id !== commentId);

      // 按照时间排序并去重
      const uniqMap = new Map();
      rawList
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .forEach((c) => uniqMap.set(c.comment_id, c));
      const ordered = Array.from(uniqMap.values());

      // 补充 nickname
      const withNick = await Promise.all(
        ordered.map(async (r) => ({
          ...r,
          nickname: await getNickname(r.author),
        }))
      );

      // 构建索引, 补replyToNick 
      const idMap = new Map(withNick.map((r) => [Number(r.comment_id), r]));
      const enriched = withNick.map((r) => {
        const fatherId = Number(r.father_object_id);
        let replyToNick = null;
        if (!Number.isNaN(fatherId) && fatherId !== Number(commentId)) {
          const parent = idMap.get(fatherId);
          if (parent) replyToNick = parent.nickname;
        }
        return { ...r, replyToNick };
      });

      setReplies(enriched);
    } catch {
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReplies();
  }, [commentId]);

  useEffect(() => {
    if (!visible) {
      setReplyContent('');
      setReplyingTo(null);
      setShowAll(false);
      setReplyReachLimit(false);
    }
  }, [visible]);

  /* ---------- submit reply ---------- */
  const handleSubmit = async () => {
    if (!replyContent.trim()) {
      message.warning('回复内容不能为空');
      return;
    }
    if (replies.length === 3) setReplyReachLimit(true);

    const objectId =
      replyingTo?.mode === 'reply' ? replyingTo.target.comment_id : commentId;

    try {
      const res = await createComment({
        username: user.username,
        contentType: 'Comment',
        objectId,
        content: replyContent.trim(),
        allowReply: true,
      });
      if (res.code === 0) {
        setReplyContent('');
        setReplyingTo(null);
        fetchReplies();
        setShowAll(true);
      } else {
        message.error(res.msg || '回复失败');
      }
    } catch {
      message.error('网络错误');
    }
  };

  /* ---------- comment detail ---------- */
  useEffect(() => {
    const fetchCommentDetail = async () => {
      try {
        const res = await getCommentDetail(commentId);
        if (res.code === 0) {
          setCommentAuthor(res.data.author);
        }
      } catch {
        message.error('加载评论详情失败');
      }
    };

    fetchCommentDetail();
  }, [commentId]);


  /* ---------- delete comment ---------- */
  const handleDeleteComment = async (comment_id, isReply = true) => {
    try {
      const res = await deleteComment({ username: user.username, comment_id: comment_id });
      if (res.code === 0) {
        message.success('评论删除成功');
        if (isReply) {
          fetchReplies();
        } else {
          onDeleted();
        }
      } else if (res.code === 1021) {
        message.error('用户不存在');
      } else if (res.code === 1035) {
        message.error('评论不存在');
      } else if (res.code === 1030) {
        message.error('没有删除权限')
      };
    } catch {
      message.error('网络错误');
    }
  };

  /* ---------- UI ---------- */
  return (
    <div style={{ marginTop: 8 }}>
      {loading ? (
        <div style={{ textAlign: 'center' }}>加载中...</div>
      ) : (
        <>
          {/* —— 回复楼主 与 删除评论 —— */}
          <div style={{
            marginBottom: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Button
              type="link"
              size="small"
              onClick={() =>
                setReplyingTo({ mode: 'comment', target: { comment_id: commentId } })
              }
            >
              回复楼主
            </Button>

            {commentAuthor !== user?.username && (
              <Button
                type="link"
                danger
                size="small"
                onClick={() => {
                  setReportTarget({ objectId: commentId, nickname: commentAuthor });
                  setReportModalVisible(true);
                }}
              >
                举报
              </Button>
            )}

            {commentAuthor === user?.username && (
              <Button
                type="link"
                danger
                size="small"
                onClick={() => handleDeleteComment(commentId, false)}
              >
                删除评论
              </Button>
            )}



          </div>

          {replyingTo?.mode === 'comment' && (
            <div style={{ marginTop: 8 }}>
              <TextArea
                autoSize={{ minRows: 2, maxRows: 4 }}
                placeholder="写下你的回复..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                style={{ width: '100%' }}
              />
              <div style={{ marginTop: 4, textAlign: 'right' }}>
                <Button
                  size="small"
                  type="primary"
                  onClick={handleSubmit}
                  style={{ marginRight: 8 }}
                >
                  发送
                </Button>
                <Button size="small" onClick={() => setReplyingTo(null)}>
                  取消
                </Button>
              </div>
            </div>
          )}

          {/* —— replies 列表 —— */}
          {replies.length > 0 && (
            <div style={{ marginTop: 8, paddingLeft: 16, borderLeft: '2px solid #eee' }}>
              <List
                dataSource={showAll ? replies : replies.slice(0, LIMIT)}
                renderItem={(reply) => (
                  <List.Item key={reply.comment_id} style={{ padding: '8px 0' }}>
                    <div style={{ width: '100%' }}>
                      <Typography.Text strong>{reply.nickname}</Typography.Text>

                      <Typography.Paragraph style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>
                        {reply.replyToNick && (
                          <span style={{ color: '#722ed1' }}>
                            回复&nbsp;{reply.replyToNick}：
                          </span>
                        )}
                        {reply.content}
                      </Typography.Paragraph>

                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(reply.created_at).format('YYYY-MM-DD HH:mm')}
                      </Typography.Text>
                      <Button
                        type="link"
                        size="small"
                        style={{ marginLeft: 12 }}
                        onClick={() =>
                          setReplyingTo({ mode: 'reply', target: reply })
                        }
                      >
                        回复
                      </Button>

                      {/* ✅ 删除按钮，仅本人可见 */}
                      {reply.author === user?.username && (
                        <Button
                          type="link"
                          danger
                          size="small"
                          style={{ marginLeft: 8 }}
                          onClick={() => handleDeleteComment(reply.comment_id)}
                        >
                          删除
                        </Button>
                      )}

                      {reply.author !== user?.username && (
                        <Button
                          type="link"
                          danger
                          size="small"
                          onClick={() => {
                            setReportTarget({ objectId: reply.comment_id, nickname: reply.nickname });
                            setReportModalVisible(true);
                          }}
                        >
                          举报
                        </Button>
                      )}

                      {/* —— 行内输入框 —— */}
                      {replyingTo?.mode === 'reply' &&
                        replyingTo.target.comment_id === reply.comment_id && (
                          <div style={{ marginTop: 8 }}>
                            <TextArea
                              autoSize={{ minRows: 2, maxRows: 4 }}
                              placeholder={`回复 ${reply.nickname}...`}
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              style={{ width: '100%' }}
                            />
                            <div style={{ marginTop: 4, textAlign: 'right' }}>
                              <Button
                                size="small"
                                type="primary"
                                onClick={handleSubmit}
                                style={{ marginRight: 8 }}
                              >
                                发送
                              </Button>
                              <Button size="small" onClick={() => setReplyingTo(null)}>
                                取消
                              </Button>
                            </div>
                          </div>
                        )}
                    </div>
                  </List.Item>
                )}
              />
            </div>
          )}

          {/* —— 展开更多 —— */}
          {!replyReachLimit && !showAll && replies.length > LIMIT && (
            <div style={{ textAlign: 'center' }}>
              <Button type="link" onClick={() => setShowAll(true)}>
                还有 {replies.length - LIMIT} 条回复，点击查看
              </Button>
            </div>
          )}
        </>
      )}

      <Modal
        title="举报评论"
        open={reportModalVisible}
        onCancel={() => {
          setReportModalVisible(false);
          setReportReason('');
          setReportTarget(null);
        }}
        onOk={async () => {
          if (!reportReason.trim()) {
            message.warning('请输入举报原因');
            return;
          }
          setReporting(true);
          try {
            const res = await createReport(user.username, 'Comment', reportTarget.objectId, reportReason.trim());
            if (res.code === 0) {
              message.success('举报成功');
              setReportModalVisible(false);
              setReportReason('');
              setReportTarget(null);
            } else if (res.code === 1025) {
              message.error('用户不存在');
            } else if (res.code === 1031) {
              message.error('举报类型错误');
            } else if (res.code === 1032) {
              message.error('评论不存在');
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
          placeholder={`请输入举报原因，例如包含违规内容、辱骂攻击等`}
        />
      </Modal>
    </div>
  );
};

export default CommentReply;