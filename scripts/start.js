#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const port = process.env.PORT || 3001;

console.log(`Starting development server on port ${port}...`);

const webpack = require.resolve('webpack');
const webpackDevServer = require.resolve('webpack-dev-server');

if (!fs.existsSync(webpack) || !fs.existsSync(webpackDevServer)) {
  console.log('Installing webpack and webpack-dev-server...');
  const install = spawn('npm', ['install', '--save-dev', 'webpack', 'webpack-dev-server', 'webpack-cli', 'html-webpack-plugin', '@babel/core', 'babel-loader'], {
    stdio: 'inherit',
    shell: true
  });

  install.on('close', (code) => {
    if (code !== 0) {
      console.error('Failed to install dependencies');
      process.exit(1);
    }
    startServer();
  });
} else {
  startServer();
}

function startServer() {
  const configPath = path.join(__dirname, '..', 'webpack.config.js');

  if (!fs.existsSync(configPath)) {
    createWebpackConfig(configPath);
  }

  const server = spawn('npx', ['webpack-dev-server', '--mode', 'development', '--port', port.toString()], {
    stdio: 'inherit',
    shell: true,
    cwd: path.join(__dirname, '..')
  });

  server.on('error', (err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });

  server.on('close', (code) => {
    if (code !== 0) {
      console.error('Server exited with code', code);
      process.exit(code);
    }
  });
}

function createWebpackConfig(configPath) {
  const config = `const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/'
  },
  module: {
    rules: [
      {
        test: /\\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env',
              '@babel/preset-react',
              '@babel/preset-typescript'
            ]
          }
        }
      },
      {
        test: /\\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx']
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      filename: 'index.html'
    })
  ],
  devServer: {
    historyApiFallback: true,
    hot: true
  }
};`;

  fs.writeFileSync(configPath, config);
  console.log('Created webpack.config.js');
}