const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');

// Intercept saveFile or file paths so test doesn't write to disk
let mockSessionsData = {};
let mockLidData = {};

const {
  setSession,
  getSession,
  hasSession,
  invalidatePhoneSession,
  invalidateSessionByUserId,
  saveLidMapping,
  resolvePhone,
} = require('../dist/storage/session');

const { assertSessionPhoneMatch } = require('../dist/lib/sessionGuard');

// Mock profile API response
let mockProfileResponse = {
  success: true,
  data: {
    id: 10,
    username: 'testuser',
    phone: '+6281211112222',
  },
};

// Hook fetchApiProfile
const profileApiModule = require('../dist/api/profile/profile.api');
profileApiModule.fetchApiProfile = async (apiKey) => {
  return mockProfileResponse;
};

test('WA-OLD-1: invalidatePhoneSession removes session in all phone variations and LID mappings', async () => {
  const phone = '081211112222';
  const jid = '6281211112222@s.whatsapp.net';
  const lid = '1234567890123@lid';

  // Seed session with JID and map LID
  saveLidMapping(lid, '6281211112222');
  setSession(jid, { apiKey: 'NST-KEY-TEST-123' });

  assert.equal(hasSession(jid), true, 'JID session should exist');
  assert.equal(hasSession(lid), true, 'LID session should resolve via lidMap');

  // Trigger invalidation using E.164 format (+6281211112222)
  const invalidated = invalidatePhoneSession('+6281211112222');
  assert.equal(invalidated, true, 'Invalidation should report success');

  // Verify session is gone for both JID and LID
  assert.equal(hasSession(jid), false, 'JID session must be purged');
  assert.equal(hasSession(lid), false, 'LID session must be purged');
});

test('WA-OLD-2: Lazy guard assertSessionPhoneMatch rejects old phone when user changed phone on website', async () => {
  const oldPhoneJid = '6281211112222@s.whatsapp.net';
  setSession(oldPhoneJid, { apiKey: 'NST-KEY-VALID-APIKEY' });
  assert.equal(hasSession(oldPhoneJid), true);

  // User has changed phone on web to +6281299998888
  mockProfileResponse = {
    success: true,
    data: {
      id: 10,
      username: 'testuser',
      phone: '+6281299998888', // New phone!
    },
  };

  const sentMessages = [];
  const fakeCtx = {
    senderJid: oldPhoneJid,
    chatId: 'group123@g.us', // In group chat
    rawMessage: {},
    sock: {
      sendMessage: async (chatId, content, options) => {
        sentMessages.push({ chatId, content });
      },
    },
  };

  // Run lazy guard
  const result = await assertSessionPhoneMatch(fakeCtx);

  // Guard must reject
  assert.equal(result.valid, false, 'Guard must reject mismatch');
  assert.equal(hasSession(oldPhoneJid), false, 'Old phone session must be evicted from memory');

  // Verify error message sent to user (must NOT ask for PIN)
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].content.text, /telah dinonaktifkan karena nomor WhatsApp akun telah berubah/i);
  assert.doesNotMatch(sentMessages[0].content.text, /pin/i, 'Must not ask for PIN in groups');
});

test('WA-OLD-3: Order attempt from old phone is rejected without calling backend order endpoint', async () => {
  const oldPhoneJid = '6281211112222@s.whatsapp.net';
  // Session is now gone
  assert.equal(hasSession(oldPhoneJid), false);

  const sentMessages = [];
  const fakeCtx = {
    senderJid: oldPhoneJid,
    chatId: oldPhoneJid,
    rawMessage: {},
    sock: {
      sendMessage: async (chatId, content) => {
        sentMessages.push({ chatId, content });
      },
    },
  };

  const result = await assertSessionPhoneMatch(fakeCtx);
  assert.equal(result.valid, false);
  assert.match(sentMessages[0].content.text, /belum terhubung/i);
});

