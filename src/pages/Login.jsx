
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUsers, saveUser, addHistoryLog } from '../services/mockDatabase';
import { User as UserIcon, Lock, Mail, ArrowRight } from 'lucide-react';
import logo from '/src/assets/logo.png';

// EMPLOYEE LOGIN COMPONENT
const EmployeeLogin = ({ onBack }) => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState({});

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    const now = new Date();
    const timestamp = now.toISOString();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0];

    let users = await getUsers();
    if (!Array.isArray(users)) users = [];
    
    const userExists = users.find(u => u.username === username);
    const user = userExists && userExists.password === password ? userExists : null;

    if (user && user.role === 'Employee') {
      console.log('✅ [Employee Login Success]', { username: user.username });
      sessionStorage.setItem('userRole', user.role);
      sessionStorage.setItem('username', user.username);
      
      addHistoryLog({
        type: 'Employee Login',
        description: `Employee ${user.username} logged into POS system`,
        user: user.username,
        role: user.role,
        timestamp,
        date,
        time
      });
      
      navigate('/employee/pos');
    } else {
      const newAttempts = { ...loginAttempts, [username]: (loginAttempts[username] || 0) + 1 };
      setLoginAttempts(newAttempts);
      
      if (!userExists) {
        setError('Employee account not found. Please sign up or check your username.');
      } else if (user && user.role !== 'Employee') {
        setError('This is not an employee account. Please use the Manager login.');
      } else {
        setError('Incorrect password. Please try again.');
      }
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    let users = await getUsers();
    if (!Array.isArray(users)) users = [];
    
    if (users.find(u => u.username === username)) {
      setError('Username already exists');
      return;
    }

    const newUser = {
      id: crypto.randomUUID(),
      username,
      email: `${username}@employee.com`,
      password,
      role: 'Employee',
      createdAt: new Date().toISOString()
    };

    await saveUser(newUser);
    
    const now = new Date();
    const timestamp = now.toISOString();
    const date = timestamp.split('T')[0];
    const time = now.toTimeString().split(' ')[0];
    
    console.log('✅ [Employee Account Created]', { username });
    
    addHistoryLog({
      type: 'User Signup',
      description: `New Employee account created: ${username}`,
      user: newUser.username,
      role: 'Employee',
      timestamp,
      date,
      time
    });
    
    // Auto-login
    sessionStorage.setItem('userRole', 'Employee');
    sessionStorage.setItem('username', newUser.username);
    
    addHistoryLog({
      type: 'Employee Login',
      description: `Employee ${username} logged into POS system`,
      user: newUser.username,
      role: 'Employee',
      timestamp,
      date,
      time
    });
    
    navigate('/employee/pos');
  };

  return (
    <div className="w-full max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold text-gray-900 mb-3">
          {isSignup ? 'Employee Sign Up' : 'Employee Login'}
        </h2>
        <p className="text-gray-600 text-lg">
          {isSignup ? 'Create your employee account' : 'Access the POS terminal'}
        </p>
      </div>

      <form onSubmit={isSignup ? handleSignup : handleLogin} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-medium rounded-r-lg">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="relative">
            <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-200 rounded-xl focus:border-green-600 focus:ring-0 transition-all text-lg outline-none"
              required
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="password" 
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-200 rounded-xl focus:border-green-600 focus:ring-0 transition-all text-lg outline-none"
              required
            />
          </div>
        </div>

        <div className="text-center">
          <button 
            type="button"
            onClick={() => setIsSignup(!isSignup)}
            className="text-gray-600 hover:text-green-700 font-semibold transition-colors cursor-pointer"
          >
            {isSignup ? 'Already have an account? Login' : 'Don\'t have an account? Sign up'}
          </button>
        </div>

        <button 
          type="submit"
          className="w-full py-3 bg-green-600 text-white rounded-lg text-xl font-bold hover:bg-green-700 shadow-lg hover:shadow-green-200 transition-all active:scale-[0.98]"
        >
          {isSignup ? 'Create Account' : 'Login to POS'}
        </button>

        <button 
          type="button"
          onClick={onBack}
          className="w-full py-3 text-gray-500 hover:text-gray-800 font-medium transition-colors"
        >
          ← Back to role selection
        </button>
      </form>
    </div>
  );
};

