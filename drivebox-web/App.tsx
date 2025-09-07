
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import Header from './components/Header';
import Footer from './components/Footer';
import { Theme, Language, GoogleUserProfile, NavLinkItem, Translations } from './types'; // Added Translations
import { DEFAULT_THEME, DEFAULT_LANG, NAV_LINKS, ADMIN_NAV_LINKS, GOOGLE_CLIENT_ID, getTranslation } from './constants'; // Added getTranslation
import { ArrowUpIcon, SpinnerIcon } from './components/IconComponents'; // Added SpinnerIcon
import { AdminProvider, useAdmin } from './src/context/AdminContext';

// Pages (assuming they will be created in a 'pages' directory)
import HomePage from './src/pages/HomePage';
import AdminPage from './src/pages/AdminPage';


declare global {
  interface Window {
    google: any;
  }
}

interface DecodedCredential {
  email: string;
  name: string;
  picture: string;
  exp: number;
  iat: number;
  sub: string;
  aud: string; 
  iss: string; 
  nonce?: string; 
}


const ScrollToTopButton: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const location = useLocation();

  const toggleVisibility = useCallback(() => {
    if (window.pageYOffset > 300) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  },[]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, [toggleVisibility]);

  // Hide button on admin page if desired, or based on other conditions
  // For now, it's global. If you want it hidden on /admin, add:
  // if (location.pathname === '/admin') return null;

  return (
    <>
      {isVisible && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-[5000] p-3 rounded-full bg-primary-500 text-white shadow-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-opacity duration-300 animate-fade-in"
          aria-label="Scroll to top"
        >
          <ArrowUpIcon className="w-6 h-6" />
        </button>
      )}
    </>
  );
};

