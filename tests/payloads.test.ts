import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTENT, encodeContent, escapeWifi } from '../src/lib/payloads';

describe('encodeContent', () => {
  it('adds https:// to bare URLs and rejects garbage', () => {
    expect(encodeContent({ type: 'url', data: { url: 'example.com/a' } })).toEqual({ payload: 'https://example.com/a', errors: [] });
    expect(encodeContent({ type: 'url', data: { url: 'not a url' } }).errors).not.toHaveLength(0);
    expect(encodeContent({ type: 'url', data: { url: '' } }).errors).toContain('URL is required.');
  });

  it('encodes phone and SMS', () => {
    expect(encodeContent({ type: 'phone', data: { phone: '+91 98765-43210' } }).payload).toBe('tel:+919876543210');
    expect(encodeContent({ type: 'sms', data: { phone: '+15551234', message: 'Hi there' } }).payload).toBe('SMSTO:+15551234:Hi there');
    expect(encodeContent({ type: 'phone', data: { phone: 'call me' } }).errors).toHaveLength(1);
  });

  it('encodes mailto with encoded params', () => {
    const r = encodeContent({ type: 'email', data: { to: 'a@b.co', subject: 'Hello & bye', body: '' } });
    expect(r).toEqual({ payload: 'mailto:a@b.co?subject=Hello%20%26%20bye', errors: [] });
  });

  it('escapes Wi-Fi special characters', () => {
    expect(escapeWifi('a;b,c:d\\e"f')).toBe('a\\;b\\,c\\:d\\\\e\\"f');
    const r = encodeContent({ type: 'wifi', data: { ssid: 'Cafe;1', password: 'pass:word', security: 'WPA', hidden: true } });
    expect(r).toEqual({ payload: 'WIFI:T:WPA;S:Cafe\\;1;P:pass\\:word;H:true;;', errors: [] });
  });

  it('omits the password for open Wi-Fi and validates WPA length', () => {
    expect(encodeContent({ type: 'wifi', data: { ssid: 'Open', password: 'x', security: 'nopass', hidden: false } }).payload).toBe('WIFI:T:nopass;S:Open;;');
    expect(encodeContent({ type: 'wifi', data: { ssid: 'X', password: 'short', security: 'WPA', hidden: false } }).errors).toHaveLength(1);
  });

  it('builds an escaped vCard 3.0', () => {
    const r = encodeContent({
      type: 'vcard',
      data: { ...DEFAULT_CONTENT.vcard, firstName: 'Asha', lastName: 'Rao', org: 'Acme, Inc.', phone: '+91 22 1234', note: 'line1\nline2' },
    });
    expect(r.errors).toEqual([]);
    expect(r.payload.split('\r\n')).toEqual([
      'BEGIN:VCARD', 'VERSION:3.0', 'N:Rao;Asha;;;', 'FN:Asha Rao', 'ORG:Acme\\, Inc.', 'TEL;TYPE=CELL:+91221234', 'NOTE:line1\\nline2', 'END:VCARD',
    ]);
  });

  it('builds a UPI intent with %20 spaces', () => {
    const r = encodeContent({ type: 'upi', data: { vpa: 'shop@okbank', name: 'Tea Stall', amount: '49.50', note: '' } });
    expect(r).toEqual({ payload: 'upi://pay?pa=shop%40okbank&pn=Tea%20Stall&am=49.50&cu=INR', errors: [] });
    expect(encodeContent({ type: 'upi', data: { vpa: 'nope', name: '', amount: '1.234', note: '' } }).errors).toHaveLength(3);
  });
});
