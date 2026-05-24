import './src/index.css';
import './src/styles/official-epitaxy-fonts.css';
import './src/styles/official-epitaxy.css';
import './src/styles/code-epitaxy-bridge.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './src/App';
import { initBridgePort } from './src/bridgeConfig';

const rootElement = document.getElementById('root');

// Initialize theme and font from localStorage to ensure CSS variables are hydrated before render
const theme = localStorage.getItem('theme') || 'auto';
const normalizedTheme = theme === 'system' ? 'auto' : theme;
const font = localStorage.getItem('customStyles:chatFont') || localStorage.getItem('chat_font') || 'default';
const normalizedFont = font === 'dyslexic' ? 'dyslexia' : font;
if (normalizedTheme === 'dark' || (normalizedTheme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.setAttribute('data-theme', 'dark');
  document.documentElement.setAttribute('data-mode', 'dark');
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.setAttribute('data-theme', 'light');
  document.documentElement.setAttribute('data-mode', 'light');
}
document.documentElement.setAttribute('data-chat-font', normalizedFont);

if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

initBridgePort().finally(() => {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
