
import React from 'react';
import { SOCIAL_LINKS, getTranslation } from '../constants';
import { Language, Translations }  from '../types';

interface FooterProps {
  language: Language;
}

const Footer: React.FC<FooterProps> = ({ language }) => {
  const t = (key: keyof Translations['footer']) => getTranslation(language, 'footer', key) as string;
  
  return (
    <footer className="glass-card mt-12 mx-4 mb-4 p-8 text-center">
      <div className="flex justify-center space-x-6 mb-4">
        {SOCIAL_LINKS.map(link => (
          <a 
            key={link.href} 
            href={link.href} 
            className="text-2xl text-gray-600 hover:text-primary-500 dark:text-gray-400 dark:hover:text-primary-400 transition-colors duration-200 hover:scale-110 transform"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Social link to ${link.iconClass.split(' ')[1].substring(3)}`}
          >
            <i className={link.iconClass}></i>
          </a>
        ))}
      </div>
      <p className="text-gray-600 dark:text-gray-400">{t('copyright')}</p>
    </footer>
  );
};

export default Footer;
