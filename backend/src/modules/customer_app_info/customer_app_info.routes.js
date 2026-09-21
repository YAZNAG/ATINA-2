const { Router } = require('express');
const platformConfig = require('../../utils/platform-config');
const resp = require('../../utils/response');

/**
 * Informations publiques affichées par l'app cliente, avant même la connexion
 * (écran Contact, liens de l'inscription et du profil) — US-007 / US-119.
 * Seules les clés destinées au client sont exposées, jamais toute la configuration.
 */
const PUBLIC_KEYS = [
  'support_phone', 'support_whatsapp', 'support_email',
  'cgu_url', 'privacy_url', 'default_currency', 'default_timezone',
];

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const cfg = await platformConfig.all();
    const data = Object.fromEntries(PUBLIC_KEYS.map((k) => [k, cfg[k] ?? null]));
    return resp.success(res, data);
  } catch (e) { next(e); }
});

module.exports = router;
