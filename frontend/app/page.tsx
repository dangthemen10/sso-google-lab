/**
 * Login Page — the only public page of the application.
 *
 * Clicking "Continue with Google" navigates the browser to
 * /api/be/oauth2/authorization/google, which Next.js rewrites proxy to
 * http://localhost:8080/oauth2/authorization/google.
 * Spring Security then issues a 302 redirect to Google's consent screen.
 */

// Google "G" SVG logo
function GoogleLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const hasError = searchParams.error === 'true';

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-indigo-100">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-sm">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to continue</p>
        </div>

        {/* Error Banner */}
        {hasError && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm mb-6">
            Authentication failed. Please try again.
          </div>
        )}

        {/* Google SSO Button */}
        <a
          href="/api/be/oauth2/authorization/google"
          className="flex items-center justify-center gap-3 w-full py-3 px-4 border border-gray-200 rounded-xl text-gray-700 font-medium text-sm hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm">
          <GoogleLogo />
          Continue with Google
        </a>

        <p className="text-center text-xs text-gray-400 mt-6">
          By signing in you agree to our Terms of Service.
        </p>
      </div>
    </main>
  );
}
