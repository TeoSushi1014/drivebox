
import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../src/context/AdminContext'; 
import { Language, Translations, Project, ProjectFormData } from '../types';
import { ADMIN_EMAIL, getTranslation, PROJECTS_DATA } from '../constants';
import { SpinnerIcon, PlusIcon, PencilIcon, TrashIcon, XIcon } from './IconComponents';

interface AdminSettings {
  siteTitle: string;
  metaDescription: string;
  googleAnalyticsId: string;
}

interface MockMessage {
  id: number;
  name: string;
  email: string;
  message: string;
  date: string;
}

const mockMessages: MockMessage[] = [
  { id: 1, name: 'John Doe', email: 'john@example.com', message: 'I love your work! Keep it up, fantastic design and projects. This is a slightly longer message to test truncation and full view.', date: '2024-06-02' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', message: 'Would like to discuss a potential project collaboration. Your skills in React are impressive.', date: '2024-06-01' },
];

const mockAnalytics = {
  visitors: 1245,
  pageViews: 3789,
  averageTime: '2:45',
  bounceRate: '35%',
  topCountries: [ { name: 'United States', percentage: 40, flag: '🇺🇸' }, { name: 'Vietnam', percentage: 25, flag: '🇻🇳' } ],
};

const defaultSettings: AdminSettings = {
  siteTitle: "Tèo Sushi | Creative Developer",
  metaDescription: "Tèo Sushi - Creative Developer specializing in modern web experiences and crafting digital solutions.",
  googleAnalyticsId: "G-0SP499VN6X",
};

const initialProjectFormState: ProjectFormData = {
  id: '',
  titleKey: '',
  descriptionKey: '',
  image: '',
  liveLink: '',
  repoLink: '',
  tags: [],
  isVisible: true,
};


interface AdminPanelProps {
  language: Language;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ language }) => {
  const { isAdmin, adminModeActive } = useAdmin();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'messages' | 'settings' | 'projects'>('dashboard');
  
  const [settings, setSettings] = useState<AdminSettings>(defaultSettings);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSaveStatus, setSettingsSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  const [selectedMessage, setSelectedMessage] = useState<MockMessage | null>(null);

  // Project Management State
  const [projects, setProjectsState] = useState<Project[]>([]);
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [projectForm, setProjectForm] = useState<ProjectFormData>(initialProjectFormState);
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);
  const [projectActionStatus, setProjectActionStatus] = useState<'idle' | 'success' | 'error'>('idle');


  const t = (key: keyof Translations['admin']) => getTranslation(language, 'admin', key) as string;

  useEffect(() => {
    const savedSettings = localStorage.getItem('admin-settings');
    if (savedSettings) {
      try { setSettings(JSON.parse(savedSettings)); } catch (e) { console.error('Error parsing saved settings:', e); }
    }
    // Load projects from PROJECTS_DATA (in a real app, this would be an API call)
    setProjectsState([...PROJECTS_DATA]);
  }, []);

  const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setSettings(prev => ({ ...prev, [id]: value }));
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true); setSettingsSaveStatus('idle');
    try {
      await new Promise(resolve => setTimeout(resolve, 1000)); 
      localStorage.setItem('admin-settings', JSON.stringify(settings));
      setSettingsSaveStatus('success');
    } catch (error) { console.error('Error saving settings:', error); setSettingsSaveStatus('error'); }
    finally { setIsSavingSettings(false); setTimeout(() => setSettingsSaveStatus('idle'), 3000); }
  };
  
  // Project Management Handlers
  const handleProjectFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setProjectForm(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setProjectForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tagsArray = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
    setProjectForm(prev => ({ ...prev, tags: tagsArray }));
  };

  const handleAddNewProject = () => {
    setProjectForm({...initialProjectFormState, id: `new_${Date.now()}`}); // Temp ID for new projects
    setIsEditingProject(true);
    setProjectActionStatus('idle');
  };

  const handleEditProject = (project: Project) => {
    setProjectForm({
      id: project.id,
      titleKey: project.titleKey,
      descriptionKey: project.descriptionKey,
      image: project.image,
      liveLink: project.liveLink || '',
      repoLink: project.repoLink || '',
      tags: project.tags || [],
      isVisible: project.isVisible,
    });
    setIsEditingProject(true);
    setProjectActionStatus('idle');
  };
  
  const handleSaveProject = async () => {
    setIsSubmittingProject(true); setProjectActionStatus('idle');
    // Basic validation (can be expanded)
    if (!projectForm.titleKey || !projectForm.descriptionKey || !projectForm.image) {
        alert(language === 'vi' ? 'Vui lòng điền các trường bắt buộc: Khóa Tiêu Đề, Khóa Mô Tả, URL Hình Ảnh.' : 'Please fill in required fields: Title Key, Description Key, Image URL.');
        setIsSubmittingProject(false);
        return;
    }

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const projectToSave: Project = {
        id: projectForm.id,
        titleKey: projectForm.titleKey as keyof Translations['projectTitles'], // Assuming admin enters valid keys
        descriptionKey: projectForm.descriptionKey as keyof Translations['projectDescriptions'], // Assuming admin enters valid keys
        image: projectForm.image,
        liveLink: projectForm.liveLink,
        repoLink: projectForm.repoLink,
        tags: projectForm.tags,
        isVisible: projectForm.isVisible,
      };

      setProjectsState(prevProjects => {
        const existingIndex = prevProjects.findIndex(p => p.id === projectToSave.id);
        if (existingIndex > -1) { // Update
          const updatedProjects = [...prevProjects];
          updatedProjects[existingIndex] = projectToSave;
          return updatedProjects;
        } else { // Add new
          return [...prevProjects, projectToSave];
        }
      });
      // Note: In a real app, PROJECTS_DATA would be updated via API and refetched or state updated from API response.
      // For now, this updates local component state. To persist, one might update constants.ts content if it's a static build,
      // or ideally use a backend.
      
      setProjectActionStatus('success');
      setIsEditingProject(false);
      setTimeout(() => setProjectActionStatus('idle'), 3000);
    } catch (error) {
      console.error('Error saving project:', error);
      setProjectActionStatus('error');
    } finally {
      setIsSubmittingProject(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (window.confirm(t('deleteConfirmMessage'))) {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      setProjectsState(prev => prev.filter(p => p.id !== projectId));
      // Add success/error handling if needed
    }
  };

  const handleToggleVisibility = async (projectId: string) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 300));
    setProjectsState(prev => 
      prev.map(p => p.id === projectId ? { ...p, isVisible: !p.isVisible } : p)
    );
  };


  const renderTabButton = (tabId: typeof activeTab, labelKey: keyof Translations['admin'], icon?: React.ReactNode) => (
    <button
      onClick={() => setActiveTab(tabId)}
      className={`flex items-center justify-center sm:justify-start px-3 py-3 sm:px-4 text-sm font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
        ${activeTab === tabId 
          ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400' 
          : 'text-gray-600 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400'}`}
      role="tab"
      aria-selected={activeTab === tabId}
      aria-controls={`admin-tabpanel-${tabId}`}
      id={`admin-tab-${tabId}`}
    >
      {icon && <span className="mr-2 hidden sm:inline">{icon}</span>}
      {t(labelKey)}
    </button>
  );

  if (!isAdmin || !adminModeActive) return null; 

  return (
    <div className="glass-card admin-dashboard max-w-7xl mx-auto shadow-2xl border border-white/20 dark:border-gray-700/30">
      <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/50">
        <h2 className="text-2xl md:text-3xl font-bold gradient-text">{t('adminPanelTitle')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('welcomeAdmin')}</p>
      </div>

      <div className="border-b border-gray-200/50 dark:border-gray-700/50 flex flex-wrap space-x-1 sm:space-x-2 overflow-x-auto" role="tablist" aria-label="Admin Sections">
        {renderTabButton('dashboard', 'dashboard')}
        {renderTabButton('projects', 'projectsManagement')}
        {renderTabButton('analytics', 'analytics')}
        {renderTabButton('messages', 'messages')}
        {renderTabButton('settings', 'settings')}
      </div>

      <div className="p-4 md:p-6 min-h-[400px]">
        {activeTab === 'dashboard' && ( /* Dashboard Content */
          <div id="admin-tabpanel-dashboard" role="tabpanel" aria-labelledby="admin-tab-dashboard" className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            <div className="stat-card">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">{t('quickStats')}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-100 dark:bg-gray-700/50 p-4 rounded-lg"><p className="text-sm text-gray-500 dark:text-gray-400">{t('visitors')}</p><p className="text-2xl font-bold text-primary-500">{mockAnalytics.visitors.toLocaleString()}</p></div>
                <div className="bg-gray-100 dark:bg-gray-700/50 p-4 rounded-lg"><p className="text-sm text-gray-500 dark:text-gray-400">{t('pageViews')}</p><p className="text-2xl font-bold text-secondary-500">{mockAnalytics.pageViews.toLocaleString()}</p></div>
              </div>
            </div>
            <div className="stat-card">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">{t('recentMessages')}</h3>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {mockMessages.slice(0,3).map(msg => (<div key={msg.id} className="bg-gray-100 dark:bg-gray-700/50 p-3 rounded-lg message-preview" onClick={() => { setActiveTab('messages'); setSelectedMessage(msg);}}><div className="flex justify-between items-center"><p className="font-medium text-gray-700 dark:text-gray-200 text-sm">{msg.name}</p><p className="text-xs text-gray-500 dark:text-gray-400">{msg.date}</p></div><p className="text-sm text-gray-600 dark:text-gray-300 truncate mt-1">{msg.message}</p></div>))}
                {mockMessages.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">{t('noNewMessages')}</p>}
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'projects' && ( /* Projects Content */
          <div id="admin-tabpanel-projects" role="tabpanel" aria-labelledby="admin-tab-projects" className="space-y-6 animate-fade-in">
            {isEditingProject ? (
              <div className="stat-card">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    {projectForm.id.startsWith('new_') ? t('addProject') : t('editProject')}
                  </h3>
                  <button onClick={() => setIsEditingProject(false)} className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
                    <XIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); handleSaveProject(); }} className="space-y-4">
                  <div><label htmlFor="titleKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('projectFormTitleLabel')}</label><input type="text" id="titleKey" name="titleKey" value={projectForm.titleKey} onChange={handleProjectFormChange} className="form-input" required /></div>
                  <div><label htmlFor="descriptionKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('projectFormDescriptionLabel')}</label><textarea id="descriptionKey" name="descriptionKey" value={projectForm.descriptionKey} onChange={handleProjectFormChange} rows={3} className="form-input" required></textarea></div>
                  <div><label htmlFor="image" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('imageUrlLabel')}</label><input type="text" id="image" name="image" value={projectForm.image} onChange={handleProjectFormChange} className="form-input" placeholder="/assets/projects/name.jpg or https://..." required /></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label htmlFor="liveLink" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('liveLinkLabel')}</label><input type="url" id="liveLink" name="liveLink" value={projectForm.liveLink} onChange={handleProjectFormChange} className="form-input" placeholder="https://example.com" /></div>
                    <div><label htmlFor="repoLink" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('repoLinkLabel')}</label><input type="url" id="repoLink" name="repoLink" value={projectForm.repoLink} onChange={handleProjectFormChange} className="form-input" placeholder="https://github.com/..." /></div>
                  </div>
                  <div><label htmlFor="tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('tagsLabel')} ({t('commaSeparatedHint')})</label><input type="text" id="tags" name="tags" value={projectForm.tags.join(', ')} onChange={handleTagsChange} className="form-input" placeholder="React, TypeScript, API" /></div>
                  <div className="flex items-center"><input type="checkbox" id="isVisible" name="isVisible" checked={projectForm.isVisible} onChange={handleProjectFormChange} className="h-4 w-4 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500 dark:bg-gray-700 dark:ring-offset-gray-800" /><label htmlFor="isVisible" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">{t('visibilityLabel')}</label></div>
                  <div className="flex justify-end space-x-3 pt-2">
                    <button type="button" onClick={() => setIsEditingProject(false)} className="btn-secondary action-button">{t('cancelButton')}</button>
                    <button type="submit" disabled={isSubmittingProject} className="btn-primary flex items-center justify-center gap-2 action-button">
                      {isSubmittingProject ? <><SpinnerIcon className="w-5 h-5" /><span>{t('saving')}</span></> : <span>{t('saveProjectButton')}</span>}
                    </button>
                  </div>
                  {projectActionStatus !== 'idle' && (<div role="alert" aria-live="polite" className={`p-3 rounded-md text-sm text-center mt-3 ${projectActionStatus === 'success' ? 'bg-green-100 dark:bg-green-800/30 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-800/30 text-red-700 dark:text-red-300'}`}>{projectActionStatus === 'success' ? t('projectSavedSuccess') : t('projectSaveError')}</div>)}
                </form>
              </div>
            ) : (
              <div className="stat-card">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t('projectsManagement')}</h3>
                  <button onClick={handleAddNewProject} className="btn-primary flex items-center gap-2 action-button">
                    <PlusIcon className="w-4 h-4" /> {t('addProject')}
                  </button>
                </div>
                <div className="overflow-x-auto admin-table">
                  <table className="min-w-full divide-y divide-gray-200/80 dark:divide-gray-700/80">
                    <thead className="bg-gray-50 dark:bg-gray-700/60">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('imageThumbnail')}</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('projectTableTitle')}</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('visibilityLabel')}</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('tagsLabel')}</th>
                        <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200/50 dark:divide-gray-700/50">
                      {projects.map(proj => (
                        <tr key={proj.id} className="hover:bg-primary-500/5 dark:hover:bg-primary-400/5 transition-colors duration-150">
                          <td className="px-4 py-3"><img src={proj.image} alt={proj.titleKey} className="w-12 h-10 object-cover rounded-md" loading="lazy" /></td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{proj.titleKey}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <button onClick={() => handleToggleVisibility(proj.id)} className={`px-2 py-1 text-xs font-semibold rounded-full ${proj.isVisible ? 'bg-green-100 text-green-700 dark:bg-green-700/30 dark:text-green-200' : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200'}`}>
                              {proj.isVisible ? t('visibleStatus') : t('hiddenStatus')}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs">{(proj.tags || []).join(', ')}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                            <button onClick={() => handleEditProject(proj)} className="p-1 text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-200 transition-colors" aria-label={t('editProject')}><PencilIcon className="w-5 h-5" /></button>
                            <button onClick={() => handleDeleteProject(proj.id)} className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 transition-colors" aria-label={t('deleteButton')}><TrashIcon className="w-5 h-5" /></button>
                          </td>
                        </tr>
                      ))}
                      {projects.length === 0 && (<tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">{t('noMessages')}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && ( /* Analytics Content */
           <div id="admin-tabpanel-analytics" role="tabpanel" aria-labelledby="admin-tab-analytics" className="space-y-6 animate-fade-in">
            <div className="stat-card"><h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">{t('visitorAnalytics')}</h3><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[{ label: t('visitors'), value: mockAnalytics.visitors.toLocaleString(), color: 'text-primary-500' },{ label: t('pageViews'), value: mockAnalytics.pageViews.toLocaleString(), color: 'text-secondary-500' },{ label: t('avgTime'), value: mockAnalytics.averageTime, color: 'text-green-500' },{ label: t('bounceRate'), value: mockAnalytics.bounceRate, color: 'text-red-500' },].map(item => (<div key={item.label} className="bg-gray-100 dark:bg-gray-700/50 p-4 rounded-lg text-center"><p className="text-sm text-gray-500 dark:text-gray-400">{item.label}</p><p className={`text-2xl font-bold ${item.color}`}>{item.value}</p></div>))}</div></div>
            <div className="stat-card"><h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">{t('topCountries')}</h3><ul className="space-y-2">{mockAnalytics.topCountries.map((country) => (<li key={country.name} className="bg-gray-100 dark:bg-gray-700/50 p-3 rounded-lg flex justify-between items-center"><span className="text-gray-700 dark:text-gray-200"><span className="mr-2 text-lg">{country.flag}</span>{country.name}</span><span className="font-medium text-primary-500">{country.percentage}%</span></li>))}</ul></div>
            <div className="stat-card"><h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">{t('trafficChart')}</h3><div className="h-64 bg-gray-100 dark:bg-gray-700/50 rounded-lg flex items-center justify-center chart-placeholder"><p className="text-gray-500 dark:text-gray-400">{t('chartPlaceholder')}</p></div></div>
          </div>
        )}
        {activeTab === 'messages' && ( /* Messages Content */
          <div id="admin-tabpanel-messages" role="tabpanel" aria-labelledby="admin-tab-messages" className="space-y-6 animate-fade-in">
            {selectedMessage ? (<div className="stat-card"><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t('viewMessageTitle')}</h3><button onClick={() => setSelectedMessage(null)} className="btn-secondary !px-3 !py-1.5 text-sm action-button">{t('backToList')}</button></div><div className="bg-gray-100 dark:bg-gray-700/50 p-4 sm:p-6 rounded-lg"><div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"><div><p className="text-xs text-gray-500 dark:text-gray-400">{t('name')}</p><p className="font-medium text-gray-800 dark:text-white">{selectedMessage.name}</p></div><div><p className="text-xs text-gray-500 dark:text-gray-400">{t('email')}</p><p className="font-medium text-gray-800 dark:text-white">{selectedMessage.email}</p></div><div className="md:col-span-2"><p className="text-xs text-gray-500 dark:text-gray-400">{t('date')}</p><p className="font-medium text-gray-800 dark:text-white">{selectedMessage.date}</p></div></div><div><p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('message')}</p><div className="bg-white dark:bg-gray-800 p-4 rounded-md min-h-[100px] text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{selectedMessage.message}</div></div><div className="mt-6 flex justify-end space-x-3"><button className="btn-secondary !py-2 !px-4 action-button">{t('delete')}</button><button className="btn-primary !py-2 !px-4 action-button">{t('reply')}</button></div></div></div>
            ) : (<div className="stat-card"><h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">{t('messages')}</h3><div className="overflow-x-auto admin-table"><table className="min-w-full divide-y divide-gray-200/80 dark:divide-gray-700/80"><thead className="bg-gray-50 dark:bg-gray-700/60"><tr>{['name', 'email', 'message', 'date', 'actions'].map(headerKey => (<th key={headerKey} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t(headerKey as keyof Translations['admin'])}</th>))}</tr></thead><tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200/50 dark:divide-gray-700/50">{mockMessages.map(msg => (<tr key={msg.id} className="hover:bg-primary-500/5 dark:hover:bg-primary-400/5 transition-colors duration-150"><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{msg.name}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{msg.email}</td><td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate" title={msg.message}>{msg.message}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{msg.date}</td><td className="px-6 py-4 whitespace-nowrap text-sm"><button onClick={() => setSelectedMessage(msg)} className="text-primary-600 dark:text-primary-400 hover:underline focus:outline-none">{t('view')}</button></td></tr>))}{mockMessages.length === 0 && (<tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">{t('noMessages')}</td></tr>)}</tbody></table></div></div>)}
          </div>
        )}
        {activeTab === 'settings' && ( /* Settings Content */
          <div id="admin-tabpanel-settings" role="tabpanel" aria-labelledby="admin-tab-settings" className="space-y-6 animate-fade-in">
            <div className="stat-card admin-settings-section"><h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">{t('websiteSettings')}</h3><div className="space-y-5"><div><label htmlFor="siteTitle" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('siteTitle')}</label><input type="text" id="siteTitle" value={settings.siteTitle} onChange={handleSettingsChange} className="form-input"/></div><div><label htmlFor="metaDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('metaDescription')}</label><textarea id="metaDescription" value={settings.metaDescription} onChange={handleSettingsChange} rows={3} className="form-input"/></div><div><label htmlFor="googleAnalyticsId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Google Analytics ID</label><input type="text" id="googleAnalyticsId" value={settings.googleAnalyticsId} onChange={handleSettingsChange} className="form-input"/></div><button onClick={handleSaveSettings} disabled={isSavingSettings} className="btn-primary mt-2 flex items-center justify-center gap-2 w-full sm:w-auto action-button">{isSavingSettings ? <><SpinnerIcon className="w-5 h-5" /><span>{t('saving')}</span></> : t('saveSettings')}</button>{settingsSaveStatus !== 'idle' && (<div role="alert" aria-live="polite" className={`p-3 rounded-md text-sm text-center mt-3 ${settingsSaveStatus === 'success' ? 'bg-green-100 dark:bg-green-800/30 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-800/30 text-red-700 dark:text-red-300'}`}>{settingsSaveStatus === 'success' ? t('settingsSaved') : t('settingsSaveFailed')}</div>)}</div></div>
            <div className="stat-card admin-settings-section"><h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">{t('advancedOptions')}</h3><div className="space-y-4"><div className="flex items-center"><input type="checkbox" id="enableMaintenance" className="w-4 h-4 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500 dark:bg-gray-700 dark:ring-offset-gray-800" /><label htmlFor="enableMaintenance" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">{t('enableMaintenance')}</label></div><div><label htmlFor="backupFrequency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('backupFrequency')}</label><select id="backupFrequency" className="form-input appearance-none" defaultValue="weekly"><option value="daily">{t('daily')}</option><option value="weekly">{t('weekly')}</option><option value="monthly">{t('monthly')}</option></select></div><button className="btn-secondary !py-2 !px-4 mt-2 action-button">{t('backupNow')}</button></div></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
