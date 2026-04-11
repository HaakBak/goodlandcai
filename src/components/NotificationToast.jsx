import React, { useEffect, useState } from 'react';

/**
 * NotificationToast Component
 * 
 * Displays inventory notifications with categorization:
 * - CRITICAL (warning): Out of stock (0 items) - Red, longer duration
 * - MINIMAL (minimal): Low stock alert - Orange/Yellow, standard duration
 * - INFO (info): General information - Blue, standard duration
 * 
 * Each notification displays:
 * - Category indicator with appropriate color
 * - Item name and stock information
 * - Timestamp (date and time)
 * - Auto-dismisses after set duration
 */

const NotificationToast = () => {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const handleShowToast = (event) => {
      // Extract notification data from the custom event
      const notificationData = event.detail;
      
      console.log('🔔 [Toast Received]', notificationData);
      setToast(notificationData);
      
      // Auto hide after duration:
      // - Custom duration if provided (e.g., 10000ms for delete confirmations)
      // - CRITICAL alerts: 6 seconds (more important, needs attention)
      // - MINIMAL/INFO: 4 seconds (standard)
      let duration = 4000;
      
      if (notificationData.duration) {
        duration = notificationData.duration; // Use custom duration if provided
      } else if (notificationData.category === 'CRITICAL') {
        duration = 6000;
      } else if (notificationData.category === 'MINIMAL') {
        duration = 4000;
      }
      
      const timer = setTimeout(() => {
        setToast(null);
      }, duration);

      // Cleanup timer if component unmounts
      return () => clearTimeout(timer);
    };

    window.addEventListener('SHOW_TOAST', handleShowToast);
    
    return () => {
      window.removeEventListener('SHOW_TOAST', handleShowToast);
    };
  }, []);

  if (!toast) return null;

  // Determine styling based on notification type/category
  const isCritical = toast.type === 'warning' || toast.category === 'CRITICAL';
  const isMinimal = toast.category === 'MINIMAL';
  const isSuccess = toast.type === 'success' || toast.category === 'INVENTORY_DELETE';
  const isError = toast.type === 'error' || toast.category === 'INVENTORY_DELETE_ERROR';

  // Color scheme for different notification types
  const bgColor = isSuccess
    ? 'bg-green-100' // Success: Green background
    : isError
    ? 'bg-red-100' // Error: Red background
    : isCritical
    ? 'bg-red-100' // Critical alerts: Red background
    : isMinimal
    ? 'bg-amber-100' // Minimal alerts: Amber/Orange background
    : 'bg-blue-100'; // Info: Blue background

  const textColor = isSuccess
    ? 'text-green-900'
    : isError
    ? 'text-red-900'
    : isCritical
    ? 'text-red-900'
    : isMinimal
    ? 'text-amber-900'
    : 'text-blue-900';

  const iconBgColor = isSuccess
    ? 'bg-green-600'
    : isError
    ? 'bg-red-600'
    : isCritical
    ? 'bg-red-600'
    : isMinimal
    ? 'bg-amber-600'
    : 'bg-blue-600';

  const borderColor = isSuccess
    ? 'border-green-400'
    : isError
    ? 'border-red-400'
    : isCritical
    ? 'border-red-400'
    : isMinimal
    ? 'border-amber-400'
    : 'border-blue-400';

  // Format timestamp display
  const timeDisplay = toast.time || new Date(toast.timestamp).toTimeString().split(' ')[0];
  const dateDisplay = toast.date || new Date(toast.timestamp).toISOString().split('T')[0];

  return (
    <div className={`fixed bottom-6 right-6 z-50 ${(isCritical && !isSuccess) ? 'animate-pulse' : 'animate-bounce'}`}>
      <div className={`p-4 rounded-xl shadow-2xl flex items-start gap-3 min-w-[320px] border-2 ${
        borderColor
      } ${bgColor} ${textColor}`}>
        
        {/* Icon Container - Different icon for different notification types */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${
          iconBgColor
        }`}>
          {isSuccess ? '✅' : isError ? '❌' : isCritical ? '⚠️' : isMinimal ? '📉' : 'ℹ️'}
        </div>

        {/* Content Container */}
        <div className="flex-1">
          {/* Category Badge */}
          <h4 className="font-bold text-sm mb-1">
            {isSuccess
              ? '✓ SUCCESS'
              : isError
              ? '✕ ERROR'
              : isCritical
              ? '🚨 CRITICAL WARNING'
              : isMinimal
              ? '⚡ MINIMAL ALERT'
              : 'ℹ️ Info'}
          </h4>
          
          {/* Message */}
          <p className="text-sm font-medium mb-2">{toast.message}</p>

          {/* Timestamp Footer */}
          <div className="text-xs opacity-75 flex items-center gap-2">
            <span>📅 {dateDisplay}</span>
            <span>🕐 {timeDisplay}</span>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={() => setToast(null)}
          className="flex-shrink-0 text-lg opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Close notification"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default NotificationToast;