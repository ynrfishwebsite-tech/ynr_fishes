import express from 'express';
const router = express.Router();
import { 
  getAnalytics, 
  getDayBook, 
  exportDayBookExcel, 
  downloadDailyReportCSV, 
  downloadMonthlyReportExcel,
  sendDayBookWhatsApp,
  sendAnalyticsWhatsApp,
  downloadSecureReport
} from '../../controllers/analytics/analyticsController.js';
import { getSalesForecast } from '../../controllers/analytics/forecastController.js';
import { authenticateToken, requireStaff } from '../../middleware/auth.js';

// GET forecast - Admin users only
router.get('/forecast', authenticateToken, requireStaff, getSalesForecast);

// GET analytics - Admin users only
router.get('/', authenticateToken, requireStaff, getAnalytics);

// GET DayBook - Available to Cashier & Admin
router.get('/daybook', authenticateToken, getDayBook);

// Export DayBook - Available to Cashier & Admin
router.get('/daybook/export', authenticateToken, exportDayBookExcel);

// Direct WhatsApp Delivery for DayBook & Analytics - Available to all authenticated staff (Cashier, Manager, Admin)
router.post('/daybook/whatsapp', authenticateToken, sendDayBookWhatsApp);
router.post('/whatsapp', authenticateToken, sendAnalyticsWhatsApp);

// Download reports - Available to Cashier & Admin
router.get('/download/daily/csv', authenticateToken, downloadDailyReportCSV);
router.get('/download/monthly/excel', authenticateToken, downloadMonthlyReportExcel);
router.get('/download/:reportId', authenticateToken, downloadSecureReport);

export default router;
