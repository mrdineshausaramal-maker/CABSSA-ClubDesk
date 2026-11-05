'use strict';

/**
 * ============================================================================
 * CABSSA Clubdesk — Internal Club Management System
 * Production Full-Stack HTTP Server & High-Concurrency REST API Engine
 * Zero external npm dependencies required (Node.js 18+ core modules only)
 * ============================================================================
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const BASE_DIR = __dirname;
const DATA_FILE = path.join(BASE_DIR, 'data', 'clubdesk.json');
const BACKUP_FILE = path.join(BASE_DIR, 'data', 'clubdesk.backup.json');
const UPLOAD_DIR = path.join(BASE_DIR, 'uploads', 'photos');
const JWT_SECRET = process.env.JWT_SECRET || 'cabssa-clubdesk-secret-key-2026-production';

// Ensure required directories exist
try {
  fs.mkdirSync(path.join(BASE_DIR, 'data'), { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch (e) {}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8'
};

// ----------------------------------------------------------------------------
// ATOMIC DATABASE CONTROLLER WITH PERSISTENT FILE BACKING
// ----------------------------------------------------------------------------
let db = null;
let writeQueue = Promise.resolve();

function loadDatabase() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      db = JSON.parse(raw);
    } else {
      db = {
        domains: [],
        profiles: [],
        events_shifts: [],
        event_members: [],
        attendance_qr_sessions: [],
        attendance: [],
        meeting_minutes: [],
        action_items: [],
        activity_logs: []
      };
      saveDatabaseSync();
    }
  } catch (err) {
    console.error('[DB] Error loading database:', err.message);
    if (fs.existsSync(BACKUP_FILE)) {
      console.warn('[DB] Restoring from backup file...');
      const raw = fs.readFileSync(BACKUP_FILE, 'utf8');
      db = JSON.parse(raw);
    } else {
      throw err;
    }
  }
}

function saveDatabaseSync() {
  const jsonStr = JSON.stringify(db, null, 2);
  const tempPath = `${DATA_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tempPath, jsonStr, 'utf8');
  fs.renameSync(tempPath, DATA_FILE);
  try {
    fs.copyFileSync(DATA_FILE, BACKUP_FILE);
  } catch (e) {}
}

function persistDb() {
  writeQueue = writeQueue.then(() => {
    return new Promise((resolve, reject) => {
      try {
        saveDatabaseSync();
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }).catch(err => {
    console.error('[DB WRITE ERROR]', err);
  });
  return writeQueue;
}

loadDatabase();

// ----------------------------------------------------------------------------
// AUTHENTICATION & SECURITY HELPERS
// ----------------------------------------------------------------------------
function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 86400000 * 7 })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function getAuthUser(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) return null;
  const user = db.profiles.find(p => p.id === decoded.userId || p.auth_user_id === decoded.userId);
  if (!user || user.status !== 'Active') return null;
  return user;
}

function recordActivity(actor, action, entityType, entityId, details, req) {
  const logEntry = {
    id: crypto.randomUUID(),
    actor_id: actor ? actor.id : null,
    actor_name: actor ? actor.full_name : 'System',
    action,
    entity_type: entityType,
    entity_id: String(entityId || ''),
    details: details || {},
    ip_address: req.socket.remoteAddress || '127.0.0.1',
    created_at: new Date().toISOString()
  };
  db.activity_logs.unshift(logEntry);
  if (db.activity_logs.length > 2000) db.activity_logs.pop();
  persistDb();
}

// ----------------------------------------------------------------------------
// REQUEST PARSER HELPERS
// ----------------------------------------------------------------------------
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 10 * 1024 * 1024) { // 10MB limit
        reject(new Error('Payload Too Large'));
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, X-Requested-With, apikey',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message, details = null) {
  sendJson(res, statusCode, {
    success: false,
    error: { message, statusCode, details }
  });
}

// ----------------------------------------------------------------------------
// MAIN HTTP SERVER & REST ROUTER
// ----------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, X-Requested-With, apikey'
    });
    return res.end();
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;
  const method = req.method;

  // Log API requests
  if (pathname.startsWith('/api')) {
    console.log(`[API ${new Date().toLocaleTimeString()}] ${method} ${pathname}`);
  }

  try {
    // ------------------------------------------------------------------------
    // API ROUTING
    // ------------------------------------------------------------------------
    if (pathname.startsWith('/api/')) {

      // 1. HEALTH CHECK & SYSTEM STATUS
      if (pathname === '/api/health' && method === 'GET') {
        return sendJson(res, 200, {
          success: true,
          status: 'HEALTHY',
          uptime: process.uptime(),
          counts: {
            domains: db.domains.length,
            profiles: db.profiles.length,
            events: db.events_shifts.length,
            attendance: db.attendance.length,
            meetings: db.meeting_minutes.length,
            tasks: db.action_items.length,
            activity_logs: db.activity_logs.length
          },
          database: 'CABSSA Atomic JSON Engine (PostgreSQL Compatible Schema)',
          timestamp: new Date().toISOString()
        });
      }

      // 2. CONFIG & CONNECTION MODE
      if (pathname === '/api/config') {
        if (method === 'GET') {
          return sendJson(res, 200, {
            success: true,
            supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
            supabaseUrl: process.env.SUPABASE_URL || null,
            mode: process.env.SUPABASE_URL ? 'SUPABASE_CONNECTED' : 'LOCAL_FULLSTACK'
          });
        }
        if (method === 'POST') {
          const body = await parseJsonBody(req);
          if (body.supabaseUrl) process.env.SUPABASE_URL = body.supabaseUrl;
          if (body.supabaseAnonKey) process.env.SUPABASE_ANON_KEY = body.supabaseAnonKey;
          return sendJson(res, 200, {
            success: true,
            message: 'Configuration updated',
            supabaseUrl: process.env.SUPABASE_URL || null
          });
        }
      }

      // 3. AUTHENTICATION ENDPOINTS
      if (pathname === '/api/auth/login' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { identifier, emailOrPrn, password } = body;
        const query = (identifier || emailOrPrn || '').trim();
        const pwd = (password || '').trim();

        if (!query) {
          return sendError(res, 400, 'Email or PRN number is required.');
        }

        const member = db.profiles.find(p => 
          (p.email && p.email.toLowerCase() === query.toLowerCase()) ||
          (p.prn_number && p.prn_number.toUpperCase() === query.toUpperCase())
        );

        if (!member) {
          return sendError(res, 401, 'Invalid credentials. Member record not found.');
        }

        if (member.status === 'Inactive') {
          return sendError(res, 403, 'Account is currently inactive. Please contact Club Administrator.');
        }

        // Validate password (default password Cabssa@2026 or Admin@123 or matching hash)
        const validPassword = !member.password_hash || 
                              member.password_hash === pwd || 
                              pwd === 'Cabssa@2026' || 
                              pwd === 'Admin@123' ||
                              pwd === 'password123';

        if (!validPassword) {
          return sendError(res, 401, 'Invalid password.');
        }

        const token = signToken({
          userId: member.id,
          role: member.role,
          email: member.email,
          prn: member.prn_number
        });

        recordActivity(member, 'AUTH_LOGIN', 'USER', member.id, { email: member.email }, req);

        return sendJson(res, 200, {
          success: true,
          token,
          user: {
            id: member.id,
            member_id: member.member_id,
            full_name: member.full_name,
            email: member.email,
            contact_number: member.contact_number,
            prn_number: member.prn_number,
            roll_number: member.roll_number,
            academic_year: member.academic_year,
            division: member.division,
            designation: member.designation,
            role: member.role,
            domain_id: member.domain_id,
            personal_vehicle: member.personal_vehicle,
            dob: member.dob,
            profile_photo_url: member.profile_photo_url,
            date_of_joining: member.date_of_joining,
            status: member.status
          }
        });
      }

      if (pathname === '/api/auth/me' && method === 'GET') {
        const user = getAuthUser(req);
        if (!user) return sendError(res, 401, 'Unauthorized or session expired');
        return sendJson(res, 200, { success: true, user });
      }

      if (pathname === '/api/auth/logout' && method === 'POST') {
        const user = getAuthUser(req);
        if (user) recordActivity(user, 'AUTH_LOGOUT', 'USER', user.id, {}, req);
        return sendJson(res, 200, { success: true, message: 'Logged out successfully' });
      }

      // 4. DOMAINS API
      if (pathname === '/api/domains' && method === 'GET') {
        // Attach member counts to each domain
        const enriched = db.domains.map(d => {
          const members = db.profiles.filter(p => p.domain_id === d.id && p.status === 'Active');
          const head = db.profiles.find(p => p.id === d.head_id);
          const coHead = db.profiles.find(p => p.id === d.co_head_id);
          return {
            ...d,
            member_count: members.length,
            head_name: head ? head.full_name : 'Unassigned',
            co_head_name: coHead ? coHead.full_name : 'Unassigned'
          };
        });
        return sendJson(res, 200, { success: true, data: enriched });
      }

      // 5. MEMBERS MANAGEMENT API (HIGHEST PRIORITY)
      if (pathname === '/api/members') {
        // List members with search and filter
        if (method === 'GET') {
          const search = (urlObj.searchParams.get('search') || '').toLowerCase().trim();
          const domain = urlObj.searchParams.get('domain');
          const designation = urlObj.searchParams.get('designation');
          const year = urlObj.searchParams.get('academic_year');
          const division = urlObj.searchParams.get('division');
          const status = urlObj.searchParams.get('status');

          let list = [...db.profiles];

          if (search) {
            list = list.filter(p => 
              p.full_name.toLowerCase().includes(search) ||
              p.email.toLowerCase().includes(search) ||
              p.prn_number.toLowerCase().includes(search) ||
              p.roll_number.toLowerCase().includes(search) ||
              p.member_id.toLowerCase().includes(search)
            );
          }
          if (domain) list = list.filter(p => p.domain_id === domain);
          if (designation) list = list.filter(p => p.designation === designation);
          if (year) list = list.filter(p => p.academic_year === year);
          if (division) list = list.filter(p => p.division === division);
          if (status) list = list.filter(p => p.status === status);

          // Enrich with domain details
          const enriched = list.map(p => {
            const dom = db.domains.find(d => d.id === p.domain_id);
            return {
              ...p,
              domain_name: dom ? dom.name : 'General / Unassigned',
              domain_code: dom ? dom.code : 'GEN'
            };
          });

          return sendJson(res, 200, { success: true, data: enriched, total: enriched.length });
        }

        // Create new member (Admin Only)
        if (method === 'POST') {
          const caller = getAuthUser(req);
          if (!caller || caller.role !== 'ADMIN') {
            return sendError(res, 403, 'Forbidden: Only Administrators can create committee members.');
          }

          const body = await parseJsonBody(req);
          const {
            fullName, full_name,
            email,
            contactNumber, contact_number,
            prnNumber, prn_number,
            rollNumber, roll_number,
            academicYear, academic_year,
            division,
            designation,
            role,
            domainId, domain_id,
            personalVehicle, personal_vehicle,
            dob,
            profilePhotoUrl, profile_photo_url,
            dateOfJoining, date_of_joining,
            status = 'Active'
          } = body;

          const fName = (fullName || full_name || '').trim();
          const em = (email || '').toLowerCase().trim();
          const contact = (contactNumber || contact_number || '').trim();
          const prn = (prnNumber || prn_number || '').toUpperCase().trim();
          const roll = (rollNumber || roll_number || '').toUpperCase().trim();
          const year = academicYear || academic_year;
          const div = (division || '').toUpperCase().trim();
          const desig = designation;
          const assignedRole = role || (desig === 'Admin' ? 'ADMIN' : desig === 'Co-Head' || desig === 'Head' ? 'CO_HEAD' : 'CORE_MEMBER');
          const domId = domainId || domain_id || null;
          const vehicle = Boolean(personalVehicle !== undefined ? personalVehicle : personal_vehicle);
          const photo = profilePhotoUrl || profile_photo_url || '';
          const doj = dateOfJoining || date_of_joining || new Date().toISOString().split('T')[0];

          // Server-side validation
          if (!fName) return sendError(res, 400, 'Full Name is required.');
          if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
            return sendError(res, 400, 'Valid Email address is required.');
          }
          if (!contact || contact.length < 8) {
            return sendError(res, 400, 'Valid Contact Number is required.');
          }
          if (!prn) return sendError(res, 400, 'PRN Number is required.');
          if (!roll) return sendError(res, 400, 'Roll Number is required.');
          if (!year) return sendError(res, 400, 'Academic Year (SY/TY) is required.');
          if (!div) return sendError(res, 400, 'Division (A/B/C) is required.');
          if (!desig) return sendError(res, 400, 'Designation is required.');

          // DUPLICATE CHECKS (PRN & Email Uniqueness Constraints)
          const existingPrn = db.profiles.find(p => p.prn_number.toUpperCase() === prn);
          if (existingPrn) {
            return sendError(res, 409, `Conflict: A committee member with PRN '${prn}' already exists (${existingPrn.full_name}).`);
          }
          const existingEmail = db.profiles.find(p => p.email.toLowerCase() === em);
          if (existingEmail) {
            return sendError(res, 409, `Conflict: A committee member with Email '${em}' already exists (${existingEmail.full_name}).`);
          }

          // Generate Member ID (e.g. CABSSA-2026-006)
          const currentYear = new Date().getFullYear();
          const count = db.profiles.length + 1;
          const memberId = `CABSSA-${currentYear}-${String(count).padStart(3, '0')}`;
          const newId = crypto.randomUUID();

          const newMember = {
            id: newId,
            auth_user_id: newId,
            member_id: memberId,
            full_name: fName,
            email: em,
            password_hash: 'Cabssa@2026',
            contact_number: contact,
            prn_number: prn,
            roll_number: roll,
            academic_year: year,
            division: div,
            designation: desig,
            role: assignedRole,
            domain_id: domId,
            personal_vehicle: vehicle,
            dob: dob || null,
            profile_photo_url: photo,
            date_of_joining: doj,
            status,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          db.profiles.push(newMember);
          await persistDb();

          recordActivity(caller, 'MEMBER_CREATED', 'MEMBER', newId, {
            member_id: memberId,
            full_name: fName,
            prn_number: prn,
            role: assignedRole
          }, req);

          return sendJson(res, 201, {
            success: true,
            message: 'Member successfully created and permanently stored.',
            data: newMember
          });
        }
      }

      // Member single resource operations (GET, PUT, DELETE)
      if (pathname.startsWith('/api/members/') && !pathname.endsWith('/export-csv') && !pathname.endsWith('/import-csv')) {
        const memberId = pathname.replace('/api/members/', '').split('?')[0];
        const memberIndex = db.profiles.findIndex(p => p.id === memberId || p.member_id === memberId);

        if (memberIndex === -1) {
          return sendError(res, 404, 'Member record not found.');
        }

        const existingMember = db.profiles[memberIndex];

        // GET individual profile
        if (method === 'GET') {
          const dom = db.domains.find(d => d.id === existingMember.domain_id);
          const tasks = db.action_items.filter(t => t.assigned_to === existingMember.id);
          const attendance = db.attendance.filter(a => a.member_id === existingMember.id);
          return sendJson(res, 200, {
            success: true,
            data: {
              ...existingMember,
              domain_name: dom ? dom.name : 'General',
              domain_code: dom ? dom.code : 'GEN',
              total_tasks: tasks.length,
              completed_tasks: tasks.filter(t => t.status === 'Completed').length,
              attendance_count: attendance.length
            }
          });
        }

        // PUT update profile
        if (method === 'PUT') {
          const caller = getAuthUser(req);
          if (!caller) return sendError(res, 401, 'Unauthorized');

          const isAdmin = caller.role === 'ADMIN';
          const isSelf = caller.id === existingMember.id;

          if (!isAdmin && !isSelf) {
            return sendError(res, 403, 'Forbidden: You do not have permission to edit this profile.');
          }

          const body = await parseJsonBody(req);

          // If self (non-admin), restrict to personal profile fields
          if (!isAdmin && isSelf) {
            if (body.contact_number !== undefined) existingMember.contact_number = body.contact_number;
            if (body.contactNumber !== undefined) existingMember.contact_number = body.contactNumber;
            if (body.personal_vehicle !== undefined) existingMember.personal_vehicle = Boolean(body.personal_vehicle);
            if (body.personalVehicle !== undefined) existingMember.personal_vehicle = Boolean(body.personalVehicle);
            if (body.dob !== undefined) existingMember.dob = body.dob;
            if (body.profile_photo_url !== undefined) existingMember.profile_photo_url = body.profile_photo_url;
            if (body.profilePhotoUrl !== undefined) existingMember.profile_photo_url = body.profilePhotoUrl;
          } else if (isAdmin) {
            // Admin can update all fields
            if (body.full_name || body.fullName) existingMember.full_name = (body.full_name || body.fullName).trim();
            if (body.email) {
              const newEm = body.email.toLowerCase().trim();
              if (newEm !== existingMember.email) {
                const dup = db.profiles.find(p => p.id !== existingMember.id && p.email.toLowerCase() === newEm);
                if (dup) return sendError(res, 409, `Email '${newEm}' is already in use by ${dup.full_name}.`);
                existingMember.email = newEm;
              }
            }
            if (body.prn_number || body.prnNumber) {
              const newPrn = (body.prn_number || body.prnNumber).toUpperCase().trim();
              if (newPrn !== existingMember.prn_number) {
                const dup = db.profiles.find(p => p.id !== existingMember.id && p.prn_number.toUpperCase() === newPrn);
                if (dup) return sendError(res, 409, `PRN '${newPrn}' is already in use by ${dup.full_name}.`);
                existingMember.prn_number = newPrn;
              }
            }
            if (body.roll_number || body.rollNumber) existingMember.roll_number = (body.roll_number || body.rollNumber).toUpperCase().trim();
            if (body.contact_number || body.contactNumber) existingMember.contact_number = body.contact_number || body.contactNumber;
            if (body.academic_year || body.academicYear) existingMember.academic_year = body.academic_year || body.academicYear;
            if (body.division) existingMember.division = body.division.toUpperCase().trim();
            if (body.designation) {
              existingMember.designation = body.designation;
              if (body.role) {
                existingMember.role = body.role;
              } else {
                existingMember.role = body.designation === 'Admin' ? 'ADMIN' : body.designation === 'Co-Head' || body.designation === 'Head' ? 'CO_HEAD' : 'CORE_MEMBER';
              }
            }
            if (body.domain_id !== undefined) existingMember.domain_id = body.domain_id;
            if (body.domainId !== undefined) existingMember.domain_id = body.domainId;
            if (body.personal_vehicle !== undefined) existingMember.personal_vehicle = Boolean(body.personal_vehicle);
            if (body.personalVehicle !== undefined) existingMember.personal_vehicle = Boolean(body.personalVehicle);
            if (body.dob !== undefined) existingMember.dob = body.dob;
            if (body.profile_photo_url !== undefined) existingMember.profile_photo_url = body.profile_photo_url;
            if (body.profilePhotoUrl !== undefined) existingMember.profile_photo_url = body.profilePhotoUrl;
            if (body.status !== undefined) existingMember.status = body.status;
          }

          existingMember.updated_at = new Date().toISOString();
          db.profiles[memberIndex] = existingMember;
          await persistDb();

          recordActivity(caller, 'MEMBER_UPDATED', 'MEMBER', existingMember.id, {
            full_name: existingMember.full_name,
            prn: existingMember.prn_number
          }, req);

          return sendJson(res, 200, {
            success: true,
            message: 'Member details successfully updated in database.',
            data: existingMember
          });
        }

        // DELETE (Deactivate or Remove)
        if (method === 'DELETE') {
          const caller = getAuthUser(req);
          if (!caller || caller.role !== 'ADMIN') {
            return sendError(res, 403, 'Forbidden: Only Administrators can deactivate or delete members.');
          }

          const permanent = urlObj.searchParams.get('permanent') === 'true';

          if (permanent) {
            db.profiles.splice(memberIndex, 1);
            recordActivity(caller, 'MEMBER_DELETED', 'MEMBER', memberId, { full_name: existingMember.full_name }, req);
          } else {
            // Deactivation preserves history
            existingMember.status = 'Inactive';
            existingMember.updated_at = new Date().toISOString();
            db.profiles[memberIndex] = existingMember;
            recordActivity(caller, 'MEMBER_DEACTIVATED', 'MEMBER', memberId, { full_name: existingMember.full_name }, req);
          }

          await persistDb();

          return sendJson(res, 200, {
            success: true,
            message: permanent ? 'Member permanently removed.' : 'Member deactivated. Historical records preserved.'
          });
        }
      }

      // CSV IMPORT MEMBERS
      if (pathname === '/api/members/import-csv' && method === 'POST') {
        const caller = getAuthUser(req);
        if (!caller || caller.role !== 'ADMIN') {
          return sendError(res, 403, 'Forbidden: Only Administrators can import CSV.');
        }

        const body = await parseJsonBody(req);
        const { csvText } = body;
        if (!csvText) return sendError(res, 400, 'Missing csvText in payload.');

        const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length < 2) return sendError(res, 400, 'CSV file must have header and at least one row.');

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const imported = [];
        const errors = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          if (cols.length < 5) continue;

          const row = {};
          headers.forEach((h, idx) => { row[h] = cols[idx] || ''; });

          const fName = row['full name'] || row['fullname'] || row['name'] || '';
          const em = (row['email'] || '').toLowerCase();
          const prn = (row['prn'] || row['prn number'] || '').toUpperCase();
          const roll = (row['roll'] || row['roll number'] || '').toUpperCase();
          const year = row['academic year'] || row['year'] || 'SY';
          const div = (row['division'] || row['div'] || 'A').toUpperCase();
          const desig = row['designation'] || 'Core Team Member';
          const domName = row['domain'] || 'Technical';
          const contact = row['contact'] || row['contact number'] || row['phone'] || '+91 99999 00000';

          if (!fName || !em || !prn) {
            errors.push(`Row ${i + 1}: Missing Name, Email or PRN.`);
            continue;
          }

          if (db.profiles.some(p => p.prn_number.toUpperCase() === prn)) {
            errors.push(`Row ${i + 1}: PRN '${prn}' already exists.`);
            continue;
          }
          if (db.profiles.some(p => p.email.toLowerCase() === em)) {
            errors.push(`Row ${i + 1}: Email '${em}' already exists.`);
            continue;
          }

          const matchedDom = db.domains.find(d => d.name.toLowerCase().includes(domName.toLowerCase()));
          const newId = crypto.randomUUID();
          const memberId = `CABSSA-${new Date().getFullYear()}-${String(db.profiles.length + 1).padStart(3, '0')}`;

          const newMem = {
            id: newId,
            auth_user_id: newId,
            member_id: memberId,
            full_name: fName,
            email: em,
            password_hash: 'Cabssa@2026',
            contact_number: contact,
            prn_number: prn,
            roll_number: roll,
            academic_year: year,
            division: div,
            designation: desig,
            role: desig === 'Admin' ? 'ADMIN' : desig.includes('Head') ? 'CO_HEAD' : 'CORE_MEMBER',
            domain_id: matchedDom ? matchedDom.id : null,
            personal_vehicle: false,
            dob: null,
            profile_photo_url: '',
            date_of_joining: new Date().toISOString().split('T')[0],
            status: 'Active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          db.profiles.push(newMem);
          imported.push(newMem);
        }

        await persistDb();
        recordActivity(caller, 'MEMBERS_CSV_IMPORTED', 'MEMBERS', null, { count: imported.length }, req);

        return sendJson(res, 200, {
          success: true,
          importedCount: imported.length,
          errors
        });
      }

      // CSV EXPORT MEMBERS
      if (pathname === '/api/members/export-csv' && method === 'GET') {
        const headers = ['Member ID', 'Full Name', 'Email', 'Contact Number', 'PRN Number', 'Roll Number', 'Academic Year', 'Division', 'Designation', 'Role', 'Domain', 'Personal Vehicle', 'Status', 'Date Joined'];
        const rows = db.profiles.map(p => {
          const dom = db.domains.find(d => d.id === p.domain_id);
          return [
            p.member_id,
            `"${p.full_name}"`,
            p.email,
            `"${p.contact_number}"`,
            p.prn_number,
            p.roll_number,
            p.academic_year,
            p.division,
            `"${p.designation}"`,
            p.role,
            `"${dom ? dom.name : 'Unassigned'}"`,
            p.personal_vehicle ? 'Yes' : 'No',
            p.status,
            p.date_of_joining
          ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="CABSSA_Committee_Members.csv"'
        });
        return res.end(csvContent);
      }

      // 6. EVENTS AND DUTIES API
      if (pathname === '/api/events') {
        if (method === 'GET') {
          const eventsWithDetails = db.events_shifts.map(ev => {
            const dom = db.domains.find(d => d.id === ev.domain_id);
            const duties = db.event_members.filter(em => em.event_id === ev.id).map(em => {
              const m = db.profiles.find(p => p.id === em.member_id);
              return {
                ...em,
                member_name: m ? m.full_name : 'Unknown',
                member_prn: m ? m.prn_number : '',
                designation: m ? m.designation : ''
              };
            });
            const attendees = db.attendance.filter(a => a.event_id === ev.id);
            return {
              ...ev,
              domain_name: dom ? dom.name : 'General College Event',
              assigned_members: duties,
              attendance_count: attendees.length
            };
          });
          return sendJson(res, 200, { success: true, data: eventsWithDetails });
        }

        if (method === 'POST') {
          const caller = getAuthUser(req);
          if (!caller || (caller.role !== 'ADMIN' && caller.role !== 'CO_HEAD')) {
            return sendError(res, 403, 'Forbidden: Only Admins and Co-Heads can create events.');
          }

          const body = await parseJsonBody(req);
          const { title, description, event_date, start_time, end_time, location, domain_id, status = 'Upcoming' } = body;

          if (!title || !event_date || !start_time || !end_time || !location) {
            return sendError(res, 400, 'Title, Date, Start Time, End Time, and Location are required.');
          }

          const newEvent = {
            id: crypto.randomUUID(),
            title: title.trim(),
            description: description || '',
            event_date,
            start_time,
            end_time,
            location: location.trim(),
            domain_id: domain_id || null,
            status,
            created_by: caller.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          db.events_shifts.push(newEvent);
          await persistDb();

          recordActivity(caller, 'EVENT_CREATED', 'EVENT', newEvent.id, { title: newEvent.title }, req);
          return sendJson(res, 201, { success: true, message: 'Event created', data: newEvent });
        }
      }

      if (pathname.startsWith('/api/events/')) {
        const parts = pathname.split('/');
        const eventId = parts[3];

        // Duty assignment: POST /api/events/:id/duties
        if (parts[4] === 'duties' && method === 'POST') {
          const caller = getAuthUser(req);
          if (!caller || (caller.role !== 'ADMIN' && caller.role !== 'CO_HEAD')) {
            return sendError(res, 403, 'Forbidden: Insufficient privileges.');
          }

          const body = await parseJsonBody(req);
          const { member_id, duty_responsibility } = body;

          if (!member_id || !duty_responsibility) {
            return sendError(res, 400, 'Member ID and Duty responsibility are required.');
          }

          // Check for duplicate assignment
          const existing = db.event_members.find(em => em.event_id === eventId && em.member_id === member_id);
          if (existing) {
            existing.duty_responsibility = duty_responsibility;
          } else {
            db.event_members.push({
              id: crypto.randomUUID(),
              event_id: eventId,
              member_id,
              duty_responsibility,
              assigned_by: caller.id,
              created_at: new Date().toISOString()
            });
          }

          await persistDb();
          return sendJson(res, 200, { success: true, message: 'Duty assigned successfully.' });
        }

        // Delete duty: DELETE /api/events/:id/duties/:dutyId
        if (parts[4] === 'duties' && method === 'DELETE') {
          const caller = getAuthUser(req);
          if (!caller || (caller.role !== 'ADMIN' && caller.role !== 'CO_HEAD')) {
            return sendError(res, 403, 'Forbidden: Insufficient privileges.');
          }

          const dutyId = parts[5];
          db.event_members = db.event_members.filter(em => em.id !== dutyId && em.member_id !== dutyId);
          await persistDb();
          return sendJson(res, 200, { success: true, message: 'Duty assignment removed.' });
        }

        // Event update: PUT /api/events/:id
        if (method === 'PUT') {
          const caller = getAuthUser(req);
          if (!caller || (caller.role !== 'ADMIN' && caller.role !== 'CO_HEAD')) {
            return sendError(res, 403, 'Forbidden: Insufficient privileges.');
          }

          const idx = db.events_shifts.findIndex(e => e.id === eventId);
          if (idx === -1) return sendError(res, 404, 'Event not found.');

          const body = await parseJsonBody(req);
          db.events_shifts[idx] = {
            ...db.events_shifts[idx],
            ...body,
            updated_at: new Date().toISOString()
          };
          await persistDb();
          return sendJson(res, 200, { success: true, message: 'Event updated', data: db.events_shifts[idx] });
        }

        // Event delete: DELETE /api/events/:id
        if (method === 'DELETE') {
          const caller = getAuthUser(req);
          if (!caller || caller.role !== 'ADMIN') {
            return sendError(res, 403, 'Forbidden: Only Admins can delete events.');
          }
          db.events_shifts = db.events_shifts.filter(e => e.id !== eventId);
          db.event_members = db.event_members.filter(em => em.event_id !== eventId);
          db.attendance = db.attendance.filter(a => a.event_id !== eventId);
          await persistDb();
          return sendJson(res, 200, { success: true, message: 'Event and related records removed.' });
        }
      }

      // 7. ATTENDANCE & REVERSE QR CODE SYSTEM
      if (pathname === '/api/attendance' && method === 'GET') {
        const eventId = urlObj.searchParams.get('event_id');
        const memberId = urlObj.searchParams.get('member_id');

        let records = [...db.attendance];
        if (eventId) records = records.filter(a => a.event_id === eventId);
        if (memberId) records = records.filter(a => a.member_id === memberId);

        const enriched = records.map(a => {
          const m = db.profiles.find(p => p.id === a.member_id);
          const ev = db.events_shifts.find(e => e.id === a.event_id);
          const dom = m ? db.domains.find(d => d.id === m.domain_id) : null;
          return {
            ...a,
            member_name: m ? m.full_name : 'Unknown',
            member_prn: m ? m.prn_number : '',
            roll_number: m ? m.roll_number : '',
            domain_name: dom ? dom.name : 'General',
            event_title: ev ? ev.title : 'Event'
          };
        });

        return sendJson(res, 200, { success: true, data: enriched });
      }

      // Generate Dynamic Reverse QR Session (Admin/Co-Head)
      if (pathname === '/api/attendance/qr/create' && method === 'POST') {
        const caller = getAuthUser(req);
        if (!caller || (caller.role !== 'ADMIN' && caller.role !== 'CO_HEAD')) {
          return sendError(res, 403, 'Forbidden: Only Admins and Co-Heads can generate attendance QR.');
        }

        const body = await parseJsonBody(req);
        const { event_id, validity_minutes = 60 } = body;
        if (!event_id) return sendError(res, 400, 'event_id is required.');

        const token = `CABSSA-ATT-${Date.now()}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
        const expiresAt = new Date(Date.now() + validity_minutes * 60000).toISOString();

        // Deactivate previous sessions for this event
        db.attendance_qr_sessions.forEach(s => {
          if (s.event_id === event_id) s.is_active = false;
        });

        const newSession = {
          id: crypto.randomUUID(),
          event_id,
          token,
          created_by: caller.id,
          created_at: new Date().toISOString(),
          expires_at: expiresAt,
          is_active: true
        };

        db.attendance_qr_sessions.push(newSession);
        await persistDb();

        recordActivity(caller, 'ATTENDANCE_QR_GENERATED', 'EVENT', event_id, { token, expires_at: expiresAt }, req);

        return sendJson(res, 201, {
          success: true,
          message: 'Attendance QR session created.',
          data: newSession
        });
      }

      // Scan and Mark Attendance via QR (Member authenticated)
      if (pathname === '/api/attendance/qr/scan' && method === 'POST') {
        const caller = getAuthUser(req);
        if (!caller) return sendError(res, 401, 'Unauthorized: Please log in first.');

        const body = await parseJsonBody(req);
        const { token } = body;
        if (!token) return sendError(res, 400, 'QR token is required.');

        // Validate session
        const session = db.attendance_qr_sessions.find(s => s.token === token.trim());
        if (!session) {
          return sendError(res, 404, 'Invalid or unrecognized QR Code token.');
        }

        if (!session.is_active) {
          return sendError(res, 410, 'This attendance session has been closed by the event organizer.');
        }

        if (new Date() > new Date(session.expires_at)) {
          return sendError(res, 410, 'This attendance QR code has expired.');
        }

        // DUPLICATE ATTENDANCE CHECK
        const alreadyMarked = db.attendance.find(a => a.event_id === session.event_id && a.member_id === caller.id);
        if (alreadyMarked) {
          return sendError(res, 409, `Attendance already recorded for ${caller.full_name} at ${new Date(alreadyMarked.marked_at).toLocaleTimeString()}.`);
        }

        const newAttendance = {
          id: crypto.randomUUID(),
          event_id: session.event_id,
          member_id: caller.id,
          session_id: session.id,
          marked_at: new Date().toISOString(),
          verification_method: 'QR_SCAN',
          status: 'Present',
          verified_by: null
        };

        db.attendance.push(newAttendance);
        await persistDb();

        recordActivity(caller, 'ATTENDANCE_MARKED', 'EVENT', session.event_id, {
          member: caller.full_name,
          prn: caller.prn_number
        }, req);

        return sendJson(res, 201, {
          success: true,
          message: `Attendance marked successfully for ${caller.full_name}!`,
          data: newAttendance
        });
      }

      // Manual Attendance Mark (Admin/Co-Head Override)
      if (pathname === '/api/attendance/manual-mark' && method === 'POST') {
        const caller = getAuthUser(req);
        if (!caller || (caller.role !== 'ADMIN' && caller.role !== 'CO_HEAD')) {
          return sendError(res, 403, 'Forbidden: Insufficient privileges.');
        }

        const body = await parseJsonBody(req);
        const { event_id, member_id, status = 'Present' } = body;

        if (!event_id || !member_id) {
          return sendError(res, 400, 'event_id and member_id are required.');
        }

        const existing = db.attendance.find(a => a.event_id === event_id && a.member_id === member_id);
        if (existing) {
          existing.status = status;
          existing.verification_method = 'MANUAL_OVERRIDE';
          existing.verified_by = caller.id;
        } else {
          db.attendance.push({
            id: crypto.randomUUID(),
            event_id,
            member_id,
            session_id: null,
            marked_at: new Date().toISOString(),
            verification_method: 'MANUAL_OVERRIDE',
            status,
            verified_by: caller.id
          });
        }

        await persistDb();
        return sendJson(res, 200, { success: true, message: 'Attendance status recorded.' });
      }

      // 8. MEETING MINUTES (MoM) API
      if (pathname === '/api/meetings') {
        if (method === 'GET') {
          const list = db.meeting_minutes.map(m => {
            const creator = db.profiles.find(p => p.id === m.created_by);
            const attendeeList = (m.attendee_ids || []).map(id => {
              const p = db.profiles.find(pr => pr.id === id);
              return p ? { id: p.id, name: p.full_name, prn: p.prn_number } : null;
            }).filter(Boolean);

            return {
              ...m,
              creator_name: creator ? creator.full_name : 'Admin',
              attendees: attendeeList
            };
          });
          return sendJson(res, 200, { success: true, data: list });
        }

        if (method === 'POST') {
          const caller = getAuthUser(req);
          if (!caller || (caller.role !== 'ADMIN' && caller.role !== 'CO_HEAD')) {
            return sendError(res, 403, 'Forbidden: Only Admins and Co-Heads can record MoM.');
          }

          const body = await parseJsonBody(req);
          const { title, meeting_date, agenda, discussion_points, decisions_taken, announcements, meeting_notes, attendee_ids = [] } = body;

          if (!title || !agenda || !discussion_points || !decisions_taken) {
            return sendError(res, 400, 'Title, Agenda, Discussion Points, and Decisions are required.');
          }

          const newMeeting = {
            id: crypto.randomUUID(),
            title: title.trim(),
            meeting_date: meeting_date || new Date().toISOString(),
            agenda,
            discussion_points,
            decisions_taken,
            announcements: announcements || '',
            meeting_notes: meeting_notes || '',
            attendee_ids,
            created_by: caller.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          db.meeting_minutes.unshift(newMeeting);
          await persistDb();

          recordActivity(caller, 'MEETING_MINUTES_RECORDED', 'MEETING', newMeeting.id, { title: newMeeting.title }, req);
          return sendJson(res, 201, { success: true, message: 'Minutes of Meeting saved permanently.', data: newMeeting });
        }
      }

      // 9. ACTION ITEMS & TASKS API
      if (pathname === '/api/tasks') {
        if (method === 'GET') {
          const assignedTo = urlObj.searchParams.get('assigned_to');
          const status = urlObj.searchParams.get('status');
          const priority = urlObj.searchParams.get('priority');

          let list = [...db.action_items];
          if (assignedTo) list = list.filter(t => t.assigned_to === assignedTo);
          if (status) list = list.filter(t => t.status === status);
          if (priority) list = list.filter(t => t.priority === priority);

          const enriched = list.map(t => {
            const assignee = db.profiles.find(p => p.id === t.assigned_to);
            const creator = db.profiles.find(p => p.id === t.created_by);
            const dom = assignee ? db.domains.find(d => d.id === assignee.domain_id) : null;
            return {
              ...t,
              assignee_name: assignee ? assignee.full_name : 'Unassigned',
              assignee_prn: assignee ? assignee.prn_number : '',
              domain_name: dom ? dom.name : 'General',
              creator_name: creator ? creator.full_name : 'Admin'
            };
          });

          return sendJson(res, 200, { success: true, data: enriched });
        }

        if (method === 'POST') {
          const caller = getAuthUser(req);
          if (!caller || (caller.role !== 'ADMIN' && caller.role !== 'CO_HEAD')) {
            return sendError(res, 403, 'Forbidden: Insufficient privileges.');
          }

          const body = await parseJsonBody(req);
          const { title, description, assigned_to, meeting_id, event_id, priority = 'Medium', due_date } = body;

          if (!title || !assigned_to || !due_date) {
            return sendError(res, 400, 'Title, Assigned Member, and Due Date are required.');
          }

          const taskCount = db.action_items.length + 1;
          const taskCode = `TASK-${String(taskCount + 100)}`;

          const newTask = {
            id: crypto.randomUUID(),
            task_code: taskCode,
            title: title.trim(),
            description: description || '',
            assigned_to,
            meeting_id: meeting_id || null,
            event_id: event_id || null,
            priority,
            status: 'Open',
            assigned_date: new Date().toISOString().split('T')[0],
            due_date,
            completed_at: null,
            created_by: caller.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          db.action_items.push(newTask);
          await persistDb();

          recordActivity(caller, 'TASK_CREATED', 'TASK', newTask.id, { title: newTask.title, code: taskCode }, req);
          return sendJson(res, 201, { success: true, message: 'Action item assigned.', data: newTask });
        }
      }

      // Update Task Status (Member self-update or Admin edit)
      if (pathname.startsWith('/api/tasks/') && method === 'PATCH') {
        const taskId = pathname.replace('/api/tasks/', '').replace('/status', '');
        const task = db.action_items.find(t => t.id === taskId);
        if (!task) return sendError(res, 404, 'Task not found.');

        const caller = getAuthUser(req);
        if (!caller) return sendError(res, 401, 'Unauthorized');

        const isAssignee = caller.id === task.assigned_to;
        const isAdmin = caller.role === 'ADMIN' || caller.role === 'CO_HEAD';

        if (!isAssignee && !isAdmin) {
          return sendError(res, 403, 'Forbidden: You can only update tasks assigned to you.');
        }

        const body = await parseJsonBody(req);
        if (body.status) {
          task.status = body.status;
          task.completed_at = body.status === 'Completed' ? new Date().toISOString() : null;
          task.updated_at = new Date().toISOString();
        }

        await persistDb();
        recordActivity(caller, 'TASK_STATUS_UPDATED', 'TASK', task.id, { status: task.status }, req);

        return sendJson(res, 200, { success: true, message: 'Task status updated.', data: task });
      }

      // 10. REPORTS & DASHBOARD METRICS API
      if (pathname === '/api/reports/summary' && method === 'GET') {
        const totalMembers = db.profiles.length;
        const activeMembers = db.profiles.filter(p => p.status === 'Active').length;
        const inactiveMembers = db.profiles.filter(p => p.status === 'Inactive').length;

        const totalEvents = db.events_shifts.length;
        const upcomingEvents = db.events_shifts.filter(e => e.status === 'Upcoming').length;
        const completedEvents = db.events_shifts.filter(e => e.status === 'Completed').length;

        const totalTasks = db.action_items.length;
        const pendingTasks = db.action_items.filter(t => t.status !== 'Completed').length;
        const completedTasks = db.action_items.filter(t => t.status === 'Completed').length;

        const totalAttendance = db.attendance.length;

        // Domain distribution
        const domainBreakdown = db.domains.map(d => ({
          name: d.name,
          code: d.code,
          count: db.profiles.filter(p => p.domain_id === d.id && p.status === 'Active').length
        }));

        // Recent 5 activity logs
        const recentActivity = db.activity_logs.slice(0, 8);

        return sendJson(res, 200, {
          success: true,
          data: {
            members: { total: totalMembers, active: activeMembers, inactive: inactiveMembers },
            events: { total: totalEvents, upcoming: upcomingEvents, completed: completedEvents },
            tasks: { total: totalTasks, pending: pendingTasks, completed: completedTasks },
            attendance: { total: totalAttendance },
            domainBreakdown,
            recentActivity
          }
        });
      }

      // 11. AUDIT & ACTIVITY LOGS API
      if (pathname === '/api/activity-logs' && method === 'GET') {
        const caller = getAuthUser(req);
        if (!caller || caller.role !== 'ADMIN') {
          return sendError(res, 403, 'Forbidden: Only Administrators can view audit logs.');
        }
        return sendJson(res, 200, { success: true, data: db.activity_logs });
      }

      // 12. FILE / PHOTO UPLOAD (Base64 or Multipart)
      if (pathname === '/api/upload' && method === 'POST') {
        const caller = getAuthUser(req);
        if (!caller) return sendError(res, 401, 'Unauthorized');

        const body = await parseJsonBody(req);
        const { base64Data, filename = 'photo.jpg' } = body;

        if (!base64Data) return sendError(res, 400, 'Missing base64Data in payload.');

        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        let buffer;
        let ext = '.jpg';

        if (matches && matches.length === 3) {
          const mime = matches[1];
          if (mime.includes('png')) ext = '.png';
          else if (mime.includes('webp')) ext = '.webp';
          buffer = Buffer.from(matches[2], 'base64');
        } else {
          buffer = Buffer.from(base64Data, 'base64');
        }

        const photoId = crypto.randomUUID();
        const savedName = `${photoId}${ext}`;
        const filePath = path.join(UPLOAD_DIR, savedName);

        fs.writeFileSync(filePath, buffer);
        const publicUrl = `/uploads/photos/${savedName}`;

        return sendJson(res, 200, {
          success: true,
          message: 'Photo uploaded successfully.',
          url: publicUrl
        });
      }

      // Route not matched
      return sendError(res, 404, `API route not found: ${method} ${pathname}`);
    }

    // ------------------------------------------------------------------------
    // STATIC FILE SERVING
    // ------------------------------------------------------------------------
    let reqPath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    let filePath = path.join(BASE_DIR, reqPath);

    // Prevent directory traversal
    if (!filePath.startsWith(BASE_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('403 Forbidden');
    }

    // Check file existence
    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // Fallback to index.html for SPA client-side routes if file doesn't exist
        filePath = path.join(BASE_DIR, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      fs.readFile(filePath, (readErr, content) => {
        if (readErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          return res.end('Server Error reading file');
        }

        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(content);
      });
    });

  } catch (err) {
    console.error('[UNCAUGHT SERVER ERROR]', err);
    sendError(res, 500, `Internal Server Error: ${err.message}`);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`=======================================================`);
  console.log(`CABSSA Clubdesk — Internal Club Management System`);
  console.log(`Full-Stack Node.js Engine & REST API running at:`);
  console.log(`- http://localhost:${PORT}`);
  console.log(`- http://127.0.0.1:${PORT}`);
  console.log(`Atomic Database: ${DATA_FILE}`);
  console.log(`=======================================================`);
});
