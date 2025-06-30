import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button, Space, Menu, Dropdown, message } from 'antd';
import { logout, getUser } from '../utils/auth';
import { getUserPermissionInfo } from '../services/api';

const NavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const [canManageTag, setCanManageTag] = useState(false);
  const [canManageForum, setCanManageForum] = useState(false);

  const handleLogout = () => {
    logout(navigate);
  };

  // 加载用户权限
  useEffect(() => {
    const checkPermission = async () => {
      if (!user?.username) return;
      try {
        const res = await getUserPermissionInfo(user.username);
        if (res.code === 0) {
          const hasManageTagPermission = res.data.some(p => p.permission_name === 'tag.manage_tag');
          const hasManageForumPermission = res.data.some(p => p.permission_name === 'forum.manage_forum');
          setCanManageTag(hasManageTagPermission);
          setCanManageForum(hasManageForumPermission);
        } else {
          message.error('权限获取失败');
        }
      } catch {
        message.error('权限校验网络错误');
      }
    };
    checkPermission();
  }, [user?.username]);

  const activeStyle = {
    fontWeight: 'bold',
    color: '#1677ff',
  };

  const navButtonStyle = (path) => ({
    ...(location.pathname === path ? activeStyle : {}),
    padding: '0 12px',
    borderRadius: 4,
    transition: 'background-color 0.2s'
  });

  const menuItems = [
    { key: 'settings', label: '个人设置' },
    { key: 'logout', label: <span style={{ color: 'red' }}>退出</span> },
  ];

  const handleMenuClick = ({ key }) => {
    if (key === 'settings') navigate('/dashboard');
    if (key === 'logout') handleLogout();
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2rem',
        height: 72,
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        backgroundColor: '#f8f9fb',
        borderBottom: '1px solid #d9d9d9',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
      <Link
        to={user ? "/dashboard" : "/"}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          textDecoration: 'none',
        }}
      >
        <img
          src="/icon.png"
          alt="logo"
          style={{
            height: 48,
            width: 48,
            borderRadius: '14px',
            objectFit: 'cover',
          }}
        />
        <span
          style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#722EA5', // TsingHua purple
            fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            userSelect: 'none',
          }}
        >
          TsingLeap
        </span>
      </Link>

      <Space size="middle">
        {!user ? (
          <>
            <Button type="link" className="nav-btn" style={navButtonStyle('/login')}>
              <Link to="/login">登录</Link>
            </Button>
            <Button type="primary">
              <Link to="/register">注册</Link>
            </Button>
          </>
        ) : (
          <>
            <Space size={0} style={{ display: 'flex' }}>
              {/* 论坛管理 */}
              {canManageForum && (
                <div
                  style={{
                    backgroundColor: location.pathname === '/forum-manage' ? '#722EA5' : '#f8f9fb',
                    padding: '12px 24px',
                    borderRadius: 8,
                  }}
                >
                  <Link to="/forum-manage" style={{
                    color: location.pathname === '/forum-manage' ? '#fff' : '#722EA5',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    textDecoration: 'none',
                  }}>
                    论坛管理
                  </Link>
                </div>
              )}


              {/* 管理标签按钮 */}
              {canManageTag && (
                <div
                  style={{
                    backgroundColor: location.pathname === '/tag-manage' ? '#722EA5' : '#f8f9fb',
                    padding: '12px 24px',
                    borderRadius: 8,
                  }}
                >
                  <Link to="/tag-manage" style={{
                    color: location.pathname === '/tag-manage' ? '#fff' : '#722EA5',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    textDecoration: 'none',
                  }}>
                    标签管理
                  </Link>
                </div>
              )}

              {/* 赛事信息 */}
              <div
                style={{
                  backgroundColor: location.pathname === '/matches' ? '#722EA5' : '#f8f9fb',
                  padding: '12px 24px',
                  borderRadius: 8,
                }}
              >
                <Link to="/matches" style={{
                  color: location.pathname === '/matches' ? '#fff' : '#722EA5',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  textDecoration: 'none',
                }}>
                  赛事信息
                </Link>
              </div>

              {/* 体育论坛 */}
              <div
                style={{
                  backgroundColor: location.pathname === '/forum' ? '#722EA5' : '#f8f9fb',
                  padding: '12px 24px',
                  borderRadius: 8,
                }}
              >
                <Link to="/forum" style={{
                  color: location.pathname === '/forum' ? '#fff' : '#722EA5',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  textDecoration: 'none',
                }}>
                  体育论坛
                </Link>
              </div>
            </Space>

            <Dropdown menu={{
              items: menuItems,
              onClick: handleMenuClick
            }} placement="bottomRight">
              <Button type="text" style={{
                fontWeight: 'bold',
                backgroundColor: '#ffffff',
                border: '1px solid #d9d9d9',
                borderRadius: 6,
                padding: '0 12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'background-color 0.2s',
              }}
              >
                {user.username}
              </Button>
            </Dropdown>
          </>
        )}
      </Space>
    </div>
  );
};

export default NavBar;