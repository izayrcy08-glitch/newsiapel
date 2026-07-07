import { useEffect, useState } from "react";
import { getAuth, signInAnonymously } from "firebase/auth";

/**
 * AuthInit — Anonymous Firebase Auth with retry logic
 *
 * Waits for auth BEFORE rendering children.
 * - authReady = false: render LoadingSpinner
 * - authReady = true: render children
 * - Retry up to 3 times if auth fails
 * Prevents permission_denied by ensuring auth is ready before FirebaseDataContext subscribes.
 */
export function AuthInit({ children }) {
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  useEffect(() => {
    if (retryCount >= MAX_RETRIES) {
      setAuthError("Auth failed after 3 attempts. Please refresh the page.");
      console.error("❌ [AuthInit] Max retries reached");
      return;
    }

    const initAuth = async () => {
      try {
        const auth = getAuth();
        await signInAnonymously(auth);
        console.log("✅ [AuthInit] Anonymous auth initialized successfully");
        setAuthReady(true);
        setAuthError(null);
      } catch (err) {
        console.error("❌ [AuthInit] Firebase anonymous auth failed:", err.message);
        setAuthError(err.message);
        setRetryCount(prev => prev + 1);
        setTimeout(initAuth, 2000);
      }
    };

    initAuth();
  }, [retryCount]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500/20 border-t-emerald-500" />
          </div>
          <p className="text-slate-300 font-medium">
            {authError ? `Retrying authentication...` : `Initializing...`}
          </p>
          {authError && (
            <p className="text-slate-500 text-sm mt-2">{authError}</p>
          )}
        </div>
      </div>
    );
  }

  return children;
}
