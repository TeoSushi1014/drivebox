
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Theme, Language, GoogleUserProfile, NavLinkItem } from '../../types'; // Adjusted path
import MainSections from '../../components/MainSections'; // Adjusted path
import Header from '../../components/Header'; // Adjusted path
import Footer from '../../components/Footer'; // Adjusted path
import LiquidEther from '../../components/LiquidEther'; // Added LiquidEther
import { NAV_LINKS, ADMIN_NAV_LINKS } from '../../constants'; // Adjusted path
import { useAdmin } from '../context/AdminContext'; // Adjusted path

interface HomePageProps {
  language: Language;
  theme: Theme;
  toggleTheme: () => void;
  toggleLanguage: () => void;
  userProfile: GoogleUserProfile | null;
  onGoogleLoginSuccess: (credentialResponse: any) => void;
  onGoogleLogout: () => void;
  isAdmin: boolean; 
  adminModeActive: boolean;
}

const HomePage: React.FC<HomePageProps> = ({ 
  language, 
  theme, 
  toggleTheme, 
  toggleLanguage,
  userProfile,
  onGoogleLoginSuccess,
  onGoogleLogout,
  isAdmin,
  adminModeActive
}) => {
  const [activeSection, setActiveSection] = useState<string | null>(NAV_LINKS[0]?.href.substring(1) || null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  // const { isAdmin, adminModeActive } = useAdmin(); // Already passed as props

  // Determine current navigation links based on admin status for sectionRefs
  const currentNavLinks = isAdmin && adminModeActive 
    ? [...NAV_LINKS] // Admin link is a page route, not a section on home
    : NAV_LINKS;

  useEffect(() => {
    // Initialize sectionRefs based on currentNavLinks
    // We only care about hash links for scrolling on the home page.
    sectionRefs.current = NAV_LINKS.map(link => {
        if (link.href.startsWith('#')) {
            return document.getElementById(link.href.substring(1));
        }
        return null;
    }).filter(ref => ref !== null);

    const handleScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight / 2.5; // Adjusted for better accuracy
      let newActiveSection: string | null = null;

      sectionRefs.current.forEach(section => {
        if (section) {
          // Check if section is in viewport
          const sectionTop = section.offsetTop;
          const sectionBottom = sectionTop + section.offsetHeight;
          if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
            newActiveSection = section.id;
          }
        }
      });
      
      // If no section is actively in the middle, check for edge cases
      if (!newActiveSection) {
        if ((window.innerHeight + Math.ceil(window.scrollY)) >= document.body.offsetHeight - 2) { // At bottom
          const lastSection = sectionRefs.current[sectionRefs.current.length -1];
          if (lastSection) newActiveSection = lastSection.id;
        } else if (window.scrollY < window.innerHeight / 3 && sectionRefs.current[0]) { // At top
           newActiveSection = sectionRefs.current[0].id;
        }
      }
      
      if (newActiveSection !== activeSection) {
        setActiveSection(newActiveSection);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeSection, currentNavLinks]); // Rerun if nav links change (admin mode) or activeSection for comparison

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Liquid Ether Background */}
      <div className="fixed inset-0 z-0">
        <LiquidEther
          style={{ width: '100%', height: '100%' }}
          colors={theme === 'dark' ? ['#1a1a2e', '#16213e', '#0f3460'] : ['#667eea', '#764ba2', '#f093fb']}
          mouseForce={15}
          cursorSize={150}
        />
      </div>
      
      {/* Content with backdrop */}
      <div className="relative z-10 min-h-screen flex flex-col backdrop-blur-sm bg-white/5 dark:bg-black/10">
        <Header
          theme={theme}
          toggleTheme={toggleTheme}
          language={language}
          toggleLanguage={toggleLanguage}
          activeSection={activeSection} // For highlighting nav links on HomePage
          userProfile={userProfile}
          onGoogleLoginSuccess={onGoogleLoginSuccess}
          onGoogleLogout={onGoogleLogout}
          isAdmin={isAdmin}
          adminModeActive={adminModeActive}
        />
        <main className="pt-20">
          <MainSections language={language} />
        </main>
        <Footer language={language} />
      </div>
    </div>
  );
};

export default HomePage;