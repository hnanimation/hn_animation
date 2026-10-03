import { createEmptyProject } from './schema.js';
import { createSection } from './sections.js';
import { clearAllMedia } from './media.js';

let currentProject = null;

export function getCurrentProject() {
  return currentProject;
}

export function setProject(project) {
  currentProject = project;
}

export function newProject(name = 'My Artist Website') {
  clearAllMedia();
  const project = createEmptyProject(name);
  project.template = 'minimal';
  project.sections = [
    createSection('about', 10),
    createSection('portfolio', 20),
    createSection('projects', 30),
    createSection('articles', 40),
    createSection('posts', 50),
    createSection('contact', 60)
  ];
  currentProject = project;
  return project;
}
export function replaceProject(project) {
  currentProject = project;
  return currentProject;
}