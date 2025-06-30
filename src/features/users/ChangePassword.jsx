import React, { useState } from 'react';
import { Card, Button, Modal, Form, Input, message } from 'antd';
import { changePassword } from '../../services/api';
import { getUser } from '../../utils/auth';

const ChangePassword = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const user = getUser();

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const res = await changePassword({
        username: user.username,
        password: values.oldPassword,
        new_password: values.newPassword,
      });

      if (res.code === 0) {
        message.success('密码修改成功');
        setIsModalVisible(false);
        form.resetFields();
      } else {
        message.error(res.msg || '密码修改失败');
      }
    } catch {
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="密码设置">
      <Button onClick={() => setIsModalVisible(true)}>修改密码</Button>

      <Modal
        title="修改密码"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        okText="保存"
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="当前密码"
            name="oldPassword"
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            label="新密码"
            name="newPassword"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码长度不能少于6位' },
            ]}
            hasFeedback
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            label="确认新密码"
            name="confirmPassword"
            dependencies={['newPassword']}
            hasFeedback
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default ChangePassword;