
import React from 'react';
import { Project, Language } from '../types';
import { getProjectTranslation } from '../constants';

interface ProjectCardProps {
  project: Project;
  language: Language;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, language }) => {
  const title = getProjectTranslation(language, project.titleKey, 'title') as string;
  const description = getProjectTranslation(language, project.descriptionKey, 'description') as string;
  const tags = project.tags || []; // Use direct tags array

  // Hide card if project is not visible
  if (!project.isVisible) {
    return null;
  }

  return (
    <div className="glass-card p-0 overflow-hidden group animate-fade-in hover-lift">
      <div className="relative overflow-hidden">
        <img 
          src={project.image} 
          alt={title} 
          className="w-full h-48 object-cover transform group-hover:scale-105 transition-transform duration-300" 
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      </div>
      <div className="p-6 z-[10] relative">
        <h3 className="text-xl font-semibold mb-2 gradient-text">{title}</h3>
        <p className="text-gray-700 dark:text-gray-300 text-sm mb-4 h-20 overflow-y-auto">{description}</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {tags.map(tag => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
        <div className="flex space-x-3 mt-auto">
          {project.liveLink && (
            <a 
              href={project.liveLink} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn-secondary !px-4 !py-2 text-sm flex items-center gap-1.5"
            >
              <img src="https://img.icons8.com/?size=256&id=57GgOxl1VjRW&format=png" alt="Live Demo Icon" className="w-4 h-4" loading="lazy" />
              Live Demo
            </a>
          )}
          {project.repoLink && (
            <a 
              href={project.repoLink} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn-secondary !px-4 !py-2 text-sm flex items-center gap-1.5"
            >
              <i className="fab fa-github mr-1"></i>
              View Code
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
