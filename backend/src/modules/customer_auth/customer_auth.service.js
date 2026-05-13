const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const prisma   = require('../../config/database');
const { secret, expiresIn } = require('../../config/jwt');

const OTP_TEST   = '0000';
const OTP_TTL_MS = 10 * 60 * 1000;

function referralCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => c[Math.floor(Math.random() * c.length)]).join('');
}

function cleanPhone(p) { return String(p).replace(/^0/, '').replace(/\s/g, ''); }

function signToken(user, phone_country, phone) {
  return jwt.sign(
    { id: user.id, email: user.email, role: 'customer', phone_country, phone_number: phone },
    secret,
    { expiresIn },
  );
}

// ── register ──────────────────────────────────────────────────────────────────
async function register(phone_country, phone_number, full_name, password, email) {
  const phone = cleanPhone(phone_number);

  const existingByPhone = await prisma.user.findFirst({
    where: { phone_country, phone_number: phone, is_deleted: false },
  });
  if (existingByPhone) throw { statusCode: 409, message: 'Ce numéro est déjà utilisé.' };

  const baseEmail   = email?.trim() || `${phone_country.replace('+', '')}${phone}@customer.elherri.local`;
  const dupEmail    = await prisma.user.findFirst({ where: { email: baseEmail } });
  const finalEmail  = dupEmail ? `${phone_country.replace('+', '')}${phone}.${Date.now()}@customer.elherri.local` : baseEmail;

  const user = await prisma.user.create({
    data: {
      full_name,
      email:          finalEmail,
      password_hash:  await bcrypt.hash(password, 10),
      phone_country,
      phone_number:   phone,
      otp_code:       OTP_TEST,
      otp_expires_at: new Date(Date.now() + OTP_TTL_MS),
      is_active:      false,
      status:         'pending',
    },
  });

  const role = await prisma.role.findFirst({ where: { code: 'customer' } });
  if (role) {
    await prisma.userRole.upsert({
      where:  { user_id_role_id: { user_id: user.id, role_id: role.id } },
      update: {},
      create: { user_id: user.id, role_id: role.id },
    });
  }

  await prisma.customer.create({
    data: {
      user_id:        user.id,
      phone_country,
      phone_number:   phone,
      name:           full_name,
      referral_code:  referralCode(),
      is_active:      false,
      preferred_lang: 'fr',
    },
  });

  return { message: 'Compte créé. Entrez le code OTP pour activer.', phone_country, phone_number: phone };
}

// ── login ─────────────────────────────────────────────────────────────────────
async function login(phone_country, phone_number, password) {
  const phone = cleanPhone(phone_number);

  const user = await prisma.user.findFirst({
    where:   { phone_country, phone_number: phone, is_deleted: false },
    include: { user_roles: { include: { role: true } } },
  });

  if (!user) throw { statusCode: 404, message: 'Numéro de téléphone non trouvé.' };

  const isCustomer = user.user_roles.some(ur => ur.role.code === 'customer');
  if (!isCustomer) throw { statusCode: 403, message: 'Accès non autorisé.' };

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw { statusCode: 401, message: 'Mot de passe incorrect.' };

  if (!user.is_active) throw { statusCode: 403, message: 'Compte non activé. Vérifiez votre code OTP.' };

  await prisma.user.update({ where: { id: user.id }, data: { last_login_at: new Date() } });

  const customer = await prisma.customer.findFirst({ where: { phone_country, phone_number: phone, is_deleted: false } });
  const token    = signToken(user, phone_country, phone);

  return {
    token,
    user:     { id: user.id, name: user.full_name, phone_country, phone_number: phone, email: user.email },
    customer: customer ? { id: customer.id, name: customer.name } : null,
  };
}

// ── getMe ─────────────────────────────────────────────────────────────────────
async function getMe(userId) {
  const user = await prisma.user.findFirst({ where: { id: userId, is_deleted: false } });
  if (!user) throw { statusCode: 404, message: 'Utilisateur non trouvé.' };

  const customer = await prisma.customer.findFirst({ where: { user_id: userId, is_deleted: false } });

  return {
    id:            user.id,
    name:          user.full_name,
    email:         user.email,
    phone_country: user.phone_country,
    phone_number:  user.phone_number,
    customer:      customer ? {
      id:            customer.id,
      name:          customer.name,
      referral_code: customer.referral_code,
      wallet_balance:  0,
      points_balance:  0,
    } : null,
  };
}

