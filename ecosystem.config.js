module.exports = {
  apps: [
    {
      name: 'hccg-admin',
      script: './backend/server-admin.js',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        ADMIN_PORT: 3001,
        PUBLIC_IP: 'hsinchu.dpdns.org',
        JWT_SECRET: process.env.JWT_SECRET || 'hsinchu-guardian-secret-2025',
        DATABASE_URL: 'postgresql://hccg:hccg2025@localhost:5432/hccg_development'
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
        ADMIN_PORT: 3001,
        PUBLIC_IP: 'localhost'
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      max_memory_restart: '500M',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000
    },
    {
      name: 'hccg-backend',
      script: './backend/server-simple.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        PUBLIC_IP: 'hsinchu.dpdns.org',
        JWT_SECRET: process.env.JWT_SECRET || 'hsinchu-guardian-secret-2025',
        DATABASE_URL: 'postgresql://hccg:hccg2025@localhost:5432/hccg_development'
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
        PUBLIC_IP: 'localhost'
      },
      error_file: './logs/pm2-backend-error.log',
      out_file: './logs/pm2-backend-out.log',
      log_file: './logs/pm2-backend-combined.log',
      time: true,
      max_memory_restart: '300M',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000
    }
  ],

  deploy: {
    production: {
      user: 'ubuntu',
      host: '147.251.115.54',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/hccg-hsinchu-pass-guardian.git',
      path: '/home/ubuntu/dev/hccg-hsinchu-pass-guardian',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': '',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};