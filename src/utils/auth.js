export const logout = (navigate) => {
    localStorage.removeItem('user');
    window.location.href = '/login';
    navigate('/login', { replace: true });
  };
  
  export const getUser = () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  };
  
  export const setUser = (userData) => {
    localStorage.setItem('user', JSON.stringify(userData));
  };