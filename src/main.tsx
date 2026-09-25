import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Site } from './site/Site';
import './styles.css';
import './site/site.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Site />
  </StrictMode>,
);
