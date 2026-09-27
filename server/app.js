const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const compression = require('compression');

// Route handlers
const phoneRoutes = require('./routes/phoneRoutes');
const brandRoutes = require('./routes/brandRoutes');
const searchRoutes = require('./routes/searchRoutes');
const compareRoutes = require('./routes/compareRoutes');
const authRoutes = require('./routes/authRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const newsRoutes = require('./routes/newsRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const pageRoutes = require('./routes/pageRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const viewRoutes = require('./routes/viewRoutes');

// Middleware
const { notFoundHandler, errorHandler } = require('./middleware/error');

const app = express();

// Trust reverse proxy (Hostinger, Cloudflare, Nginx, LiteSpeed, etc.)
app.set('trust proxy', 1);

// HTTP Compression (Gzip / Deflate for fast TTFB and payload reduction)
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  threshold: 1024
}));

// Request Logger (filters static assets to reduce event loop pressure)
app.use((req, res, next) => {
  const url = req.originalUrl;
  if (!url.startsWith('/webfiles') && 
      !url.startsWith('/css') && 
      !url.startsWith('/js') && 
      !url.startsWith('/uploads') && 
      !url.startsWith('/images') &&
      !url.endsWith('.ico') && 
      !url.endsWith('.png') && 
      !url.endsWith('.webp')) {
    console.log(`[REQ] ${req.method} ${url}`);
  }
  next();
});

// Security Middlewares
app.use(helmet({
  contentSecurityPolicy: false, // Allows clean inline scripts and fonts for Vanilla JS components
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

app.use(cors());

// Body Parsers — increased limits to handle rich blog content from Quill editor
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session Setup
app.use(session({
  name: 'phonesdaddy_session',
  secret: process.env.SESSION_SECRET || 'phonesdaddy_secret_key_3892749',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    httpOnly: true,
    secure: 'auto', // Automatically detects HTTPS via reverse proxy headers on Hostinger/Cloudflare
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
}));

// Static Folders with optimized HTTP Cache-Control headers
const staticOptions = {
  maxAge: '7d',
  setHeaders: (res, filePath) => {
    if (filePath.includes('webfiles')) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    } else if (/\.(css|js|woff2|woff|ttf|ico|svg|png|jpg|jpeg|webp)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    }
  }
};

app.use(express.static(path.join(__dirname, '../public'), staticOptions));
app.use('/webfiles', express.static(path.join(__dirname, '../public/webfiles'), {
  maxAge: '30d',
  immutable: true,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
  }
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '7d',
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=604800');
  }
}));

// REST API Endpoints
app.use('/api/phones', searchRoutes); // Handles /api/phones/search
app.use('/api/phones', phoneRoutes);   // Handles /api/phones, /latest, /slug/:slug
app.use('/api/brands', brandRoutes);   // Handles /api/brands, /slug/:slug
app.use('/api/compare', compareRoutes); // Handles /api/compare
app.use('/api/admin/auth', authRoutes); // Handles /api/admin/auth/login, etc.
app.use('/api/admin/settings', settingsRoutes); // Handles /api/admin/settings
app.use('/api/settings', settingsRoutes); // Handles /api/settings/public
app.use('/api/admin', authRoutes);
app.use('/api/news', newsRoutes); // Handles /api/news, /hot, /slug/:slug, and admin news
app.use('/api/reviews', reviewRoutes); // Handles /api/reviews/phone/:id
app.use('/api/comments', reviewRoutes); // Handles /api/comments/news/:id
app.use('/api/admin/reviews', reviewRoutes); // Handles /api/admin/reviews/list, stats, status, delete
app.use('/api/pages', pageRoutes); // Handles /api/pages/footer, /slug/:slug, /admin/*
app.use('/api/admin/pages', pageRoutes);
app.use('/api/categories', categoryRoutes); // Handles /api/categories, /admin/*
app.use('/api/admin/categories', categoryRoutes);


// View & Page Routes (HTML templates & SEO)
app.use('/', viewRoutes);

// Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
