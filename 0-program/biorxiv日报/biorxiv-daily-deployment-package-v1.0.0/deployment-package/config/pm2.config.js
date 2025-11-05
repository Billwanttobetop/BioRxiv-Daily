module.exports = {
  apps: [
    {
      // 主应用配置
      name: 'biorxiv-daily',
      script: 'pnpm',
      args: 'start',
      cwd: './biorxiv-final',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        VITE_APP_NAME: 'BioRxiv日报',
        VITE_SUPABASE_URL: 'https://your-project.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'your-anon-key',
      },
      // 进程管理配置
      max_memory_restart: '500M',
      min_uptime: '10s',
      max_restarts: 10,
      autorestart: true,
      watch: false,
      ignore_watch: [
        'node_modules',
        'logs',
        'dist',
        'coverage',
      ],
      // 日志配置
      log_file: './logs/biorxiv-daily.log',
      out_file: './logs/biorxiv-daily-out.log',
      error_file: './logs/biorxiv-daily-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // 监控配置
      monitoring: false,
      // 错误处理
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: true,
    },
    {
      // API服务配置 (如果使用Node.js API)
      name: 'biorxiv-api',
      script: 'node',
      args: 'server.js',
      cwd: './api',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        DATABASE_URL: 'postgresql://user:password@localhost:5432/biorxiv_daily',
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: 'your-jwt-secret',
        SUPABASE_URL: 'https://your-project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'your-service-role-key',
      },
      max_memory_restart: '200M',
      min_uptime: '10s',
      max_restarts: 5,
      autorestart: true,
      watch: false,
      log_file: './logs/biorxiv-api.log',
      out_file: './logs/biorxiv-api-out.log',
      error_file: './logs/biorxiv-api-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
    {
      // 定时任务服务
      name: 'biorxiv-cron',
      script: 'node',
      args: 'cron.js',
      cwd: './scripts',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      env_production: {
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://your-project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'your-service-role-key',
        OPENAI_API_KEY: 'your-openai-api-key',
      },
      max_memory_restart: '100M',
      min_uptime: '10s',
      max_restarts: 3,
      autorestart: true,
      watch: false,
      cron_restart: '0 2 * * *', // 每天凌晨2点重启
      log_file: './logs/biorxiv-cron.log',
      out_file: './logs/biorxiv-cron-out.log',
      error_file: './logs/biorxiv-cron-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],

  // 部署配置
  deploy: {
    production: {
      user: 'deploy',
      host: ['your-server.com'],
      ref: 'origin/main',
      repo: 'git@github.com:your-username/biorxiv-daily.git',
      path: '/var/www/biorxiv-daily',
      'pre-deploy-local': '',
      'post-deploy': 'pnpm install && pnpm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
    },
    staging: {
      user: 'deploy',
      host: ['staging.your-server.com'],
      ref: 'origin/develop',
      repo: 'git@github.com:your-username/biorxiv-daily.git',
      path: '/var/www/biorxiv-daily-staging',
      'post-deploy': 'pnpm install && pnpm run build && pm2 reload ecosystem.config.js --env staging',
    },
  },
};
