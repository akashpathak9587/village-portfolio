import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import App from './App';
import { applyTheme } from './config';

applyTheme();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
