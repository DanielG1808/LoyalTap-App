// main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx'; // Importa tu componente principal App.jsx
import './index.css'; // Importa los estilos base

// Este código monta tu aplicación de React en el div con id="root" en index.html
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);