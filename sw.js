const CACHE_NAME = 'diabetes-ai-assistant-v3';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/icons/icon-192x192.png', // <-- Kiểm tra dòng này
    '/icons/icon-512x512.png', // <-- Và dòng này
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// ... (phần còn lại của tệp sw.js)