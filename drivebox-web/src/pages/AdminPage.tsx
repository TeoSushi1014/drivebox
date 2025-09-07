
import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Language, Theme, GoogleUserProfile, Translations } from '../../types'; // Adjusted path, added Translations
import AdminPanel from '../../components/AdminPanel'; // Adjusted path
import Header from '../../components/Header'; // Adjusted path
import Footer from '../../components/Footer'; // Adjusted path
import { useAdmin } from '../context/AdminContext'; // Adjusted path
import { SpinnerIcon } from '../../components/IconComponents'; // Adjusted path
import { getTranslation } from '../../constants'; // Adjusted path


interface AdminPageProps {
  language: Language;
  theme: Theme;
  toggleTheme: () => void;
  toggleLanguage: () => void;
  userProfile: GoogleUserProfile | null;
  onGoogleLoginSuccess: (credentialResponse: any) => void;
  onGoogleLogout: () => void;
  // isAdmin and adminModeActive will be sourced from useAdmin within this component
}

const AdminPage: React.FC<AdminPageProps> = ({
  language,
  theme,
  toggleTheme,
  toggleLanguage,
  userProfile,
  onGoogleLoginSuccess,
  onGoogleLogout
}) => {
  const { isAdmin, adminModeActive } = useAdmin();
  const [isLoading, setIsLoading] = useState(true);

  const tAdmin = (key: keyof Translations['admin']) => getTranslation(language, 'admin', key) as string;

  useEffect(() => {
    // Simulate admin data loading or any setup needed for the admin page
    const loadAdminData = async () => {
      // Ensure admin mode is active; if not, it might take a tick for context to update
      // This check is more for the loading sim than strict auth, which is next.
      if(isAdmin && adminModeActive) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
      }
      setIsLoading(false);
    };
    
    loadAdminData();
  }, [isAdmin, adminModeActive]);

  // Redirect if not admin or not in admin mode
  // This check ensures that even if the route is accessed directly,
  // non-admins or those not in admin mode are redirected.
  if (!isLoading && (!isAdmin || !adminModeActive)) {
    return <Navigate to="/" replace />;
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <Header
          theme={theme}
          toggleTheme={toggleTheme}
          language={language}
          toggleLanguage={toggleLanguage}
          activeSection="admin" // Keep "admin" link highlighted
          userProfile={userProfile}
          onGoogleLoginSuccess={onGoogleLoginSuccess}
          onGoogleLogout={onGoogleLogout}
          isAdmin={isAdmin} // Pass current admin state for header UI
          adminModeActive={adminModeActive} // Pass current mode for header UI
        />
        <main className="flex-grow pt-24 pb-12 flex items-center justify-center">
          <div className="glass-card p-8 text-center">
            <div className="flex flex-col items-center space-y-4">
              <SpinnerIcon className="w-12 h-12 text-primary-500" />
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                {tAdmin('loadingAdminDashboard')}
              </p>
            </div>
          </div>
        </main>
        <Footer language={language} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header
        theme={theme}
        toggleTheme={toggleTheme}
        language={language}
        toggleLanguage={toggleLanguage}
        activeSection="admin" // Keep "admin" link highlighted
        userProfile={userProfile}
        onGoogleLoginSuccess={onGoogleLoginSuccess}
        onGoogleLogout={onGoogleLogout}
        isAdmin={isAdmin}
        adminModeActive={adminModeActive}
      />
      <main className="flex-grow pt-28 pb-12"> {/* Increased pt slightly for more space below header */}
        <div className="container mx-auto px-4">
          <AdminPanel language={language} />
        </div>
      </main>
      <Footer language={language} />
    </div>
  );
};

export default AdminPage;