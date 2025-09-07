
export type Theme = 'light' | 'dark';
export type Language = 'en' | 'vi';

export interface NavLinkItem {
  href: string;
  textKey: keyof TranslationKeys['nav'] | keyof TranslationKeys['admin']; // Allow admin text keys
}

export interface Project {
  id: string;
  image: string;
  titleKey: string; // Changed from keyof TranslationKeys['projectTitles']
  descriptionKey: string; // Changed from keyof TranslationKeys['projectDescriptions']
  tags: string[]; // Changed from tagsKey
  liveLink?: string;
  repoLink?: string;
  isVisible: boolean; // Added
}

export interface ProjectFormData {
  id: string; // Can be existing ID or new temporary ID
  titleKey: string; // Admin will manage these keys
  descriptionKey: string; // Admin will manage these keys
  image: string;
  liveLink?: string;
  repoLink?: string;
  tags: string[]; // Stored as array, but input as comma-separated string
  isVisible: boolean;
}

export interface GoogleUserProfile {
  email: string;
  name: string;
  picture: string;
}

export interface Translations {
  nav: {
    home: string;
    install: string;
    demo: string;
    troubleshooting: string;
    faq: string;
  };
  langToggle: string;
  profile: { 
    name: string;
    email: string;
  };
  login: {
    signInWithGoogle: string;
    signOut: string;
    myProfile: string;
    tryAlternativeSignIn: string; 
    adminMode: string;
    exitAdminMode: string;
    adminPageLink: string;
  };
  home: {
    title: string;
    subtitle: string;
    downloadNow: string;
    installGuide: string;
    systemRequirements: string;
    windowsOnly: string;
  };
  install: {
    title: string;
    subtitle: string;
    step1Title: string;
    step1Desc: string;
    step2Title: string;
    step2Desc: string;
    step3Title: string;
    step3Desc: string;
    step4Title: string;
    step4Desc: string;
    copyCommand: string;
    copied: string;
    installCommand: string;
  };
  demo: {
    title: string;
    subtitle: string;
    watchVideo: string;
    features: string;
  };
  troubleshooting: {
    title: string;
    subtitle: string;
    dotnetIssue: string;
    dotnetSolution: string;
    adminIssue: string;
    adminSolution: string;
    networkIssue: string;
    networkSolution: string;
  };
  faq: {
    title: string;
    q1: string;
    a1: string;
    q2: string;
    a2: string;
    q3: string;
    a3: string;
    q4: string;
    a4: string;
  };
  footer: {
    copyright: string;
  };
  admin: { 
    title: string;
    dashboard: string;
    analytics: string;
    messages: string;
    settings: string;
    noAccess: string;
    adminPanelTitle: string; 
    welcomeAdmin: string;
    quickStats: string;
    visitors: string;
    pageViews: string;
    recentMessages: string;
    visitorAnalytics: string;
    avgTime: string;
    bounceRate: string;
    topCountries: string;
    name: string; 
    email: string; 
    message: string; 
    date: string; 
    actions: string; 
    view: string; 
    websiteSettings: string;
    siteTitle: string;
    metaDescription: string;
    saveSettings: string;
    viewMessageTitle: string; 
    backToList: string; 
    delete: string; 
    reply: string; 
    saving: string; 
    settingsSaved: string;
    settingsSaveFailed: string; 
    advancedOptions: string;
    enableMaintenance: string;
    backupFrequency: string;
    daily: string;
    weekly: string;
    monthly: string;
    backupNow: string;
    trafficChart: string;
    chartPlaceholder: string;
    noMessages: string;
    noNewMessages: string;
    loadingAdminDashboard: string;
    // Project Management translations
    projectsManagement: string;
    addProject: string;
    editProject: string;
    projectFormTitleLabel: string; // Differentiated for clarity
    projectFormDescriptionLabel: string; // Differentiated for clarity
    imageUrlLabel: string;
    liveLinkLabel: string;
    repoLinkLabel: string;
    tagsLabel: string;
    commaSeparatedHint: string;
    visibilityLabel: string;
    visibleStatus: string;
    hiddenStatus: string;
    cancelButton: string;
    saveProjectButton: string;
    projectSavedSuccess: string;
    projectSaveError: string;
    deleteConfirmMessage: string;
    deleteButton: string; // Generic delete button text
    projectTableTitle: string;
    imageThumbnail: string;
  };
}

