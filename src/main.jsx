import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Security: Validate required environment variables at startup
const validateEnvironment = () => {
  const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
  const missing = required.filter(key => !import.meta.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ CRITICAL: Missing required environment variables:', missing.join(', '));
    console.error('This application requires Supabase configuration to function.');
    
    // Show error UI instead of loading app
    const root = document.getElementById('root');
    if (root) {
      root.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          background: #fee;
          font-family: system-ui, -apple-system, sans-serif;
        ">
          <div style="max-width: 500px; text-align: center; padding: 20px;">
            <h1 style="color: #c33; font-size: 24px;">⚠️ Configuration Error</h1>
            <p style="color: #666; font-size: 16px; line-height: 1.5;">
              This application is not properly configured. Missing environment variables:
              <code style="
                display: block;
                background: #f4f4f4;
                padding: 10px;
                margin: 10px 0;
                border-radius: 4px;
                font-family: monospace;
              ">${missing.join(', ')}</code>
            </p>
            <p style="color: #999; font-size: 14px;">
              Please contact your administrator or check the deployment configuration.
            </p>
          </div>
        </div>
      `;
    }
    return false;
  }
  
  console.log('✅ Environment validation passed');
  return true;
};

// Call validation before mounting app
if (!validateEnvironment()) {
  // Don't proceed with app initialization
  throw new Error('Environment validation failed');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
