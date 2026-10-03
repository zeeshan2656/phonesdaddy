const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();
const { UPLOADS_BASE, WEBFILES_BASE, IMAGES_BASE } = require('./utils/paths');

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
const ptaRoutes = require('./routes/ptaRoutes');
const viewRoutes = require('./routes/viewRoutes');

// Middleware
const { notFoundHandler, errorHandler } = require('./middleware/error');

const app = express();

// Trust reverse proxy (Hostinger, Cloudflare, Nginx, LiteSpeed, etc.)
app.set('trust proxy', 1);

// Normalize duplicate slashes (e.g. Google Search Console //sitemap.xml -> /sitemap.xml)
app.use((req, res, next) => {
  const qIndex = req.url.indexOf('?');
  const pathPart = qIndex === -1 ? req.url : req.url.slice(0, qIndex);
  const queryPart = qIndex === -1 ? '' : req.url.slice(qIndex);
  if (pathPart.includes('//')) {
    req.url = pathPart.replace(/\/+/g, '/') + queryPart;
  }
  next();
});

// Single-hop Canonical Host & HTTPS Enforcement (Saves ~3.3s redirect chain)
app.use((req, res, next) => {
  const host = (req.headers.host || '').toLowerCase();
  
  // Skip local testing environments
  if (host.includes('localhost') || host.includes('127.0.0.1') || host.startsWith('192.168.')) {
    return next();
  }

  const isWww = host.startsWith('www.');
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const isHttp = proto === 'http';

  // If WWW or plain HTTP, perform a single 301 redirect to canonical https://phonesdaddy.com
  if (isWww || isHttp) {
    const cleanHost = host.replace(/^www\./i, '');
    const canonicalUrl = `https://${cleanHost}${req.originalUrl}`;
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache 301 permanent redirect
    return res.redirect(301, canonicalUrl);
  }

  next();
});

// Fast health-check endpoint for internal keep-alive and Hostinger ping
app.get('/api/health', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.status(200).json({ status: 'ok', uptime: Math.round(process.uptime()), time: Date.now() });
});

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

// Static Folders with optimized HTTP Cache-Control headers (1 Year Immutable for 100% GTmetrix Score)
const staticOptions = {
  maxAge: '1y',
  immutable: true,
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Admin scripts and styles must never be cached so updates reflect immediately
    if (filePath.includes('admin') || filePath.endsWith('admin.js') || filePath.endsWith('admin.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (filePath.endsWith('sw.js') || filePath.endsWith('service-worker.js')) {
      // Service worker: Zero-caching & full origin scope authorization
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Service-Worker-Allowed', '/');
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (filePath.endsWith('manifest.json') || filePath.endsWith('manifest.webmanifest')) {
      // PWA Manifest: Standard revalidation & proper MIME type
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    } else if (filePath.endsWith('offline.html')) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    } else {
      // 1 Year Immutable cache for all static public assets (CSS, JS, WebP, SVG, PNG, fonts)
      // Provides 100% score on GTmetrix Static Asset Caching
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
};

// Explicit PWA Endpoints (Guarantees correct headers regardless of reverse proxy or rewrite rules)
app.get('/sw.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.sendFile(path.join(__dirname, '../public/sw.js'));
});

app.get(['/manifest.json', '/manifest.webmanifest'], (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.sendFile(path.join(__dirname, '../public/manifest.json'));
});

// 1. Persistent External Media & Scraped Webfiles (Priority 1)
app.use('/uploads', express.static(UPLOADS_BASE, staticOptions));
const localUploads = path.join(__dirname, 'uploads');
if (fs.existsSync(localUploads) && path.resolve(UPLOADS_BASE) !== path.resolve(localUploads)) {
  app.use('/uploads', express.static(localUploads, staticOptions));
}

app.use('/webfiles', express.static(WEBFILES_BASE, staticOptions));
const localWebfiles = path.join(__dirname, '../public/webfiles');
if (fs.existsSync(localWebfiles) && path.resolve(WEBFILES_BASE) !== path.resolve(localWebfiles)) {
  app.use('/webfiles', express.static(localWebfiles, staticOptions));
}

// Fallback for media trapped inside Hostinger hbuilds temporary directories
const hbuildsLegacyMedia = path.resolve(__dirname, '../../phonesdaddy_media');
if (fs.existsSync(hbuildsLegacyMedia) && path.resolve(hbuildsLegacyMedia) !== path.resolve(UPLOADS_BASE) && path.resolve(hbuildsLegacyMedia) !== path.resolve(WEBFILES_BASE)) {
  const hUploads = path.join(hbuildsLegacyMedia, 'uploads');
  const hWebfiles = path.join(hbuildsLegacyMedia, 'webfiles');
  if (fs.existsSync(hUploads)) app.use('/uploads', express.static(hUploads, staticOptions));
  if (fs.existsSync(hWebfiles)) app.use('/webfiles', express.static(hWebfiles, staticOptions));
}

// 2. Persistent Images Directory (if configured)
if (IMAGES_BASE && fs.existsSync(IMAGES_BASE) && path.resolve(IMAGES_BASE) !== path.resolve(__dirname, '../public/images')) {
  app.use('/images', express.static(IMAGES_BASE, staticOptions));
}

// 3. Mount general public static directory (CSS, JS, bundled icons)
app.use(express.static(path.join(__dirname, '../public'), staticOptions));

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
app.use('/api/pta-tax', ptaRoutes); // Handles /api/pta-tax/calculate, /popular, /slabs


// View & Page Routes (HTML templates & SEO)
app.use('/', viewRoutes);

// Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
