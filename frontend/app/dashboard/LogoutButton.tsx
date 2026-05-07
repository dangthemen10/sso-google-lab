'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Client component — needs interactivity (onClick, useState).
 *
 * Calls POST /api/be/logout (proxied to Spring Boot /logout).
 * Spring Boot invalidates the session, deletes the JSESSIONID cookie,
 * and returns a redirect. We then push the browser to "/" via the router.
 */
export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      // Spring Boot /logout invalidates the server-side session.
      // The proxy forwards this POST to http://localhost:8080/logout.
      await fetch('/api/be/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      // Redirect to login page and flush the Next.js router cache.
      router.push('/');
      router.refresh();
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="w-full py-2.5 px-4 rounded-xl bg-red-50 text-red-600 font-medium text-sm
                 hover:bg-red-100 transition-colors duration-200
                 disabled:opacity-50 disabled:cursor-not-allowed">
      {loading ? 'Signing out…' : 'Sign Out'}
    </button>
  );
}