// AppContent will now contain the core logic and pass props to specific pages
const AppContent: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = localStorage.getItem('theme') as Theme | null;
    if (storedTheme) return storedTheme;
    return DEFAULT_THEME; // Default to dark mode
  });

  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('language') as Language | null) || DEFAULT_LANG;
  });
  
  const [userProfile, setUserProfile] = useState<GoogleUserProfile | null>(() => {
    const storedUser = localStorage.getItem('userProfile');
    if (storedUser) {
        try {
            return JSON.parse(storedUser);
        } catch (e) {
            console.error("Error parsing stored user profile:", e);
            localStorage.removeItem('userProfile');
            return null;
        }
    }
    return null;
  });

  const { isAdmin, adminModeActive, checkIsAdmin, toggleAdminMode } = useAdmin(); 

  useEffect(() => {
    checkIsAdmin(userProfile);
  }, [userProfile, checkIsAdmin]);


  const applyTheme = useCallback((newTheme: Theme) => {
    const root = window.document.documentElement;
    root.classList.remove(newTheme === 'dark' ? 'light' : 'dark');
    root.classList.add(newTheme);
    localStorage.setItem('theme', newTheme);
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  const handleToggleTheme = () => {
    document.documentElement.classList.add('theme-transition-override');
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    setTimeout(() => {
        document.documentElement.classList.remove('theme-transition-override');
    }, 500); 
  };

  const handleToggleLanguage = () => {
    setLanguage(prevLang => {
      const newLang = prevLang === 'en' ? 'vi' : 'en';
      localStorage.setItem('language', newLang);
      return newLang;
    });
  };

  useEffect(() => {
    const root = window.document.documentElement;
    const currentDOMTheme = root.classList.contains('dark') ? 'dark' : 'light';
    if (theme !== currentDOMTheme) {
      setTheme(currentDOMTheme);
    }
  }, [theme]);


  useEffect(() => {
    // Google library loading check (can be kept or removed if confident in script loading)
    const checkGoogleLibraryInterval = setInterval(() => {
      if (window.google?.accounts?.id) {
        // console.log("App.tsx: Google Identity Services library reported as loaded by interval check.");
        clearInterval(checkGoogleLibraryInterval);
      }
    }, 1000);
    
    // OAuth callback handling
    const hash = window.location.hash;
    if (hash.includes('access_token=') && hash.includes('id_token=')) {
        const params = new URLSearchParams(hash.substring(1)); 
        const idToken = params.get('id_token');
        
        const storedState = localStorage.getItem('oauth_state');
        const receivedState = params.get('state');
        const storedNonce = localStorage.getItem('oauth_nonce'); 

        if (idToken && storedState && receivedState && storedState === receivedState && storedNonce) {
            try {
                const decoded = jwtDecode<DecodedCredential>(idToken);
                
                if (decoded.aud !== GOOGLE_CLIENT_ID) throw new Error('ID token audience mismatch.');
                if (decoded.iss !== 'https://accounts.google.com' && decoded.iss !== 'accounts.google.com') throw new Error('ID token issuer mismatch.');
                if (!decoded.nonce || decoded.nonce !== storedNonce) throw new Error('ID token nonce mismatch or missing.');

                const profile: GoogleUserProfile = { email: decoded.email, name: decoded.name, picture: decoded.picture };
                setUserProfile(profile);
                localStorage.setItem('userProfile', JSON.stringify(profile));
                checkIsAdmin(profile);
                // console.log("App.tsx: User profile set from OAuth callback.");
            } catch (error) {
                console.error('App.tsx: Error decoding/validating ID token from OAuth callback:', error);
            } finally {
                localStorage.removeItem('oauth_state');
                localStorage.removeItem('oauth_nonce'); 
                window.history.replaceState(null, "", window.location.pathname + window.location.search);
            }
        } else if (idToken) {
            console.error("App.tsx: OAuth state or nonce mismatch/missing for OAuth callback.");
            localStorage.removeItem('oauth_state'); 
            localStorage.removeItem('oauth_nonce');
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
    }
    return () => clearInterval(checkGoogleLibraryInterval);
  }, [checkIsAdmin]);


  const handleGoogleLoginSuccess = useCallback((credentialResponse: any) => {
    try {
      const decoded = jwtDecode<DecodedCredential>(credentialResponse.credential);
      const profile: GoogleUserProfile = { email: decoded.email, name: decoded.name, picture: decoded.picture };
      setUserProfile(profile);
      localStorage.setItem('userProfile', JSON.stringify(profile));
      checkIsAdmin(profile);
      // console.log("App.tsx: User profile set from GSI callback.");
    } catch (error) {
      console.error('App.tsx: Error decoding ID token from GSI callback:', error);
    }
  }, [checkIsAdmin]);

  const handleGoogleLogout = useCallback(() => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
      // console.log("App.tsx: Google auto select disabled.");
    }
    setUserProfile(null);
    localStorage.removeItem('userProfile');
    checkIsAdmin(null);
    // console.log("App.tsx: User logged out.");
  }, [checkIsAdmin]);


  return (
    <div className={`min-h-screen flex flex-col font-sans bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 transition-colors duration-500`}>
      <Router>
        <Routes>
          <Route path="/" element={
            <HomePage 
              theme={theme}
              toggleTheme={handleToggleTheme}
              language={language}
              toggleLanguage={handleToggleLanguage}
              userProfile={userProfile}
              onGoogleLoginSuccess={handleGoogleLoginSuccess}
              onGoogleLogout={handleGoogleLogout}
              isAdmin={isAdmin} // Pass from context
              adminModeActive={adminModeActive} // Pass from context
            />
          } />
          <Route path="/admin" element={
            <AdminPage
              theme={theme}
              toggleTheme={handleToggleTheme}
              language={language}
              toggleLanguage={handleToggleLanguage}
              userProfile={userProfile}
              onGoogleLoginSuccess={handleGoogleLoginSuccess}
              onGoogleLogout={handleGoogleLogout}
              // isAdmin and adminModeActive are accessed via useAdmin in AdminPage itself
            />
          } />
          {/* Fallback route for any other path */}
          <Route path="*" element={<Navigate to="/" replace />} /> 
        </Routes>
        <ScrollToTopButton />
      </Router>
    </div>
  );
};

const App: React.FC = () => {
  const initialUserProfile = (): GoogleUserProfile | null => {
    const storedUser = localStorage.getItem('userProfile');
    if (storedUser) {
      try {
        return JSON.parse(storedUser);
      } catch (e) { return null; }
    }
    return null;
  };

  return (
    <AdminProvider userProfile={initialUserProfile()}>
      <AppContent />
    </AdminProvider>
  );
};

export default App;