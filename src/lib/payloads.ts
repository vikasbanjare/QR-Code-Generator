// Encoders that turn form fields into the exact string stored in a static QR symbol.
// Static codes carry the final content directly, so nothing here touches a redirect service.

export type ContentType = 'url' | 'text' | 'phone' | 'sms' | 'email' | 'wifi' | 'vcard' | 'upi';

export interface UrlData { url: string }
export interface TextData { text: string }
export interface PhoneData { phone: string }
export interface SmsData { phone: string; message: string }
export interface EmailData { to: string; subject: string; body: string }
export interface WifiData { ssid: string; password: string; security: 'WPA' | 'WEP' | 'nopass'; hidden: boolean }
export interface VCardData {
  firstName: string;
  lastName: string;
  org: string;
  title: string;
  phone: string;
  email: string;
  url: string;
  street: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
  note: string;
}
export interface UpiData { vpa: string; name: string; amount: string; note: string }

export interface ContentDataMap {
  url: UrlData;
  text: TextData;
  phone: PhoneData;
  sms: SmsData;
  email: EmailData;
  wifi: WifiData;
  vcard: VCardData;
  upi: UpiData;
}

export type ContentData = { [K in ContentType]: { type: K; data: ContentDataMap[K] } }[ContentType];

export interface EncodeResult {
  payload: string;
  errors: string[];
}

export const CONTENT_LABELS: Record<ContentType, string> = {
  url: 'Website',
  text: 'Text',
  phone: 'Phone',
  sms: 'SMS',
  email: 'Email',
  wifi: 'Wi-Fi',
  vcard: 'Contact',
  upi: 'UPI',
};

export const DEFAULT_CONTENT: ContentDataMap = {
  url: { url: 'https://example.com' },
  text: { text: '' },
  phone: { phone: '' },
  sms: { phone: '', message: '' },
  email: { to: '', subject: '', body: '' },
  wifi: { ssid: '', password: '', security: 'WPA', hidden: false },
  vcard: {
    firstName: '', lastName: '', org: '', title: '', phone: '', email: '', url: '',
    street: '', city: '', region: '', postcode: '', country: '', note: '',
  },
  upi: { vpa: '', name: '', amount: '', note: '' },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9][0-9 ()-]{2,}$/;
const UPI_VPA_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;

export function normalizePhone(phone: string): string {
  return phone.replace(/[\s()-]/g, '');
}

export function normalizeUrl(raw: string): string {
  const url = raw.trim();
  if (!url) return url;
  return /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
}

/** Escapes the characters reserved by the de-facto `WIFI:` format (\ ; , : "). */
export function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1');
}

/** Escapes text values per RFC 6350 §3.4. */
export function escapeVCard(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function checkPhone(phone: string, errors: string[], label = 'Phone number') {
  if (!phone.trim()) errors.push(`${label} is required.`);
  else if (!PHONE_RE.test(phone.trim())) errors.push(`${label} contains invalid characters.`);
}

export function encodeContent(content: ContentData): EncodeResult {
  const errors: string[] = [];
  switch (content.type) {
    case 'url': {
      const url = normalizeUrl(content.data.url);
      if (!url) errors.push('URL is required.');
      else {
        try {
          const parsed = new URL(url);
          if (/^https?:$/.test(parsed.protocol) && !parsed.hostname.includes('.') && parsed.hostname !== 'localhost') {
            errors.push('URL host looks incomplete.');
          }
        } catch {
          errors.push('URL is not valid.');
        }
      }
      return { payload: url, errors };
    }
    case 'text': {
      if (!content.data.text) errors.push('Text is required.');
      return { payload: content.data.text, errors };
    }
    case 'phone': {
      checkPhone(content.data.phone, errors);
      return { payload: `tel:${normalizePhone(content.data.phone)}`, errors };
    }
    case 'sms': {
      const { phone, message } = content.data;
      checkPhone(phone, errors);
      return { payload: `SMSTO:${normalizePhone(phone)}:${message}`, errors };
    }
    case 'email': {
      const { to, subject, body } = content.data;
      if (!EMAIL_RE.test(to.trim())) errors.push('A valid email address is required.');
      const params = [
        subject && `subject=${encodeURIComponent(subject)}`,
        body && `body=${encodeURIComponent(body)}`,
      ].filter(Boolean);
      return { payload: `mailto:${to.trim()}${params.length ? `?${params.join('&')}` : ''}`, errors };
    }
    case 'wifi': {
      const { ssid, password, security, hidden } = content.data;
      if (!ssid) errors.push('Network name (SSID) is required.');
      if (security !== 'nopass' && !password) errors.push('Password is required for a secured network.');
      if (security === 'WPA' && password && (password.length < 8 || password.length > 63)) {
        errors.push('WPA passwords are 8–63 characters.');
      }
      let payload = `WIFI:T:${security};S:${escapeWifi(ssid)};`;
      if (security !== 'nopass') payload += `P:${escapeWifi(password)};`;
      if (hidden) payload += 'H:true;';
      return { payload: `${payload};`, errors };
    }
    case 'vcard': {
      const d = content.data;
      if (!d.firstName.trim() && !d.lastName.trim() && !d.org.trim()) {
        errors.push('Enter a name or organisation.');
      }
      if (d.email && !EMAIL_RE.test(d.email.trim())) errors.push('Email address is not valid.');
      if (d.phone) checkPhone(d.phone, errors);
      const e = (v: string) => escapeVCard(v.trim());
      const fn = [d.firstName, d.lastName].map((s) => s.trim()).filter(Boolean).join(' ') || d.org.trim();
      const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${e(d.lastName)};${e(d.firstName)};;;`, `FN:${escapeVCard(fn)}`];
      if (d.org.trim()) lines.push(`ORG:${e(d.org)}`);
      if (d.title.trim()) lines.push(`TITLE:${e(d.title)}`);
      if (d.phone.trim()) lines.push(`TEL;TYPE=CELL:${normalizePhone(d.phone)}`);
      if (d.email.trim()) lines.push(`EMAIL:${d.email.trim()}`);
      if (d.url.trim()) lines.push(`URL:${normalizeUrl(d.url)}`);
      if ([d.street, d.city, d.region, d.postcode, d.country].some((s) => s.trim())) {
        lines.push(`ADR:;;${e(d.street)};${e(d.city)};${e(d.region)};${e(d.postcode)};${e(d.country)}`);
      }
      if (d.note.trim()) lines.push(`NOTE:${e(d.note)}`);
      lines.push('END:VCARD');
      return { payload: lines.join('\r\n'), errors };
    }
    case 'upi': {
      const { vpa, name, amount, note } = content.data;
      if (!UPI_VPA_RE.test(vpa.trim())) errors.push('A valid UPI ID (name@bank) is required.');
      if (!name.trim()) errors.push('Payee name is required.');
      if (amount && !/^\d+(\.\d{1,2})?$/.test(amount.trim())) errors.push('Amount must be a number with up to 2 decimals.');
      const params = new URLSearchParams({ pa: vpa.trim(), pn: name.trim() });
      if (amount.trim()) params.set('am', amount.trim());
      params.set('cu', 'INR');
      if (note.trim()) params.set('tn', note.trim());
      // URLSearchParams encodes spaces as '+', which several UPI apps show literally.
      return { payload: `upi://pay?${params.toString().replace(/\+/g, '%20')}`, errors };
    }
  }
}
