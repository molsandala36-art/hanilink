import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const savedTheme = localStorage.getItem('theme');
const shouldUseDark = savedTheme ? savedTheme === 'dark' : true;

document.documentElement.classList.toggle('dark', shouldUseDark);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