// MANAGER LOGIN COMPONENT
const ManagerLogin = ({ onBack }) => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState({});

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    const now = new Date();
    const timestamp = now.toISOString();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0];

    let users = await getUsers();
    if (!Array.isArray(users)) users = [];
    
    const userExists = users.find(u => u.username === username);
    const user = userExists && userExists.password === password ? userExists : null;

    if (user && (user.role === 'Manager' || user.role === 'Administrator')) {
      console.log('✅ [Manager/Admin Login Success]', { username: user.username, role: user.role });
      sessionStorage.setItem('userRole', user.role);
      sessionStorage.setItem('username', user.username);
      
      const loginType = user.role === 'Administrator' ? 'Administrator Login' : 'Manager Login';
      const destination = user.role === 'Administrator' ? '/admin' : '/manager/dashboard';
      
      addHistoryLog({
        type: loginType,
        description: `${user.role} ${user.username} logged in`,
        user: user.username,
        role: user.role,
        timestamp,
        date,
        time
      });
      
      navigate(destination);
    } else {
      const newAttempts = { ...loginAttempts, [username]: (loginAttempts[username] || 0) + 1 };
      setLoginAttempts(newAttempts);
      
      if (!userExists) {
        setError('Manager account not found. Please sign up or check your username.');
      } else if (user && user.role !== 'Manager' && user.role !== 'Administrator') {
        setError('This is not a manager account. Please use the Employee login.');
      } else {
        setError('Incorrect password. Please try again.');
      }
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    if (!username || !email || !password) {
      setError('Please fill in all fields');
      return;
    }

    let users = await getUsers();
    if (!Array.isArray(users)) users = [];
    
    if (users.find(u => u.username === username)) {
      setError('Username already exists');
      return;
    }

    if (users.find(u => u.email === email)) {
      setError('Email already registered');
      return;
    }

    const newUser = {
      id: crypto.randomUUID(),
      username,
      email,
      password,
      role: 'Manager',
      createdAt: new Date().toISOString()
    };

    await saveUser(newUser);
    
    const now = new Date();
    const timestamp = now.toISOString();
    const date = timestamp.split('T')[0];
    const time = now.toTimeString().split(' ')[0];
    
    console.log('✅ [Manager Account Created]', { username });
    
    addHistoryLog({
      type: 'User Signup',
      description: `New Manager account created: ${username}`,
      user: newUser.username,
      role: 'Manager',
      timestamp,
      date,
      time
    });
    
    // Auto-login
    sessionStorage.setItem('userRole', 'Manager');
    sessionStorage.setItem('username', newUser.username);
    
    addHistoryLog({
      type: 'Manager Login',
      description: `Manager ${username} logged in`,
      user: newUser.username,
      role: 'Manager',
      timestamp,
      date,
      time
    });
    
    navigate('/manager/dashboard');
  };

  return (
    <div className="w-full max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold text-gray-900 mb-3">
          {isSignup ? 'Manager Sign Up' : 'Account Login'}
        </h2>
        <p className="text-gray-600 text-lg">
          {isSignup ? 'Create your manager account' : 'Access the business operations'}
        </p>
      </div>

      <form onSubmit={isSignup ? handleSignup : handleLogin} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-medium rounded-r-lg">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="relative">
            <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-200 rounded-xl focus:border-blue-600 focus:ring-0 transition-all text-lg outline-none"
              required
            />
          </div>

          {isSignup && (
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="email" 
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-200 rounded-xl focus:border-blue-600 focus:ring-0 transition-all text-lg outline-none"
                required
              />
            </div>
          )}

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="password" 
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-200 rounded-xl focus:border-blue-600 focus:ring-0 transition-all text-lg outline-none"
              required
            />
          </div>
        </div>

        <div className="text-center">
          <button 
            type="button"
            onClick={() => {
              setIsSignup(!isSignup);
              setEmail('');
            }}
            className="text-gray-600 hover:text-blue-700 font-semibold transition-colors cursor-pointer"
          >
            {isSignup ? 'Already have an account? Login' : 'Don\'t have an account? Sign up'}
          </button>
        </div>

        <button 
          type="submit"
          className="w-full py-5 bg-green-600 text-white rounded-xl text-xl font-bold hover:bg-green-700 shadow-lg hover:shadow-blue-200 transition-all active:scale-[0.98]"
        >
          {isSignup ? 'Create Account' : 'Login to Dashboard'}
        </button>

        <button 
          type="button"
          onClick={onBack}
          className="w-full py-3 text-gray-500 hover:text-gray-800 font-medium transition-colors"
        >
          ← Back to role selection
        </button>
      </form>
    </div>
  );
};

