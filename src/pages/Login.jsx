
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUsers, saveUser, addHistoryLog } from '../services/mockDatabase';
import { User as UserIcon, Lock, Mail, ArrowRight, } from 'lucide-react';
import logo from '/src/assets/logo.png';

const Login = () => {
  const navigate = useNavigate();
  const [view, setView] = useState('role');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loginAttempts, setLoginAttempts] = useState({});

    // Reset state when changing views
  useEffect(() => {
    setError('');
    setUsername('');
    setEmail('');
    setPassword('');
  }, [view]);

  const handleEmployeeLogin = (employeeName) => {
    const now = new Date();
    addHistoryLog({
      type: 'Employee Login',
      description: `Employee logged into POS system`,
      user: employeeName,
      timestamp: now.toISOString(),
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0]
    });
    navigate('/employee/pos');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please enter both username/email and password');
      return;
    }

    const now = new Date();
    const timestamp = now.toISOString();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0];

    // Admin check
    if (username === 'admin' && password === 'admin') {
      addHistoryLog({
        type: 'Admin Login',
        description: 'Admin logged into the system',
        user: 'admin',
        timestamp,
        date,
        time
      });
      navigate('/admin/history');
      return;
    }

    let users = await getUsers();
    if (!Array.isArray(users)) {
      users = [];
    }
    
    const user = users.find(u => (u.username === username || u.email === username) && u.password === password);

    if (user) {
      addHistoryLog({
        type: 'Manager Login',
        description: `Manager ${user.username} logged into the dashboard`,
        user: user.username,
        timestamp,
        date,
        time
      });
      navigate('/manager/dashboard');
    } else {
      // Track failed attempts
      const newAttempts = { ...loginAttempts, [username]: (loginAttempts[username] || 0) + 1 };
      setLoginAttempts(newAttempts);
      
      if (newAttempts[username] >= 3) {
        addHistoryLog({
          type: 'Failed Login Attempts',
          description: `Multiple failed login attempts for user: ${username} (${newAttempts[username]} attempts)`,
          user: username,
          timestamp,
          date,
          time
        });
      }

      setError('Invalid username/email or password. Please try again.');
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
    if (!Array.isArray(users)) {
      users = [];
    }
    
    if (users.find(u => u.username === username || u.email === email)) {
      setError('Username or Email already exists');
      return;
    }

    const newUser = {
      id: crypto.randomUUID(),
      username,
      email,
      password,
      role: 'manager',
      createdAt: new Date().toISOString()
    };

    await saveUser(newUser);
    
    const now = new Date();
    addHistoryLog({
      type: 'Manager Signup',
      description: `New manager account created: ${username}`,
      user: newUser.username,
      timestamp: now.toISOString(),
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0]
    });
    
    setView('login');
  };


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
          
          {view === 'role' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-bold text-gray-900 mb-3">Welcome Back</h2>
                <p className="text-gray-600 text-lg">Select your role to continue</p>
              </div>
              
              <div className="grid gap-6">
                <button 
                  onClick={() => handleEmployeeLogin('Employee 1')}
                  className="group flex items-center justify-between p-6 bg-white border-2 border-gray-200 rounded-2xl hover:border-green-600 hover:shadow-xl transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
                      <UserIcon size={28} />
                    </div>
                    <div className="text-left">
                      <span className="block text-xl font-bold text-gray-900">EMPLOYEE</span>
                      <span className="text-sm text-gray-500">Access POS terminal</span>
                    </div>
                  </div>
                  <ArrowRight className="text-gray-300 group-hover:text-green-600 transition-colors" />
                </button>

                <button 
                  onClick={() => setView('login')}
                  className="group flex items-center justify-between p-6 bg-gray-900 border-2 border-gray-900 rounded-2xl hover:bg-black hover:shadow-xl transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-yellow-400 rounded-xl flex items-center justify-center text-gray-900 group-hover:bg-yellow-500 transition-colors">
                      <Lock size={28} />
                    </div>
                    <div className="text-left">
                      <span className="block text-xl font-bold text-white">MANAGER</span>
                      <span className="text-sm text-gray-400">Dashboard & Analytics</span>
                    </div>
                  </div>
                  <ArrowRight className="text-gray-500 group-hover:text-yellow-400 transition-colors" />
                </button>
              </div>
            </div>
          )}

          {(view === 'login' || view === 'signup') && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center mb-10">
                <h2 className="text-4xl font-bold text-gray-900 mb-3">
                  {view === 'login' ? 'Manager Login' : 'Create Account'}
                </h2>
                <p className="text-gray-600 text-lg">
                  {view === 'login' ? 'Enter your credentials to access the dashboard' : 'Fill in the details to register as a manager'}
                </p>
              </div>

              <form onSubmit={view === 'login' ? handleLogin : handleSignup} className="space-y-6">
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
                      placeholder="Username or Email"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-200 rounded-xl focus:border-green-600 focus:ring-0 transition-all text-lg outline-none"
                      required
                    />
                  </div>

                  {view === 'signup' && (
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input 
                        type="email" 
                        placeholder="Email Address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-200 rounded-xl focus:border-green-600 focus:ring-0 transition-all text-lg outline-none"
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
                      className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-200 rounded-xl focus:border-green-600 focus:ring-0 transition-all text-lg outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="text-center">
                  <button 
                    type="button"
                    onClick={() => setView(view === 'login' ? 'signup' : 'login')}
                    className="text-gray-600 hover:text-green-700 font-semibold transition-colors cursor-pointer"
                  >
                    {view === 'login' ? 'Don\'t have an account? Sign up' : 'Already have an account? Login'}
                  </button>
                </div>

                <button 
                  type="submit"
                  className="w-full py-5 bg-blue-600 text-white rounded-xl text-xl font-bold hover:bg-blue-700 shadow-lg hover:shadow-blue-200 transition-all active:scale-[0.98]"
                >
                  {view === 'login' ? 'Login to Dashboard' : 'Create Account'}
                </button>

                <button 
                  type="button"
                  onClick={() => setView('role')}
                  className="w-full py-3 text-gray-500 hover:text-gray-800 font-medium transition-colors"
                >
                  ← Back to role selection
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
