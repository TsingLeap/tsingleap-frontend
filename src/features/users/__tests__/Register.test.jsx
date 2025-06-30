import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Register from '../Register';
import { BrowserRouter } from 'react-router-dom';
import * as api from '../../../services/api';

// 模拟 sendVerificationCode 和 register 请求
vi.mock('../../../services/api', async () => {
  return {
    sendVerificationCode: vi.fn(() => Promise.resolve({ code: 0, msg: '验证码已发送' })),
    register: vi.fn(() => Promise.resolve({ code: 0, msg: '注册成功' })),
  };
});

describe('Register Component', () => {
  beforeEach(() => {
    render(
      <BrowserRouter>
        <Register />
      </BrowserRouter>
    );
  });

  it('should render form inputs', () => {
    expect(screen.getByLabelText(/用户名/)).toBeInTheDocument();
    expect(screen.getByLabelText(/清华邮箱/)).toBeInTheDocument();
    expect(screen.getByLabelText(/验证码/)).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
    expect(screen.getByLabelText('确认密码')).toBeInTheDocument();
    expect(screen.getByLabelText(/确认密码/)).toBeInTheDocument();
  });

  it('should send verification code on valid email', async () => {
    const emailInput = screen.getByLabelText(/清华邮箱/);
    fireEvent.change(emailInput, {
      target: { value: 'test@mails.tsinghua.edu.cn' },
    });

    const button = screen.getByText('获取验证码');
    fireEvent.click(button);

    await waitFor(() => {
      expect(api.sendVerificationCode).toHaveBeenCalledWith('test@mails.tsinghua.edu.cn');
      expect(screen.getByText(/验证码已发送/)).toBeInTheDocument();
    });
  });

  it('should submit form with valid data', async () => {
    fireEvent.change(screen.getByLabelText(/用户名/), {
      target: { value: 'testuser' },
    });
    fireEvent.change(screen.getByLabelText(/清华邮箱/), {
      target: { value: 'test@mails.tsinghua.edu.cn' },
    });
    fireEvent.change(screen.getByLabelText(/验证码/), {
      target: { value: '123456' },
    });
    fireEvent.change(screen.getByLabelText(/^密码$/), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByLabelText(/确认密码/), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /注.?册/ }));

    await waitFor(() => {
      expect(api.register).toHaveBeenCalled();
      expect(screen.getByText(/注册成功/)).toBeInTheDocument();
    });
  });
});