export interface TranslationKeys {
  nav: {
    home: 'home';
    install: 'install';
    demo: 'demo';
    troubleshooting: 'troubleshooting';
    faq: 'faq';
    contact: 'contact';
  };
  langToggle: 'langToggle';
  profile: { 
    name: 'name';
    email: 'email';
  };
  login: {
    signInWithGoogle: 'signInWithGoogle';
    signOut: 'signOut';
    myProfile: 'myProfile';
    tryAlternativeSignIn: 'tryAlternativeSignIn';
    adminMode: 'adminMode'; 
    exitAdminMode: 'exitAdminMode'; 
    adminPageLink: 'adminPageLink';
  };
  home: {
    title: 'title';
    subtitle: 'subtitle';
    downloadNow: 'downloadNow';
    installGuide: 'installGuide';
    systemRequirements: 'systemRequirements';
    windowsOnly: 'windowsOnly';
  };
  install: {
    title: 'title';
    subtitle: 'subtitle';
    step1Title: 'step1Title';
    step1Desc: 'step1Desc';
    step2Title: 'step2Title';
    step2Desc: 'step2Desc';
    step3Title: 'step3Title';
    step3Desc: 'step3Desc';
    step4Title: 'step4Title';
    step4Desc: 'step4Desc';
    copyCommand: 'copyCommand';
    copied: 'copied';
    installCommand: 'installCommand';
  };
  demo: {
    title: 'title';
    subtitle: 'subtitle';
    watchVideo: 'watchVideo';
    features: 'features';
  };
  troubleshooting: {
    title: 'title';
    subtitle: 'subtitle';
    dotnetIssue: 'dotnetIssue';
    dotnetSolution: 'dotnetSolution';
    adminIssue: 'adminIssue';
    adminSolution: 'adminSolution';
    networkIssue: 'networkIssue';
    networkSolution: 'networkSolution';
  };
  faq: {
    title: 'title';
    q1: 'q1';
    a1: 'a1';
    q2: 'q2';
    a2: 'a2';
    q3: 'q3';
    a3: 'a3';
    q4: 'q4';
    a4: 'a4';
  };
  contact: {
    title: 'title';
    namePlaceholder: 'namePlaceholder';
    emailPlaceholder: 'emailPlaceholder';
    messagePlaceholder: 'messagePlaceholder';
    sendMessage: 'sendMessage';
    messageSent: 'messageSent';
    messageFailed: 'messageFailed';
  };
  footer: {
    copyright: 'copyright';
  };
  admin: { 
    title: 'title'; 
    dashboard: 'dashboard';
    analytics: 'analytics';
    messages: 'messages';
    settings: 'settings';
    noAccess: 'noAccess';
    adminPanelTitle: 'adminPanelTitle'; 
    welcomeAdmin: 'welcomeAdmin';
    quickStats: 'quickStats';
    visitors: 'visitors';
    pageViews: 'pageViews';
    recentMessages: 'recentMessages';
    visitorAnalytics: 'visitorAnalytics';
    avgTime: 'avgTime';
    bounceRate: 'bounceRate';
    topCountries: 'topCountries';
    name: 'name';
    email: 'email';
    message: 'message';
    date: 'date';
    actions: 'actions';
    view: 'view';
    websiteSettings: 'websiteSettings';
    siteTitle: 'siteTitle';
    metaDescription: 'metaDescription';
    saveSettings: 'saveSettings';
    viewMessageTitle: 'viewMessageTitle'; 
    backToList: 'backToList';
    delete: 'delete'; 
    reply: 'reply';
    saving: 'saving';
    settingsSaved: 'settingsSaved';
    settingsSaveFailed: 'settingsSaveFailed';
    advancedOptions: 'advancedOptions';
    enableMaintenance: 'enableMaintenance';
    backupFrequency: 'backupFrequency';
    daily: 'daily';
    weekly: 'weekly';
    monthly: 'monthly';
    backupNow: 'backupNow';
    trafficChart: 'trafficChart';
    chartPlaceholder: 'chartPlaceholder';
    noMessages: 'noMessages';
    noNewMessages: 'noNewMessages';
    loadingAdminDashboard: 'loadingAdminDashboard';
    // Project Management Keys
    projectsManagement: 'projectsManagement';
    addProject: 'addProject';
    editProject: 'editProject';
    projectFormTitleLabel: 'projectFormTitleLabel';
    projectFormDescriptionLabel: 'projectFormDescriptionLabel';
    imageUrlLabel: 'imageUrlLabel';
    liveLinkLabel: 'liveLinkLabel';
    repoLinkLabel: 'repoLinkLabel';
    tagsLabel: 'tagsLabel';
    commaSeparatedHint: 'commaSeparatedHint';
    visibilityLabel: 'visibilityLabel';
    visibleStatus: 'visibleStatus';
    hiddenStatus: 'hiddenStatus';
    cancelButton: 'cancelButton';
    saveProjectButton: 'saveProjectButton';
    projectSavedSuccess: 'projectSavedSuccess';
    projectSaveError: 'projectSaveError';
    deleteConfirmMessage: 'deleteConfirmMessage';
    deleteButton: 'deleteButton';
    projectTableTitle: 'projectTableTitle';
    imageThumbnail: 'imageThumbnail';
  };
}
