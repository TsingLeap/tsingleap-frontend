import React, { useState, useEffect, useRef } from 'react';
import { Card, Typography, Button, Input, message, Modal, Space } from 'antd';
import { changeNickname, getUserInfo } from '../../services/api';
import { getUser } from '../../utils/auth';

const ChangeNickname = () => {
  const [nickname, setNickname] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const hasErrorShown = useRef(false);
  const currentUser = getUser();

  useEffect(() => {
    let isMounted = true;

    if (currentUser?.username) {
      getUserInfo(currentUser.username)
        .then((res) => {
          if (!isMounted) return;
          if (res.code === 0) {
            setNickname(res.data.nickname);
            hasErrorShown.current = false;
          } else {
            message.error('获取昵称失败');
          }
        })
        .catch(() => {
          if (!hasErrorShown.current && isMounted) {
            message.error('网络错误');
            hasErrorShown.current = true;
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [currentUser?.username]);

  const showModal = () => {
    setNewNickname('');
    setIsModalVisible(true);
  };

  const handleOk = async () => {
    if (!newNickname.trim()) {
      message.warning('昵称不能为空');
      return;
    }
    try {
      const res = await changeNickname(currentUser.username, newNickname.trim());
      if (res.code === 0) {
        message.success('昵称修改成功');
        setNickname(newNickname.trim());
      } else {
        message.error('昵称修改失败');
      }
    } catch {
      message.error('网络错误');
    }
    setIsModalVisible(false);
  };

  return (
    <Card title="个人资料">
      <Space direction="vertical" style={{ width: '100%' }}>
        <Typography.Text>
          <strong>用户名：</strong> {currentUser.username}
        </Typography.Text>
        <Typography.Text>
          <strong>当前昵称：</strong> {nickname}
        </Typography.Text>
        <Button type="primary" onClick={showModal}>
          修改昵称
        </Button>
      </Space>

      <Modal
        title="修改昵称"
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
        okText="保存"
      >
        <Input
          placeholder="请输入新昵称"
          value={newNickname}
          onChange={(e) => setNewNickname(e.target.value)}
        />
      </Modal>
    </Card>
  );
};

export default ChangeNickname;