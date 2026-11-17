import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
import './styles/tokens.css';
import './styles/primitives.css';
import './styles/atmosphere.css';
import './styles/navigation.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
