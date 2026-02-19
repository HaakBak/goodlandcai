
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '/src/assets/logo.png';

const Login = () => {
  const navigate = useNavigate();
  const [showManagerLogin, setShowManagerLogin] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleEmployeeClick = () => {
    navigate('/employee/pos');
  };

  // Modify Login Security via MFA
  const handleManagerLogin = (e) => {
    e.preventDefault();
    // Simple mock auth
    if (username === 'admin' && password === 'admin') {
      navigate('/manager/dashboard');
    } else {
      
      alert('Invalid credentials');
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#0f2818] to-[#133b32] text-white overflow-hidden">
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

      {/* Right Side - Buttons or Form */}
      <div className="w-1/2 bg-gradient-to-br from-[#fef9c3] to-[#fef08a] text-black flex flex-col items-center justify-center relative">
        <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
        <div className="z-10 w-full max-w-md px-8">
          {!showManagerLogin ? (
            <div className="flex flex-col space-y-6 animate-slide-up">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">Welcome Back</h2>
                <p className="text-gray-600">Select your role to continue</p>
              </div>
              
              <button 
                onClick={handleEmployeeClick}
                className="group relative py-6 bg-white border-2 border-gray-800 rounded-2xl text-xl font-bold hover:bg-gray-50 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-green-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative flex items-center justify-center gap-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <span>EMPLOYEE</span>
                </div>
              </button>
              
              <button 
                onClick={() => setShowManagerLogin(true)}
                className="group relative py-6 bg-gradient-to-r from-gray-800 to-gray-900 text-white border-2 border-gray-800 rounded-2xl text-xl font-bold hover:from-gray-900 hover:to-black transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative flex items-center justify-center gap-3">
                  <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <span>MANAGER</span>
                </div>
              </button>
            </div>
          ) : (
            <form onSubmit={handleManagerLogin} className="flex flex-col space-y-6 animate-slide-up">
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">Manager Login</h2>
                <p className="text-gray-600">Enter your credentials</p>
              </div>
              
              <div className="space-y-4">
                <div>
                    <label className="block font-bold mb-2 text-gray-700">Username</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <input 
                          type="text" 
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 text-lg"
                          placeholder="Enter username"
                          required
                      />
                    </div>
                </div>
                
                <div>
                    <label className="block font-bold mb-2 text-gray-700">Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <input 
                          type="password" 
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 text-lg"
                          placeholder="Enter password"
                          required
                      />
                    </div>
                </div>
              </div>
              
              <button 
                  type="submit"
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white border-2 border-blue-800 rounded-xl text-lg font-bold hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1"
              >
                  Login to Dashboard
              </button>
              
              <button 
                  type="button"
                  onClick={() => {
                    setShowManagerLogin(false);
                    setUsername('');
                    setPassword('');
                  }}
                  className="w-full py-3 text-center text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200"
              >
                  ← Back to role selection
              </button>
            </form>
        )}
      </div>
    </div>
  </div>
  );
};

export default Login;
