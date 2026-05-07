import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import LogoutButton from './LogoutButton';

interface UserInfo {
  name: string;
  email: string;
  picture: string;
}

/**
 * Server-side fetch of the authenticated user's profile.
 *
 * This runs on the Next.js server (Node.js), NOT in the browser, so:
 *  - It calls the internal BE address directly (http://localhost:8080) — no proxy needed.
 *  - It reads the JSESSIONID from the incoming browser request (via cookies())
 *    and forwards it to Spring Boot so the session is recognised.
 *  - HttpOnly cookies ARE accessible here because this is server-side code.
 */
// In Docker the BE runs on the "backend" service hostname, not localhost.
// BE_INTERNAL_URL is injected by docker-compose; falls back to localhost for local dev.
const BE_INTERNAL_URL = process.env.BE_INTERNAL_URL || 'http://localhost:8080';

async function fetchUserInfo(): Promise<UserInfo | null> {
  const cookieStore = cookies();
  const jsessionid = cookieStore.get('JSESSIONID');

  // No session cookie → not authenticated
  if (!jsessionid) return null;

  try {
    const res = await fetch(`${BE_INTERNAL_URL}/user/me`, {
      headers: {
        // Forward the session cookie so Spring Security can resolve the principal.
        Cookie: `JSESSIONID=${jsessionid.value}`,
      },
      // Never cache — always reflect the current session state.
      cache: 'no-store',
    });

    if (!res.ok) return null;
    return res.json();
  } catch {
    // BE is unreachable (e.g. not started yet)
    return null;
  }
}

export default async function DashboardPage() {
  const user = await fetchUserInfo();

  // Guard: unauthenticated or session expired → back to login
  if (!user) redirect('/');

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-indigo-100">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-sm">
        {/* User Avatar */}
        <div className="flex flex-col items-center text-center">
          {user.picture ? (
            <Image
              src={user.picture}
              alt={user.name}
              width={88}
              height={88}
              className="rounded-full ring-4 ring-indigo-100 mb-4"
              priority
            />
          ) : (
            <div className="w-22 h-22 rounded-full bg-indigo-200 flex items-center justify-center mb-4 text-indigo-600 text-3xl font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Name & Email */}
          <h1 className="text-xl font-bold text-gray-900">{user.name}</h1>
          <p className="text-gray-500 text-sm mt-1">{user.email}</p>

          {/* Auth badge */}
          <span className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Authenticated via Google SSO
          </span>
        </div>

        {/* Divider + Logout */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
