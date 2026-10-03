import { initApp } from './ui/app.js';
import { initPWA } from './ui/pwa.js';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app');
  initApp(root);
  initPWA();
});