// ── requestOtp ────────────────────────────────────────────────────────────────
async function requestOtp(phone_country, phone_number) {
  const phone = cleanPhone(phone_number);

  let user = await prisma.user.findFirst({
    where: { phone_country, phone_number: phone, is_deleted: false },
  });

  if (!user) {
    const email    = `${phone_country.replace('+', '')}${phone}@customer.elherri.local`;
    const dupEmail = await prisma.user.findFirst({ where: { email } });
    const finalEmail = dupEmail ? `${phone_country.replace('+', '')}${phone}.${Date.now()}@customer.elherri.local` : email;

    user = await prisma.user.create({
      data: {
        full_name:      'Client El Herri',
        email:          finalEmail,
        password_hash:  await bcrypt.hash(`phone-${phone}-${Date.now()}`, 8),
        phone_country,
        phone_number:   phone,
        otp_code:       OTP_TEST,
        otp_expires_at: new Date(Date.now() + OTP_TTL_MS),
        is_active:      false,
        status:         'pending',
      },
    });

    const role = await prisma.role.findFirst({ where: { code: 'customer' } });
    if (role) {
      await prisma.userRole.upsert({
        where:  { user_id_role_id: { user_id: user.id, role_id: role.id } },
        update: {},
        create: { user_id: user.id, role_id: role.id },
      });
    }

    const existing = await prisma.customer.findFirst({ where: { phone_country, phone_number: phone, is_deleted: false } });
    if (!existing) {
      await prisma.customer.create({
        data: {
          user_id:        user.id,
          phone_country,
          phone_number:   phone,
          name:           'Client',
          referral_code:  referralCode(),
          is_active:      false,
          preferred_lang: 'fr',
        },
      });
    } else {
      await prisma.customer.update({ where: { id: existing.id }, data: { user_id: user.id } });
    }
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data:  { otp_code: OTP_TEST, otp_expires_at: new Date(Date.now() + OTP_TTL_MS) },
    });
  }

  return { message: 'OTP envoyé (mode test : 0000)', is_new: !user.phone_verified_at, phone_country, phone_number: phone };
}

// ── verifyOtp ─────────────────────────────────────────────────────────────────
async function verifyOtp(phone_country, phone_number, otp) {
  const phone = cleanPhone(phone_number);

  const user = await prisma.user.findFirst({
    where:   { phone_country, phone_number: phone, is_deleted: false },
    include: { user_roles: { include: { role: true } } },
  });

  if (!user)                   throw { statusCode: 404, message: 'Numéro non trouvé. Vérifiez et réessayez.' };
  if (user.otp_code !== otp)   throw { statusCode: 400, message: 'Code incorrect. Réessayez.' };
  if (user.otp_expires_at && user.otp_expires_at < new Date())
                               throw { statusCode: 400, message: 'Code expiré. Demandez un nouveau code.' };

  await prisma.user.update({
    where: { id: user.id },
    data:  {
      is_active:         true,
      status:            'active',
      phone_verified_at: new Date(),
      otp_code:          null,
      otp_expires_at:    null,
      last_login_at:     new Date(),
    },
  });

  const customer = await prisma.customer.findFirst({ where: { phone_country, phone_number: phone, is_deleted: false } });
  if (customer) {
    await prisma.customer.update({ where: { id: customer.id }, data: { is_active: true, user_id: user.id } });
  }

  const token = signToken(user, phone_country, phone);

  return {
    token,
    user: { id: user.id, phone_country, phone_number: phone, name: user.full_name, is_new: !user.phone_verified_at },
    customer: customer ? { id: customer.id, name: customer.name } : null,
  };
}

// ── checkPhone ────────────────────────────────────────────────────────────────
async function checkPhone(phone_country, phone_number) {
  const phone = cleanPhone(phone_number);
  const user  = await prisma.user.findFirst({ where: { phone_country, phone_number: phone, is_deleted: false } });
  return { exists: !!user, is_verified: !!(user?.phone_verified_at) };
}

module.exports = { requestOtp, verifyOtp, checkPhone, login, register, getMe };
