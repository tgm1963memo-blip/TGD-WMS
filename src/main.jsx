import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App.jsx';
import { PwaUpdateBanner } from './components/layout/PwaUpdateBanner.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PwaUpdateBanner />
    <App />
  </React.StrictMode>,
);

