// PM2 Ecosystem Config for Indhumathi Garments Backend
// Usage: pm2 start ecosystem.config.js --env production
export default {
  apps: [
    {
      name: 'indhumathi-backend',
      script: 'dist/index.js',

      // Cluster mode uses all available CPU cores for load balancing
      instances: 'max',
      exec_mode: 'cluster',

      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',

      // Environment – Development
      env: {
        NODE_ENV: 'development',
        PORT: 5001,
      },

      // Environment – Production
      env_production: {
        NODE_ENV: 'production',
        PORT: 5001,
      },

      // Logging
      error_file: '/home/ubuntu/.pm2/logs/indhumathi-error.log',
      out_file: '/home/ubuntu/.pm2/logs/indhumathi-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Auto-restart if memory exceeds 400 MB
      max_memory_restart: '400M',
    },
  ],
};