// MAIN LOGIN COMPONENT
const Login = () => {
  const [selectedRole, setSelectedRole] = useState(null);

  return (
    <div className="flex h-screen bg-[#0f2818] text-white overflow-hidden font-sans">
      {/* Left Side - Logo */}
      <div className="w-1/2 flex flex-col items-center justify-center relative">
        <div className="absolute inset-0 bg-gradient-to-br from-[#133b32]/90 to-[#0f2818]/90"></div>
        <div className="z-10 flex flex-col items-center animate-fade-in">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-[#fef08a] rounded-full blur-3xl opacity-20 animate-pulse"></div>
              <img src={logo} alt="GoodLand CAI Logo" className="w-40 h-40 relative z-10 drop-shadow-2xl" />
            </div>
            <h1 className="text-5xl font-bold text-[#fef08a] mb-2 tracking-wide">GoodLand CAI</h1>
            <p className="text-[#fef08a]/80 text-lg">Point of Sale System</p>
        </div>
      </div>

      {/* Right Side - Forms */}
      <div className="w-1/2 bg-[#fef9c3] text-black flex flex-col items-center justify-center relative p-12">
        <div className="z-10 w-full max-w-md">
          
          {/* Role Selection Screen */}
          {selectedRole === null && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-bold text-gray-900 mb-3">Welcome Back</h2>
                <p className="text-gray-600 text-lg">Select your role to continue</p>
              </div>
              
              <div className="grid gap-6">
                {/* EMPLOYEE OPTION */}
                <button 
                  onClick={() => {
                    setSelectedRole('employee');
                    console.log('🔀 [Role Selected: Employee]');
                  }}
                  className="group flex items-center justify-between p-6 bg-white border-2 border-gray-200 rounded-2xl hover:border-green-600 hover:shadow-xl transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
                      <UserIcon size={28} />
                    </div>
                    <div className="text-left">
                      <span className="block text-xl font-bold text-gray-900">EMPLOYEE</span>
                      <span className="text-sm text-gray-500">POS Terminal</span>
                    </div>
                  </div>
                  <ArrowRight className="text-gray-300 group-hover:text-green-600 transition-colors" />
                </button>

                {/* MANAGEMENT OPTION */}
                <button 
                  onClick={() => {
                    setSelectedRole('manager');
                    console.log('🔀 [Role Selected: Manager]');
                  }}
                  className="group flex items-center justify-between p-6 bg-gray-900 border-2 border-gray-900 rounded-2xl hover:bg-black hover:shadow-xl transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-yellow-400 rounded-xl flex items-center justify-center text-gray-900 group-hover:bg-yellow-500 transition-colors">
                      <Lock size={28} />
                    </div>
                    <div className="text-left">
                      <span className="block text-xl font-bold text-white">MANAGEMENT</span>
                      <span className="text-sm text-gray-400">Manager & Administrator</span>
                    </div>
                  </div>
                  <ArrowRight className="text-gray-500 group-hover:text-yellow-400 transition-colors" />
                </button>
              </div>
            </div>
          )}

          {/* Employee Login Component */}
          {selectedRole === 'employee' && (
            <EmployeeLogin 
              onBack={() => setSelectedRole(null)}
            />
          )}

          {/* Manager Login Component */}
          {selectedRole === 'manager' && (
            <ManagerLogin 
              onBack={() => setSelectedRole(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
