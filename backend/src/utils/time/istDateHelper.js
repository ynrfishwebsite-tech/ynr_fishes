/**
 * Universal Indian Standard Time (IST, UTC+5:30) Date Utility
 * Ensures consistent day-boundary calculations across all controllers and aggregations.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5 hours 30 mins in ms

/**
 * Returns current Date in IST representation
 */
export const getISTNow = () => {
  const utcNow = new Date();
  return new Date(utcNow.getTime() + IST_OFFSET_MS);
};

/**
 * Given a date or ISO string, returns the exact UTC Date objects for 
 * 00:00:00.000 IST and 23:59:59.999 IST of that day.
 * 
 * Example: For 2026-11-07 IST:
 * start = 2026-11-06T18:30:00.000Z
 * end   = 2026-11-07T18:29:59.999Z
 */
export const getISTDayBounds = (dateInput = new Date()) => {
  const d = new Date(dateInput);
  // Shift to IST virtual wall-clock time
  const istTime = new Date(d.getTime() + IST_OFFSET_MS);
  
  const year = istTime.getUTCFullYear();
  const month = istTime.getUTCMonth();
  const day = istTime.getUTCDate();
  
  // Midnight IST in UTC: UTC(year, month, day, 0, 0, 0) - 5h30m
  const startUtc = new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - IST_OFFSET_MS);
  // End of day IST in UTC: UTC(year, month, day, 23, 59, 59, 999) - 5h30m
  const endUtc = new Date(Date.UTC(year, month, day, 23, 59, 59, 999) - IST_OFFSET_MS);
  
  return { start: startUtc, end: endUtc };
};

/**
 * Parses user-provided start/end dates or preset range into exact UTC boundaries based on IST
 */
export const resolveISTDateRange = (startDate, endDate) => {
  if (startDate && endDate) {
    const s = new Date(startDate);
    const e = new Date(endDate);
    
    // Check if dates are just YYYY-MM-DD strings or full ISO
    const startBounds = getISTDayBounds(s);
    let endBounds = getISTDayBounds(e);
    
    // If startDate and endDate point to same calendar day or exact range
    if (s.getTime() === e.getTime()) {
      return { start: startBounds.start, end: startBounds.end };
    }
    
    // If full ISO was passed with non-zero hours, respect the provided instant
    const hasSpecificTime = s.getUTCHours() !== 0 || s.getUTCMinutes() !== 0 || e.getUTCHours() !== 0 || e.getUTCMinutes() !== 0;
    if (hasSpecificTime) {
      return { start: s, end: e };
    }
    
    return { start: startBounds.start, end: endBounds.end };
  }
  
  // Default to today in IST
  return getISTDayBounds(new Date());
};

/**
 * Format a Date object to readable IST string
 */
export const formatToISTString = (dateInput = new Date()) => {
  const d = new Date(dateInput);
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
};

