
import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom'; // Import Link and useLocation
import { NAV_LINKS, ADMIN_NAV_LINKS, getTranslation, GOOGLE_CLIENT_ID } from '../constants';
import { Theme, Language, NavLinkItem, Translations, GoogleUserProfile } from '../types';
import { LanguageIconImg, MenuIcon, UserIcon, GoogleIcon } from './IconComponents';
import ThemeSwitch from './ThemeSwitch';
import { useAdmin } from '../src/context/AdminContext';

declare global {
  interface Window {
    google: any;
  }
}

interface HeaderProps {
  theme: Theme;
  toggleTheme: () => void;
  language: Language;
  toggleLanguage: () => void;
  activeSection: string | null; // Can be section ID for HomePage or "admin" for AdminPage
  userProfile: GoogleUserProfile | null;
  onGoogleLoginSuccess: (credentialResponse: any) => void;
  onGoogleLogout: () => void;
  isAdmin: boolean; 
  adminModeActive: boolean; 
}

const Header: React.FC<HeaderProps> = ({ 
  theme, toggleTheme, language, toggleLanguage, activeSection,
  userProfile, onGoogleLoginSuccess, onGoogleLogout,
  isAdmin, adminModeActive 
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const googleSignInButtonRef = useRef<HTMLDivElement>(null);

  const { toggleAdminMode } = useAdmin(); 
  const location = useLocation(); // Get current location

  const t = <K1 extends keyof Translations, K2 extends keyof Translations[K1]>(key1: K1, key2: K2) => getTranslation(language, key1, key2) as string;
  const tAdminNav = (key: keyof Translations['admin']) => getTranslation(language, 'admin', key) as string;
  const tLogin = (key: keyof Translations['login']) => getTranslation(language, 'login', key) as string;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
      const mobileMenu = document.getElementById('mobile-menu-content');
      const mobileMenuBtn = document.getElementById('mobileMenuBtn');
      if (mobileMenu && !mobileMenu.contains(event.target as Node) && mobileMenuBtn && !mobileMenuBtn.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let intervalId: number | undefined; 
    const startGsiPolling = () => {
        let attempts = 0;
        const maxAttempts = 20;
        intervalId = window.setInterval(() => { 
            attempts++;
            if (typeof window.google !== 'undefined' && 
                window.google.accounts && 
                window.google.accounts.id &&
                typeof window.google.accounts.id.initialize === 'function'
            ) {
                if (intervalId !== undefined) window.clearInterval(intervalId);
                intervalId = undefined;
                initializeGoogleServices();
            } else if (attempts >= maxAttempts) {
                if (intervalId !== undefined) window.clearInterval(intervalId); 
                intervalId = undefined;
                console.error("Header.tsx: Google Identity Services library did not become ready for initialization after multiple attempts.");
            }
        }, 500);
    }
    
    const initializeGoogleServices = () => {
        window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: onGoogleLoginSuccess,
            use_fedcm_for_prompt: true, 
        });
    };

    const handleDomReady = () => {
      document.removeEventListener('DOMContentLoaded', handleDomReady);
      startGsiPolling();
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        startGsiPolling();
    } else {
        document.addEventListener('DOMContentLoaded', handleDomReady);
    }
    
    return () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId); 
      }
      document.removeEventListener('DOMContentLoaded', handleDomReady); 
    }
  }, [onGoogleLoginSuccess]); 
  
  const getNavLinkClasses = (href: string) => {
    // For homepage hash links
    if (href.startsWith('#')) {
        return `nav-link ${href === `#${activeSection}` ? 'active-nav-link' : ''}`;
    }
    // For admin page link or other future page links
    return `nav-link ${location.pathname === href ? 'active-nav-link' : ''}`;
  };

  const renderNavLinks = (isMobile: boolean = false) => {
    const baseLinks = NAV_LINKS.map((link: NavLinkItem) => (
      <a 
        key={link.href} 
        href={link.href} // These are hash links for HomePage scrolling
        className={getNavLinkClasses(link.href)}
        onClick={() => isMobile && setIsMobileMenuOpen(false)}
      >
        {t('nav', link.textKey as keyof Translations['nav'])}
      </a>
    ));

    if (isAdmin && adminModeActive) {
      const adminLink = ADMIN_NAV_LINKS[0];
      baseLinks.push(
        <Link 
          key={adminLink.href}
          to={adminLink.href} // Navigate to /admin
          className={getNavLinkClasses(adminLink.href)}
          onClick={() => isMobile && setIsMobileMenuOpen(false)}
        >
          {tAdminNav(adminLink.textKey as keyof Translations['admin'])}
        </Link>
      );
    }
    return baseLinks;
  };


  const handleLogoutClick = () => {
    onGoogleLogout();
    setIsProfileDropdownOpen(false);
  }

  const initiateStandardOAuth = () => {
    try {
        const redirectUri = encodeURIComponent(window.location.origin);
        const scope = encodeURIComponent('email profile openid'); 
        const responseType = 'token id_token'; 
        
        const state = Math.random().toString(36).substring(2);
        localStorage.setItem('oauth_state', state);

        const nonce = Math.random().toString(36).substring(2); 
        localStorage.setItem('oauth_nonce', nonce); 

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=${responseType}&scope=${scope}&state=${state}&nonce=${nonce}&prompt=select_account`;
      
        window.location.href = authUrl;
    } catch (error) {
        console.error("Header.tsx: Error initiating standard OAuth:", error);
    }
  };


  return (
    <header className="fixed top-0 left-0 right-0 z-[5000] px-4 py-4">
      <nav className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between px-6 py-3 bg-white/5 dark:bg-gray-900/5 backdrop-blur-lg rounded-2xl border border-white/20 dark:border-gray-700/20 shadow-[0_0_0_1.5px_rgba(0,0,0,0.08)]">
          <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent hover:scale-105 transition-all duration-200 relative" style={{textShadow: '0 0 20px rgba(14, 165, 233, 0.3), 0 0 40px rgba(236, 72, 153, 0.2)'}}>
            Tèo Sushi
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            {renderNavLinks()}
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <button 
              onClick={toggleLanguage}
              className="group p-2 rounded-xl hover:bg-white/10 dark:hover:bg-gray-800/30 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex items-center"
              aria-label={language === 'en' ? 'Switch to Vietnamese' : 'Switch to English'}
            >
              <LanguageIconImg className="w-5 h-5 transform transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:scale-110" />
              <span className="ml-1.5 text-xs font-bold text-primary-500 dark:text-primary-400 transform transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:scale-105">
                {language === 'en' ? 'EN' : 'VI'}
              </span>
            </button>

            <div className="p-2 flex items-center justify-center">
                 <ThemeSwitch theme={theme} toggleTheme={toggleTheme} />
            </div>
           

            <div className="relative" ref={profileDropdownRef}>
              <button 
                onClick={() => setIsProfileDropdownOpen(prev => !prev)}
                className="avatar-container group"
                aria-expanded={isProfileDropdownOpen}
                aria-controls="profile-dropdown-menu"
              >
                <div className="avatar-content">
                  {userProfile ? (
                    <img src={userProfile.picture} alt={userProfile.name} className="avatar-image" />
                  ) : (
                     <UserIcon className="avatar-image p-1.5 text-primary-500 dark:text-primary-400" />
                  )}
                </div>
              </button>
              
              {isProfileDropdownOpen && (
                <div 
                  id="profile-dropdown-menu"
                  className="absolute right-0 mt-2 w-64 rounded-xl overflow-hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg shadow-lg border border-white/20 dark:border-gray-700/20 z-[9999] animate-fade-in"
                >
                  {userProfile ? (
                    <div className="p-4">
                      <div className="flex items-center mb-3">
                        <img src={userProfile.picture} alt={userProfile.name} className="w-10 h-10 rounded-full mr-3" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{userProfile.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{userProfile.email}</p>
                        </div>
                      </div>
                      {isAdmin && ( 
                        <>
                          <button
                            onClick={() => {
                              toggleAdminMode(); // Toggle admin mode state
                              // This button now primarily toggles mode, navigation is separate
                              setIsProfileDropdownOpen(false); 
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md flex items-center"
                          >
                            <i className={`fas ${adminModeActive ? 'fa-user-secret' : 'fa-user-shield'} mr-2`}></i>
                            {adminModeActive ? tLogin('exitAdminMode') : tLogin('adminMode')}
                          </button>
                          {adminModeActive && (
                             <Link
                                to="/admin"
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md flex items-center mt-1"
                                onClick={() => setIsProfileDropdownOpen(false)}
                              >
                                <i className="fas fa-tachometer-alt mr-2"></i> 
                                {tLogin('adminPageLink')}
                              </Link>
                          )}
                        </>
                      )}
                      <button
                        onClick={handleLogoutClick}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md flex items-center mt-1"
                      >
                        <i className="fas fa-sign-out-alt mr-2"></i>
                        {tLogin('signOut')}
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 flex flex-col items-center">
                       <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{tLogin('myProfile')}</p>
                       <div ref={googleSignInButtonRef} id="googleSignInButtonContainer" className="mb-2"></div>
                        <button 
                            onClick={initiateStandardOAuth} 
                            className="btn-secondary !px-4 !py-2 text-sm flex items-center gap-2"
                            aria-label={tLogin('signInWithGoogle')}
                        >
                            <GoogleIcon className="w-5 h-5" />
                            {tLogin('signInWithGoogle')}
                        </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button 
              id="mobileMenuBtn"
              onClick={() => setIsMobileMenuOpen(prev => !prev)}
              className="md:hidden relative p-2 rounded-xl hover:bg-white/10 dark:hover:bg-gray-800/30 transition-colors duration-200"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu-content"
            >
              <MenuIcon className="w-6 h-6 text-primary-500 transform transition-transform duration-200" />
            </button>          
          </div>
        </div>

        {isMobileMenuOpen && (
          <div id="mobile-menu-content" className="md:hidden mt-2 animate-slide-down">
            <div className="mx-auto p-4 bg-white/5 dark:bg-gray-900/5 backdrop-blur-lg rounded-2xl border border-white/20 dark:border-gray-700/20">
              <div className="flex flex-col space-y-4">
                {renderNavLinks(true)}
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Header;