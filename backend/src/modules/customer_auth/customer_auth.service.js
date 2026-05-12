const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const prisma    = require('../../config/database');
const { secret, expiresIn } = require('../../config/jwt');

const OTP_TEST    = '0000';
const OTP_TTL_MS  = 10 * 60 * 1000; // 10 min

function referralCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => c[Math.floor(Math.random() * c.length)]).join('');
}

function cleanPhone(p) { return String(p).replace(/^0/, '').replace(/\s/g, ''); }

// ── requestOtp ────────────────────────────────────────────────────────────────
// Finds or creates user+customer, always sets OTP = 0000 (test mode)
async function requestOtp(phone_country, phone_number) {
  const phone = cleanPhone(phone_number);

  let user = await prisma.user.findFirst({
    where: { phone_country, phone_number: phone, is_deleted: false },
  });

  if (!user) {
    // Unique email for phone-based users
    const email = `${phone_country.replace('+', '')}${phone}@customer.elherri.local`;

    const existingEmail = await prisma.user.findFirst({ where: { email } });
    const finalEmail = existingEmail
      ? `${phone_country.replace('+', '')}${phone}.${Date.now()}@customer.elherri.local`
      : email;

    user = await prisma.user.create({
      data: {
        full_name:    'Client El Herri',
        email:        finalEmail,
        password_hash: await bcrypt.hash(`phone-${phone}-${Date.now()}`, 8),
        phone_country,
        phone_number:  phone,
        otp_code:      OTP_TEST,
        otp_expires_at: new Date(Date.now() + OTP_TTL_MS),
        is_active:     false,
        status:        'pending',
      },
    });

    // Assign customer role
    const role = await prisma.role.findFirst({ where: { code: 'customer' } });
    if (role) {
      await prisma.userRole.upsert({
        where:  { user_id_role_id: { user_id: user.id, role_id: role.id } },
        update: {},
        create: { user_id: user.id, role_id: role.id },
      });
    }

    // Create customer profile
    const existing = await prisma.customer.findFirst({ where: { phone_country, phone_number: phone, is_deleted: false } });
    if (!existing) {
      await prisma.customer.create({
        data: {
          user_id:       user.id,
          phone_country,
          phone_number:  phone,
          name:          'Client',
          referral_code: referralCode(),
          is_active:     false,
          preferred_lang: 'fr',
        },
      });
    } else {
      // Link existing customer to new user
      await prisma.customer.update({ where: { id: existing.id }, data: { user_id: user.id } });
    }
  } else {
    // Update OTP for returning user
    await prisma.user.update({
      where: { id: user.id },
      data: { otp_code: OTP_TEST, otp_expires_at: new Date(Date.now() + OTP_TTL_MS) },
    });
  }

  const isNew = !user.phone_verified_at;
  return {
    message:      'OTP envoyé (mode test : 0000)',
    is_new:       isNew,
    phone_country,
    phone_number:  phone,
  };
}

// ── verifyOtp ─────────────────────────────────────────────────────────────────
async function verifyOtp(phone_country, phone_number, otp) {
  const phone = cleanPhone(phone_number);

  const user = await prisma.user.findFirst({
    where: { phone_country, phone_number: phone, is_deleted: false },
    include: { user_roles: { include: { role: true } } },
  });

  if (!user)                   throw { statusCode: 404, message: 'Numéro non trouvé. Vérifiez et réessayez.' };
  if (user.otp_code !== otp)   throw { statusCode: 400, message: 'Code incorrect. Réessayez.' };
  if (user.otp_expires_at && user.otp_expires_at < new Date())
                               throw { statusCode: 400, message: 'Code expiré. Demandez un nouveau code.' };

  // Activate user
  await prisma.user.update({
    where: { id: user.id },
    data: {
      is_active:         true,
      status:            'active',
      phone_verified_at: new Date(),
      otp_code:          null,
      otp_expires_at:    null,
      last_login_at:     new Date(),
    },
  });

  // Activate customer
  const customer = await prisma.customer.findFirst({ where: { phone_country, phone_number: phone, is_deleted: false } });
  if (customer) {
    await prisma.customer.update({ where: { id: customer.id }, data: { is_active: true, user_id: user.id } });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: 'customer', phone_country, phone_number: phone },
    secret,
    { expiresIn }
  );

  return {
    token,
    user: {
      id:            user.id,
      phone_country,
      phone_number:  phone,
      is_new:        !user.phone_verified_at,
    },
    customer: customer ? { id: customer.id, name: customer.name } : null,
  };
}

// ── checkPhone ────────────────────────────────────────────────────────────────
async function checkPhone(phone_country, phone_number) {
  const phone = cleanPhone(phone_number);
  const user  = await prisma.user.findFirst({ where: { phone_country, phone_number: phone, is_deleted: false } });
  return { exists: !!user, is_verified: !!(user?.phone_verified_at) };
}

module.exports = { requestOtp, verifyOtp, checkPhone };
