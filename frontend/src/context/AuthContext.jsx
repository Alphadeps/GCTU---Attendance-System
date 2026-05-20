import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);
  const [username, setUsername] = useState(null);
  const [assignedClass, setAssignedClass] = useState(null);
  const [deptName, setDeptName] = useState(null);
  const [deptLogo, setDeptLogo] = useState(null);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);

  // Load initial state from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedRole = localStorage.getItem('role');
    const storedUsername = localStorage.getItem('username');
    const storedAssignedClass = localStorage.getItem('assignedClass');
    const storedDeptName = localStorage.getItem('dept_name');
    const storedDeptLogo = localStorage.getItem('dept_logo');
    const storedNeedsPasswordChange = localStorage.getItem('needsPasswordChange');

    if (storedToken) setToken(storedToken);
    if (storedRole) setRole(storedRole);
    if (storedUsername) setUsername(storedUsername);
    if (storedAssignedClass) {
      try {
        setAssignedClass(JSON.parse(storedAssignedClass));
      } catch {
        setAssignedClass(null);
      }
    }
    if (storedDeptName) setDeptName(storedDeptName);
    if (storedDeptLogo) setDeptLogo(storedDeptLogo);
    if (storedNeedsPasswordChange) setNeedsPasswordChange(storedNeedsPasswordChange === 'true');
  }, []);

  const login = (userData) => {
    // Write all fields to localStorage and update state
    if (userData.token) {
      localStorage.setItem('token', userData.token);
      setToken(userData.token);
    }
    if (userData.role) {
      localStorage.setItem('role', userData.role);
      setRole(userData.role);
    }
    if (userData.username) {
      localStorage.setItem('username', userData.username);
      setUsername(userData.username);
    }
    if (userData.assignedClass) {
      localStorage.setItem('assignedClass', JSON.stringify(userData.assignedClass));
      setAssignedClass(userData.assignedClass);
    }
    if (userData.dept_name) {
      localStorage.setItem('dept_name', userData.dept_name);
      setDeptName(userData.dept_name);
    }
    if (userData.dept_logo) {
      localStorage.setItem('dept_logo', userData.dept_logo);
      setDeptLogo(userData.dept_logo);
    }
    if (userData.needsPasswordChange !== undefined) {
      localStorage.setItem('needsPasswordChange', String(userData.needsPasswordChange));
      setNeedsPasswordChange(userData.needsPasswordChange);
    }
  };

  const logout = () => {
    // Clear localStorage and reset all state
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    localStorage.removeItem('assignedClass');
    localStorage.removeItem('dept_name');
    localStorage.removeItem('dept_logo');
    localStorage.removeItem('needsPasswordChange');

    setToken(null);
    setRole(null);
    setUsername(null);
    setAssignedClass(null);
    setDeptName(null);
    setDeptLogo(null);
    setNeedsPasswordChange(false);
  };

  const value = {
    token,
    role,
    username,
    assignedClass,
    deptName,
    deptLogo,
    needsPasswordChange,
    login,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
