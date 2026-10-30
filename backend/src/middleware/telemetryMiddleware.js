import { telemetryStore } from '../services/telemetryStore.js';
import jwt from 'jsonwebtoken';

export const telemetryMiddleware = (req, res, next) => {
  const start = process.hrtime();
  const bytesIn = Number(req.headers['content-length'] || 0) + 128; // Estimated payload + headers

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);
    const bytesOut = Number(res.getHeader('content-length') || 512);

    // Identify branch from headers, query, or user JWT token
    let branchCode = req.headers['x-branch-code'] || 
                     req.headers['x-branch'] || 
                     req.headers['x-tenant-db'] || 
                     req.headers['tenant-db'] || 
                     req.query.branch || 
                     req.query.tenant;
    
    if (!branchCode && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.decode(token);
        if (decoded?.branch?.code) {
          branchCode = decoded.branch.code;
        } else if (decoded?.branchCode) {
          branchCode = decoded.branchCode;
        } else if (decoded?.tenantDb && decoded.tenantDb !== 'fishes') {
          branchCode = decoded.tenantDb;
        }
      } catch {
        // ignore
      }
    }

    const normalizedBranch = branchCode ? String(branchCode).trim().toUpperCase() : 'GLOBAL';

    telemetryStore.recordRequest({
      durationMs,
      status: res.statusCode,
      bytesIn,
      bytesOut,
      branchCode: normalizedBranch
    });
  });

  next();
};

export default telemetryMiddleware;