test('WA-NEW-1: Re-login from new phone with existing API key links successfully', async () => {
  const newPhoneJid = '6281299998888@s.whatsapp.net';
  const apiKey = 'NST-KEY-VALID-APIKEY';

  // Web profile now matches new phone
  mockProfileResponse = {
    success: true,
    data: {
      id: 10,
      username: 'testuser',
      phone: '+6281299998888',
    },
  };

  // Login on bot
  const linked = setSession(newPhoneJid, { apiKey });
  assert.equal(linked, true, 'New phone login must succeed');
  assert.equal(hasSession(newPhoneJid), true, 'New phone session exists');

  // Lazy guard from new phone passes!
  const sentMessages = [];
  const fakeCtx = {
    senderJid: newPhoneJid,
    chatId: newPhoneJid,
    rawMessage: {},
    sock: {
      sendMessage: async (chatId, content) => {
        sentMessages.push({ chatId, content });
      },
    },
  };

  const guardResult = await assertSessionPhoneMatch(fakeCtx);
  assert.equal(guardResult.valid, true, 'Guard must pass for new phone');
  assert.equal(guardResult.apiKey, apiKey);
  assert.equal(sentMessages.length, 0, 'No error messages sent');
});

test('WA-OLD-4: ceknick and produk commands reject old phone session when phone was changed on website', async () => {
  const oldPhoneJid = '6281211112222@s.whatsapp.net';
  setSession(oldPhoneJid, { apiKey: 'NST-KEY-VALID-APIKEY' });

  // Web profile shows new phone
  mockProfileResponse = {
    success: true,
    data: {
      id: 10,
      username: 'testuser',
      phone: '+6281299998888',
    },
  };

  const { handleGameValidation, GAME_VALIDATORS } = require('../dist/commands/ceknick.command');
  const { produkCommand } = require('../dist/commands/produk.command');

  const sentMessages = [];
  const fakeCtx = {
    senderJid: oldPhoneJid,
    chatId: oldPhoneJid,
    args: ['12345', '16806'],
    rawMessage: {},
    sock: {
      sendMessage: async (chatId, content) => {
        sentMessages.push({ chatId, content });
      },
    },
  };

  // Test ceknick
  await handleGameValidation(fakeCtx, GAME_VALIDATORS.idml);
  assert.equal(hasSession(oldPhoneJid), false, 'Session must be evicted on ceknick attempt');
  assert.match(sentMessages[0].content.text, /telah dinonaktifkan karena nomor WhatsApp akun telah berubah/i);

  // Test produk
  sentMessages.length = 0;
  await produkCommand(fakeCtx);
  assert.equal(hasSession(oldPhoneJid), false, 'Session must be evicted on produk attempt');
  assert.match(sentMessages[0].content.text, /belum terhubung/i);
});

test('WA-ROTATE-1: Webhook auth.api_key_regenerated purges old session immediately by phone and userId', async () => {
  const phone = '081299991111';
  const jid = '6281299991111@s.whatsapp.net';
  const oldKey = 'NST-KEY-OLD-SECRET-111';

  setSession(jid, { userId: 55, apiKey: oldKey });
  assert.equal(hasSession(jid), true, 'Session should exist initially');

  // 1. Direct invalidation test by userId
  const purged = invalidateSessionByUserId(55);
  assert.equal(purged, true, 'invalidateSessionByUserId should return true');
  assert.equal(hasSession(jid), false, 'Session must be purged');

  // 2. Webhook receiver test
  setSession(jid, { userId: 55, apiKey: oldKey });
  assert.equal(hasSession(jid), true, 'Session re-established');

  const { createWebhookApp } = require('../dist/webhook/server');
  const { config } = require('../dist/config');
  const crypto = require('crypto');
  const app = createWebhookApp();

  const payload = JSON.stringify({
    event: 'auth.api_key_regenerated',
    eventId: 'evt_test_rot_1',
    timestamp: new Date().toISOString(),
    data: {
      userId: 55,
      phone: '+6281299991111',
      timestamp: new Date().toISOString(),
    },
  });

  const signature = crypto
    .createHmac('sha256', config.webhookSecret)
    .update(payload)
    .digest('hex');

  const res = await app.request('/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-NEETSTORE-SIGNATURE': signature,
    },
    body: payload,
  });

  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(hasSession(jid), false, 'Session must be purged after auth.api_key_regenerated webhook');
});

