'use client';
import { getClientAuthToken } from '@/lib/client';
import { LAST_TEAM_CONFIG } from '@/lib/constants';
import { getItem } from '@/lib/storage';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function nextPath() {
  const basePath = process.env.basePath || '';
  const lastTeam = getItem(LAST_TEAM_CONFIG);

  // Without a token we already know the user is logged out; skip the /websites.
  if (!process.env.cloudMode && !getClientAuthToken()) {
    return `${basePath}/login`;
  }

  if (lastTeam) {
    return `${basePath}/teams/${lastTeam}/websites`;
  }

  return `${basePath}/websites`;
}

// Runs from the first HTML payload. The React redirect below never paints when the
// client bundle fails, and this route otherwise renders nothing.
const redirectScript = `(function(){try{var read=function(key){try{var value=localStorage.getItem(key);if(value==null||value==="undefined")return null;return JSON.parse(value)}catch(e){return null}};var base=${JSON.stringify(process.env.basePath || '')};var cloud=${process.env.cloudMode ? 'true' : 'false'};var token=read("umami.auth");var team=read("umami.last-team");var dest=(!cloud&&!token)?base+"/login":team?base+"/teams/"+team+"/websites":base+"/websites";if(location.pathname!==dest)location.replace(dest)}catch(e){}})()`;

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(nextPath());
  }, [router]);

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: redirectScript }} />
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          color: '#333',
          background: '#fff',
        }}
      >
        <a href={`${process.env.basePath || ''}/login`}>Umami</a>
      </div>
    </>
  );
}
