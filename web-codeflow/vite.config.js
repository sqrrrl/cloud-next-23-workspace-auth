/**
 * https://vitejs.dev/config/
 * @type { import('vite').UserConfig }
 */

/*
 * Import the plugin modules
 */
import app from './server/app'
import { resolve } from 'path';

/*
 * The Express app plugin. Specify the URL base path
 * for the app and the Express app object.
 */
const expressServerPlugin = (path, expressApp) => ({
  name: 'configure-server',
  configureServer(server) {
    server.middlewares.use(path, expressApp);
  }
});

/*
 * Vite configuration
 */
export default {
    build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        authorize: resolve(__dirname, 'authorize.html'),
      },
    },
  },
  plugins: [
    expressServerPlugin('/', app),
  ],
}
