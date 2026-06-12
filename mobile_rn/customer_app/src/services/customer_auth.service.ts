import * as SecureStore from 'expo-secure-store';
import { jwtDecode } from 'jwt-decode';
import { CONFIG } from '../constants/config';

const BASE_URL = CONFIG.API_URL;
const TOKEN_KEY = 'auth_token';


export interface AuthUser {
  id: string;
  name: string;
  phone_country: string;
  phone_number: string;
  email: string;
}

export interface AuthCustomer {
  id: string;
  name: string;
}

export interface CheckPhoneResponse {
  exists: boolean;
  is_verified: boolean;
}

export interface RequestOtpResponse {
  message: string;
  is_new: boolean;
  phone_country: string;
  phone_number: string;
}

export interface VerifyOtpResponse {
  token: string;
  user: AuthUser & { is_new: boolean };
  customer: AuthCustomer | null;
}

export interface RegisterResponse {
  message: string;
  phone_country: string;
  phone_number: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  customer: AuthCustomer | null;
}

export interface MeResponse {
  id: string;
  name: string;
  email: string;
  phone_country: string;
  phone_number: string;
  customer: {
    id: string;
    name: string;
    referral_code: string;
    wallet_balance: number;
    points_balance: number;
  } | null;
}

interface JwtPayload {
  id: string;
  email: string;
  role: string;
  phone_country: string;
  phone_number: string;
  exp: number;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  withAuth = false,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (withAuth) {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  const json = await res.json();
  
  if (!res.ok) {
    throw {
      statusCode: res.status,
      message: json?.message ?? 'Erreur réseau',
    };
  }
  return (json.data ?? json) as T;
}

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function removeToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function isTokenValid(): Promise<boolean> {
  const token = await getToken();
  if (!token) return false;
  try {
    const { exp } = jwtDecode<JwtPayload>(token);
    return Date.now() < exp * 1000;
  } catch {
    return false;
  }
}


export async function checkPhone(
  phone_number: string,
  phone_country = '+212',
): Promise<CheckPhoneResponse> {
  return request<CheckPhoneResponse>('/customer/auth/check-phone', {
    method: 'POST',
    body: JSON.stringify({ phone_country, phone_number }),
  });
}

export async function requestOtp(
  phone_number: string,
  phone_country = '+212',
): Promise<RequestOtpResponse> {
  return request<RequestOtpResponse>('/customer/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone_country, phone_number }),
  });
}

export async function verifyOtp(
  phone_number: string,
  otp: string,
  phone_country = '+212',
): Promise<VerifyOtpResponse> {
  const data = await request<VerifyOtpResponse>('/customer/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone_country, phone_number, otp }),
  });
  await saveToken(data.token);
  return data;
}

export async function register(params: {
  phone_number: string;
  full_name: string;
  password: string;
  phone_country?: string;
  email?: string;
  referral_code?: string;
}): Promise<RegisterResponse> {
  const { phone_country = '+212', ...rest } = params;
  return request<RegisterResponse>('/customer/auth/register', {
    method: 'POST',
    body: JSON.stringify({ phone_country, ...rest }),
  });
}

export async function login(
  phone_number: string,
  password: string,
  phone_country = '+212',
  email?: string,
): Promise<LoginResponse> {
  const data = await request<LoginResponse>('/customer/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      phone_country,
      phone_number: phone_number || undefined,
      password,
      email: email || undefined,
    }),
  });
  await saveToken(data.token);
  return data;
}

export async function logout(): Promise<void> {
  await removeToken();
}

export async function forgotPassword(
  phone_number: string,
  phone_country = '+212',
): Promise<{ message: string }> {
  return request<{ message: string }>('/customer/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ phone_country, phone_number }),
  });
}

export async function resetPassword(
  phone_number: string,
  otp: string,
  new_password: string,
  phone_country = '+212',
): Promise<{ message: string }> {
  return request<{ message: string }>('/customer/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ phone_country, phone_number, otp, new_password }),
  });
}