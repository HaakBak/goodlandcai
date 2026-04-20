
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabaseClient, getUserProfileByUsername, getUserProfileByEmail, getUserProfile, getAdminUserProfile, addHistoryLog, saveUser } from '../services/databaseService';
import { User as UserIcon, Lock, Mail, ArrowRight } from 'lucide-react';
import logo from '/src/assets/logo.png';

// EMPLOYEE LOGIN COMPONENT
const EmployeeLogin = ({ onBack }) => {
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
      setError('Please enter username/email and password');
      return;
    }

    try {
      const supabase = getSupabaseClient();
      
      if (!supabase) {
        setError('System offline. Please check your connection.');
        console.error('[Auth] Supabase client not available');
        return;
      }

      // Fetch user profile by username or email
      const userProfile = await getUserProfile(username);
      
      if (!userProfile) {
        setError('User not found. Please check your username/email or sign up.');
        return;
      }

      // Validate role for this login path (Employee only)
      if (userProfile.role !== 'Employee') {
        const now = new Date();
        const timestamp = now.toISOString();
        const date = timestamp.split('T')[0];
        const time = now.toTimeString().split(' ')[0];

        await addHistoryLog({
          type: 'Unauthorized Login Attempt',
          description: `Employee login form used by ${userProfile.username} with actual role ${userProfile.role}`,
          user: userProfile.username,
          role: userProfile.role,
          userId: userProfile.id,
          timestamp,
          date,
          time,
        });

        setError(`This is not an employee account. Please use the ${userProfile.role} login.`);
        return;
      }

      // Use stored email from profile to authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: userProfile.email,
        password
      });

      if (authError) {
        console.error('[Auth] Sign-in error:', authError);
        if (authError.message.includes('Invalid login credentials')) {
          setError('Incorrect username or password. Please try again.');
        } else {
          setError(`Login failed: ${authError.message}`);
        }
        return;
      }

      // Ensure auth role metadata is synced for Supabase RLS
      if (authData.user) {
        const { error: metadataError } = await supabase.auth.updateUser({
          data: { role: 'Employee', username }
        });
        if (metadataError) {
          console.warn('[Auth] Failed to sync role metadata for employee login:', metadataError);
        }
      }

      // Store session information
      sessionStorage.setItem('userRole', 'Employee');
      sessionStorage.setItem('username', username);
      sessionStorage.setItem('userId', userProfile.id);
      sessionStorage.setItem('supabaseSessionToken', authData.session?.access_token || '');

      console.log('✅ [Employee Login Success]', { username, role: 'Employee' });

      // Log history entry with explicit userId
      const now = new Date();
      const timestamp = now.toISOString();
      const date = now.toISOString().split('T')[0];
      const time = now.toTimeString().split(' ')[0];

      await addHistoryLog({
        type: 'Employee Login',
        description: `Employee ${username} logged into POS system`,
        user: username,
        role: 'Employee',
        userId: userProfile.id,
        timestamp,
        date,
        time
      });

      navigate('/employee/pos');

    } catch (err) {
      console.error('[Auth] Unexpected error during login:', err);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    if (!username || !email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      const supabase = getSupabaseClient();
      
      if (!supabase) {
        setError('System offline. Cannot create account now.');
        return;
      }

      // Check if username already exists
      console.log(`[Employee Signup] Checking duplicate username: "${username}"`);
      const existingUsername = await getUserProfileByUsername(username);
      if (existingUsername) {
        console.warn(`[Employee Signup] ❌ Username duplicate detected: "${username}"`);
        setError(`Username "${username}" is already taken. Please choose another.`);
        return;
      }
      console.log(`[Employee Signup] ✅ Username available: "${username}"`);

      // Check if email already exists
      console.log(`[Employee Signup] Checking duplicate email: "${email}"`);
      const existingEmail = await getUserProfileByEmail(email);
      if (existingEmail) {
        console.warn(`[Employee Signup] ❌ Email duplicate detected: "${email}"`);
        setError(`Email "${email}" is already registered. Please use a different email or login.`);
        return;
      }
      console.log(`[Employee Signup] ✅ Email available: "${email}"`);

      // Sign up new user via Supabase Auth using user-provided email
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email,
        password,
        options: {
          data: {
            username: username,
            role: 'Employee'
          }
        }
      });

      if (signUpError) {
        console.error('[Auth] Sign-up error:', signUpError);
        setError(`Sign-up failed: ${signUpError.message}`);
        return;
      }

      if (!authData.user || !authData.user.id) {
        setError('Failed to create account. Please try again.');
        return;
      }

      // Save user to database
      try {
        await saveUser({
          id: authData.user.id,
          username,
          password_hash: 'SUPABASE_AUTH',
          email,
          role: 'Employee',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } catch (saveError) {
        // Handle database constraint violations
        console.error('[Auth] saveUser error during signup:', saveError.message);
        
        // Rollback: Delete the auth user if database save failed
        if (authData.user?.id) {
          try {
            await supabase.auth.admin.deleteUser(authData.user.id);
            console.log('[Auth] Rolled back Supabase Auth user due to database save failure');
          } catch (rollbackErr) {
            console.warn('[Auth] Failed to rollback auth user:', rollbackErr);
          }
        }
        
        // Show specific error message based on constraint violation
        if (saveError.message.includes('DUPLICATE_USERNAME')) {
          setError(`Username "${username}" is already taken. Please choose another.`);
        } else if (saveError.message.includes('DUPLICATE_EMAIL')) {
          setError(`Email "${email}" is already registered. Please use a different email.`);
        } else {
          setError('Failed to create account. Please try again.');
        }
        return;
      }

      console.log('✅ [Employee Account Created]', { username });

      const now = new Date();
      const timestamp = now.toISOString();
      const date = timestamp.split('T')[0];
      const time = now.toTimeString().split(' ')[0];

      // Set session data BEFORE logging (so user_id is available for history logs)
      sessionStorage.setItem('userRole', 'Employee');
      sessionStorage.setItem('username', username);
      sessionStorage.setItem('userId', authData.user.id);
      sessionStorage.setItem('supabaseSessionToken', authData.session?.access_token || '');

      // Log signup event with explicit userId
      await addHistoryLog({
        type: 'User Signup',
        description: `New Employee account created: ${username}`,
        user: username,
        role: 'Employee',
        userId: authData.user.id,
        timestamp,
        date,
        time
      });

      // Log login event
      await addHistoryLog({
        type: 'Employee Login',
        description: `New employee ${username} logged into POS system`,
        user: username,
        role: 'Employee',
        userId: authData.user.id,
        timestamp,
        date,
        time
      });

      navigate('/employee/pos');

    } catch (err) {
      console.error('[Auth] Unexpected error during signup:', err);
      setError('An unexpected error occurred during signup.');
    }
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
              placeholder="Username or Email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-200 rounded-xl focus:border-green-600 focus:ring-0 transition-all text-lg outline-none"
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

        {/* SIGNUP TOGGLE - DISABLED (Uncomment to enable sign-up) */}
        {/* <div className="text-center">
          <button 
            type="button"
            onClick={() => {
              setIsSignup(!isSignup);
              setEmail('');
            }}
            className="text-gray-600 hover:text-green-700 font-semibold transition-colors cursor-pointer"
          >
            {isSignup ? 'Already have an account? Login' : 'Don\'t have an account? Sign up'}
          </button>
        </div> */}

        <button 
          type="submit"
          className="w-full py-3 bg-green-600 text-white rounded-lg text-xl font-bold hover:bg-green-700 shadow-lg hover:shadow-green-200 transition-all active:scale-[0.98]"
        >
          {/* {isSignup ? 'Create Account' : 'Login to POS'} */}
          Login to POS
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
      setError('Please enter username/email and password');
      return;
    }

    try {
      const supabase = getSupabaseClient();
      
      if (!supabase) {
        setError('System offline. Please check your connection.');
        console.error('[Auth] Supabase client not available');
        return;
      }

      // Fetch user profile by username or email
      const userProfile = await getUserProfile(username);
      
      if (!userProfile) {
        // Provide more helpful error message  
        console.warn(`[Auth] User not found during manager/admin login. Searched for: "${username}"`);
        setError('User not found. Please check your username/email or sign up.');
        return;
      }

      // Validate role (must be Manager or Administrator)
      if (userProfile.role !== 'Manager' && userProfile.role !== 'Administrator') {
        const now = new Date();
        const timestamp = now.toISOString();
        const date = timestamp.split('T')[0];
        const time = now.toTimeString().split(' ')[0];

        await addHistoryLog({
          type: 'Unauthorized Login Attempt',
          description: `Manager/Admin login form used by ${userProfile.username} with actual role ${userProfile.role}`,
          user: userProfile.username,
          role: userProfile.role,
          userId: userProfile.id,
          timestamp,
          date,
          time,
        });

        setError(`This is not a manager account. Please use the Employee login.`);
        return;
      }

      // Use stored email from profile to authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: userProfile.email,
        password
      });

      if (authError) {
        console.error('[Auth] Sign-in error:', authError);
        if (authError.message.includes('Invalid login credentials')) {
          setError('Incorrect username or password. Please try again.');
        } else {
          setError(`Login failed: ${authError.message}`);
        }
        return;
      }

      // Ensure auth role metadata is synced for Supabase RLS
      if (authData.user) {
        const { error: metadataError } = await supabase.auth.updateUser({
          data: { role: userProfile.role, username }
        });
        if (metadataError) {
          console.warn('[Auth] Failed to sync role metadata for manager/admin login:', metadataError);
        }
      }

      // Store session information
      sessionStorage.setItem('userRole', userProfile.role);
      sessionStorage.setItem('username', username);
      sessionStorage.setItem('userId', userProfile.id);
      sessionStorage.setItem('supabaseSessionToken', authData.session?.access_token || '');

      console.log('✅ [Manager/Admin Login Success]', { username, role: userProfile.role });

      // Determine destination based on role
      const loginType = userProfile.role === 'Administrator' ? 'Administrator Login' : 'Manager Login';
      const destination = userProfile.role === 'Administrator' ? '/admin' : '/manager/dashboard';

      // Log history entry with explicit userId
      const now = new Date();
      const timestamp = now.toISOString();
      const date = now.toISOString().split('T')[0];
      const time = now.toTimeString().split(' ')[0];

      await addHistoryLog({
        type: loginType,
        description: `${userProfile.role} ${username} logged in`,
        user: username,
        role: userProfile.role,
        userId: userProfile.id,
        timestamp,
        date,
        time
      });
      
      navigate(destination);

    } catch (err) {
      console.error('[Auth] Unexpected error during login:', err);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    if (!username || !email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      const supabase = getSupabaseClient();
      
      if (!supabase) {
        setError('System offline. Cannot create account now.');
        return;
      }

      // Check if username already exists
      console.log(`[Manager Signup] Checking duplicate username: "${username}"`);
      const existingUsername = await getUserProfileByUsername(username);
      if (existingUsername) {
        console.warn(`[Manager Signup] ❌ Username duplicate detected: "${username}"`);
        setError(`Username "${username}" is already taken. Please choose another.`);
        return;
      }
      console.log(`[Manager Signup] ✅ Username available: "${username}"`);

      // Check if email already exists
      console.log(`[Manager Signup] Checking duplicate email: "${email}"`);
      const existingEmail = await getUserProfileByEmail(email);
      if (existingEmail) {
        console.warn(`[Manager Signup] ❌ Email duplicate detected: "${email}"`);
        setError(`Email "${email}" is already registered. Please use a different email or login.`);
        return;
      }
      console.log(`[Manager Signup] ✅ Email available: "${email}"`);

      // Sign up new user via Supabase Auth using user-provided email
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email,
        password,
        options: {
          data: {
            username: username,
            role: 'Manager'
          }
        }
      });

      if (signUpError) {
        console.error('[Auth] Sign-up error:', signUpError);
        setError(`Sign-up failed: ${signUpError.message}`);
        return;
      }

      if (!authData.user || !authData.user.id) {
        setError('Failed to create account. Please try again.');
        return;
      }

      // Save user to database
      try {
        await saveUser({
          id: authData.user.id,
          username,
          password_hash: 'SUPABASE_AUTH',
          email,
          role: 'Manager',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } catch (saveError) {
        // Handle database constraint violations
        console.error('[Auth] saveUser error during signup:', saveError.message);
        
        // Rollback: Delete the auth user if database save failed
        if (authData.user?.id) {
          try {
            await supabase.auth.admin.deleteUser(authData.user.id);
            console.log('[Auth] Rolled back Supabase Auth user due to database save failure');
          } catch (rollbackErr) {
            console.warn('[Auth] Failed to rollback auth user:', rollbackErr);
          }
        }
        
        // Show specific error message based on constraint violation
        if (saveError.message.includes('DUPLICATE_USERNAME')) {
          setError(`Username "${username}" is already taken. Please choose another.`);
        } else if (saveError.message.includes('DUPLICATE_EMAIL')) {
          setError(`Email "${email}" is already registered. Please use a different email.`);
        } else {
          setError('Failed to create account. Please try again.');
        }
        return;
      }

      console.log('✅ [Manager Account Created]', { username });

      const now = new Date();
      const timestamp = now.toISOString();
      const date = timestamp.split('T')[0];
      const time = now.toTimeString().split(' ')[0];

      // Set session data BEFORE logging (so user_id is available for history logs)
      sessionStorage.setItem('userRole', 'Manager');
      sessionStorage.setItem('username', username);
      sessionStorage.setItem('userId', authData.user.id);
      sessionStorage.setItem('supabaseSessionToken', authData.session?.access_token || '');

      // Log signup event with explicit userId
      await addHistoryLog({
        type: 'User Signup',
        description: `New Manager account created: ${username}`,
        user: username,
        role: 'Manager',
        userId: authData.user.id,
        timestamp,
        date,
        time
      });

      // Log login event
      await addHistoryLog({
        type: 'Manager Login',
        description: `Manager ${username} logged in`,
        user: username,
        role: 'Manager',
        userId: authData.user.id,
        timestamp,
        date,
        time
      });

      navigate('/manager/dashboard');

    } catch (err) {
      console.error('[Auth] Unexpected error during signup:', err);
      setError('An unexpected error occurred during signup.');
    }
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
              placeholder="Username or Email"
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

        {/* SIGNUP TOGGLE - DISABLED (Uncomment to enable sign-up) */}
        {/* <div className="text-center">
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
        </div> */}

        <button 
          type="submit"
          className="w-full py-5 bg-green-600 text-white rounded-xl text-xl font-bold hover:bg-green-700 shadow-lg hover:shadow-blue-200 transition-all active:scale-[0.98]"
        >
          {/* {isSignup ? 'Create Account' : 'Login to Dashboard'} */}
          Login to Dashboard
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
