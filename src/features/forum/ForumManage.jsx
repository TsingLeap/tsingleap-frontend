import React, { useEffect, useState } from 'react';
import { Table, Button, Typography, Tag, Space, message, Switch } from 'antd';
import {
  getReportList,
  modifyReportSolvedState,
  deleteReportedObject,
  banReportedUser,
} from '../../services/api';
import { getUser } from '../../utils/auth';
import dayjs from 'dayjs';

const { Title } = Typography;

const ForumManage = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [solvedState, setSolvedState] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  const user = getUser();

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await getReportList({
        solved_state: solvedState,
        page,
        page_size: pageSize,
      });
      if (res.code === 0) {
        setReports(res.data.reports || []);
        setTotal(res.data.total || 0);
      } else if (res.code === 1028) {
        message.error('页码超出范围');
      } else {
        message.error(res.msg || '获取举报列表失败');
      }
    } catch {
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [solvedState, page]);

  const handleToggleSolved = async (report_id, targetSolved) => {
    try {
      const res = await modifyReportSolvedState(user.username, report_id, targetSolved);
      if (res.code === 0) {
        message.success('举报状态已更新');
        fetchReports();
      } else {
        message.error(res.msg || '状态更新失败');
      }
    } catch {
      message.error('网络错误');
    }
  };

  const handleDeleteReported = async (report_id) => {
    try {
      const res = await deleteReportedObject(user.username, report_id);
      if (res.code === 0) {
        message.success('内容已删除');
        fetchReports();
      } else {
        message.error(res.msg || '删除失败');
      }
    } catch {
      message.error('网络错误');
    }
  };

  const handleBanUser = async (report_id) => {
    try {
      const res = await banReportedUser(user.username, report_id);
      if (res.code === 0) {
        message.success('用户已封禁');
        fetchReports();
      } else {
        message.error(res.msg || '封禁失败');
      }
    } catch {
      message.error('网络错误');
    }
  };

  const columns = [
    {
      title: '举报ID',
      dataIndex: 'report_id',
      key: 'report_id',
      width: 80,
    },
    {
      title: '举报者',
      dataIndex: 'reporter',
      key: 'reporter',
      width: 100,
    },
    {
      title: '举报类型',
      dataIndex: 'content_type',
      key: 'content_type',
      width: 80,
      render: (type) => <Tag color="blue">{type}</Tag>,
    },
    {
      title: '举报原因',
      dataIndex: 'reason',
      key: 'reason',
      width: 180,
    },
    {
      title: '举报时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 100,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '被举报者',
      key: 'preview_author',
      width: 100,
      render: (_, record) =>
        record.preview?.author ? (
          <>
            {record.preview.author} {record.user_banned && <span style={{ color: 'red', marginLeft: 8 }}>(已封禁)</span>}
          </>
        ) : (
          <i style={{ color: '#888' }}>已处理</i>
        ),
    },
    {
      title: '被举报内容',
      key: 'preview_content',
      render: (_, record) => (
        <>
          {record.preview?.content || <i style={{ color: '#888' }}>（无内容）</i>}
          {record.object_deleted && <span style={{ color: 'red', marginLeft: 8 }}>(已删除)</span>}
        </>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 250,
      render: (_, record) => {
        const isDeleted = record.object_deleted;
        return (
          <Space>
            <Button
              type="link"
              danger
              disabled={solvedState || isDeleted}
              onClick={() => handleDeleteReported(record.report_id)}
            >
              删除内容
            </Button>
            <Button
              type="link"
              danger
              disabled={solvedState || record.user_banned}
              onClick={() => handleBanUser(record.report_id)}
            >
              封禁用户
            </Button>
            <Button
              type="link"
              onClick={() => handleToggleSolved(record.report_id, !record.solved)}
            >
              {record.solved ? '标记未完成' : '标记完成'}
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      <Title level={3}>举报内容管理</Title>
      <Space style={{ marginBottom: 16 }}>
        <span>展示：</span>
        <Switch
          checked={solvedState}
          onChange={(checked) => {
            setPage(1);
            setSolvedState(checked);
          }}
          checkedChildren="已解决"
          unCheckedChildren="未解决"
        />
      </Space>

      <Table
        rowKey="report_id"
        columns={columns}
        dataSource={reports}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p) => setPage(p),
        }}
        bordered
      />
    </div>
  );
};

export default ForumManage;