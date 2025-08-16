// src/App.js
import { useEffect, useState } from 'react';
import supabase from './lib/supabaseClient';
import AuthForm from './components/auth/AuthForm';
import HealthUpload from './components/upload/HealthUpload';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // Listen to auth changes (login/logout)
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <h1>📊 VitaLogs</h1>
      {user ? (
        <>
          <HealthUpload user={user} />
          <button onClick={() => supabase.auth.signOut()}>Log Out</button>
        </>
      ) : (
        <AuthForm />
      )}
    </div>
  );
}

export default App;
