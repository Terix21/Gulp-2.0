import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChakraProvider } from '@chakra-ui/react';
import App from './components/App.jsx';
import themeSystem from './theme.js';
import '../scss/style.scss';

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    React.createElement(
      ChakraProvider,
      { value: themeSystem },
      React.createElement(App)
    )
  );
}
