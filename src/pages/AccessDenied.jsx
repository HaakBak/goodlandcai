import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft, Home } from 'lucide-react';
import { getUserRole } from '../services/privilegeService';

/**
 * AccessDenied Component
 * 
 * Displays when a user tries to access a page they don't have privilege to view.
 */
const AccessDenied = () => {
  const navigate = useNavigate();
  const userRole = getUserRole();

  // If no user is logged in, they should go back to login
  if (!userRole) {
    return (
      <div className="w-full flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-red-100 p-6">
        <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-md w-full text-center">
          {/* Lock Icon */}
          <div className="flex justify-center mb-6">
            <div className="bg-red-100 p-6 rounded-full">
              <Lock size={48} className="text-red-600" />
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Access Denied</h1>
          <p className="text-gray-600 mb-8">
            You must be logged in to access this page. Please log in first.
          </p>

          {/* Button */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-bold hover:bg-blue-700 transition-all"
          >
            <Home size={20} />
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-red-100 p-6">
      <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-md w-full">
        {/* Lock Icon */}
        <div className="flex justify-center mb-6">
          <div className="bg-red-100 p-6 rounded-full">
            <Lock size={48} className="text-red-600" strokeWidth={1.5} />
          </div>
        </div>

        {/* Main Content */}
        <h1 className="text-3xl font-bold text-gray-900 mb-3 text-center">Access Denied</h1>

        {/* Message */}
        <p className="text-center text-gray-600 mb-8">
          You cannot access this content.
        </p>

        {/* Action Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-bold hover:bg-blue-700 transition-all"
        >
          <ArrowLeft size={20} />
          Go Back
        </button>
      </div>
    </div>
  );
};

export default AccessDenied;
