const React = require('react');
const { createRoot } = require('react-dom/client');
const { ChakraProvider, defaultSystem } = require('@chakra-ui/react');
const App = require('./components/App');
const themeSystem = require('./theme');

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = createRoot(rootElement);
  const providerProps = {
    value: themeSystem || defaultSystem
  };

  root.render(
    React.createElement(
      ChakraProvider,
      providerProps,
      React.createElement(App)
    )
  );
}
