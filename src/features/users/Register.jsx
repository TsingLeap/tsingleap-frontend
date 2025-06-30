import React, { useState } from 'react';
import { Form, Input, Button, message, Card } from 'antd';
import { useNavigate } from 'react-router-dom';
import { sendVerificationCode, register } from '../../services/api';

const Register = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [verifySent, setVerifySent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const sendVerificationCodeHandler = async () => {
    const email = form.getFieldValue('email');
    if (!email || !/^[a-zA-Z0-9._%+-]+@mails\.tsinghua\.edu\.cn$/.test(email)) {
      message.warning('请先输入有效的清华邮箱');
      return;
    }
  
    setCodeLoading(true);
    try {
      const res = await sendVerificationCode(email); // 加上这一行
      if (res.code !== 0) {
        message.error(res.msg || '验证码发送失败');
        return;
      }
  
      message.success('验证码已发送');
      setVerifySent(true);
      setCooldown(60);
      const timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      message.error('网络错误或服务器异常');
    } finally {
      setCodeLoading(false);
    }
  };

  const onFinish = async (values) => {
    const userData = {
      username: values.username,
      email: values.email,
      password1: values.password,
      password2: values.confirmPassword,
      verification_code: values.code,
    };

    setLoading(true);
    try {
      const res = await register(userData);
      if (res.code !== 0) {
        message.error(res.msg || '注册失败');
        return;
      }
      message.success('注册成功');
      navigate('/login');
    } catch (error) {
      message.error('网络错误或服务器异常');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10vh' }}>
      <Card title="注册新账号" style={{ width: 400 }}>
        <Form layout="vertical" onFinish={onFinish} form={form}>
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            label="清华邮箱"
            name="email"
            rules={[
              { required: true, message: '请输入清华邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
              {
                pattern: /^[a-zA-Z0-9._%+-]+@mails\.tsinghua\.edu\.cn$/,
                message: '必须使用清华邮箱注册',
              },
            ]}
          >
            <Input
              autoComplete="off"
              addonAfter={
                <Button
                  size="small"
                  onClick={sendVerificationCodeHandler}
                  disabled={cooldown > 0}
                  loading={codeLoading}
                >
                  {cooldown > 0 ? `${cooldown}s` : '获取验证码'}
                </Button>
              }
            />
          </Form.Item>
          <Form.Item
            label="验证码"
            name="code"
            rules={[
              { required: true, message: '请输入验证码' },
              { len: 6, message: '验证码为6位数字' },
            ]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码长度不能少于6位' },
            ]}
            hasFeedback
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            label="确认密码"
            name="confirmPassword"
            dependencies={['password']}
            hasFeedback
            rules={[
              { required: true, message: '请再次输入密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              注册
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Register;