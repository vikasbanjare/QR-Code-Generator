import type { ContentDataMap, ContentType, VCardData } from '../../../lib/payloads';
import { Segmented, TextInput, Toggle } from '../../../components/ui';

interface Props<K extends ContentType> {
  type: K;
  data: ContentDataMap[K];
  onChange: (data: ContentDataMap[K]) => void;
}

export function ContentForm<K extends ContentType>({ type, data, onChange }: Props<K>) {
  // Each branch narrows `data` by the discriminating `type`.
  const set = <T,>(patch: Partial<T>) => onChange({ ...(data as T), ...patch } as unknown as ContentDataMap[K]);

  switch (type) {
    case 'url': {
      const d = data as ContentDataMap['url'];
      return (
        <TextInput
          label="Website URL"
          type="url"
          inputMode="url"
          value={d.url}
          placeholder="https://example.com"
          hint="Encoded directly into the code — it keeps working with no account or redirect."
          onChange={(url) => set({ url })}
        />
      );
    }
    case 'text': {
      const d = data as ContentDataMap['text'];
      return <TextInput label="Text" multiline value={d.text} onChange={(text) => set({ text })} />;
    }
    case 'phone': {
      const d = data as ContentDataMap['phone'];
      return <TextInput label="Phone number" type="tel" inputMode="tel" placeholder="+91 98765 43210" value={d.phone} onChange={(phone) => set({ phone })} />;
    }
    case 'sms': {
      const d = data as ContentDataMap['sms'];
      return (
        <>
          <TextInput label="Phone number" type="tel" inputMode="tel" value={d.phone} onChange={(phone) => set({ phone })} />
          <TextInput label="Message" multiline value={d.message} onChange={(message) => set({ message })} />
        </>
      );
    }
    case 'email': {
      const d = data as ContentDataMap['email'];
      return (
        <>
          <TextInput label="Email address" type="email" inputMode="email" value={d.to} onChange={(to) => set({ to })} />
          <TextInput label="Subject" value={d.subject} onChange={(subject) => set({ subject })} />
          <TextInput label="Body" multiline value={d.body} onChange={(body) => set({ body })} />
        </>
      );
    }
    case 'wifi': {
      const d = data as ContentDataMap['wifi'];
      return (
        <>
          <TextInput label="Network name (SSID)" value={d.ssid} onChange={(ssid) => set({ ssid })} />
          <Segmented
            label="Security"
            value={d.security}
            options={[
              { value: 'WPA', label: 'WPA/WPA2/WPA3' },
              { value: 'WEP', label: 'WEP' },
              { value: 'nopass', label: 'Open' },
            ]}
            onChange={(security) => set({ security })}
          />
          {d.security !== 'nopass' && <TextInput label="Password" value={d.password} onChange={(password) => set({ password })} />}
          <Toggle label="Hidden network" checked={d.hidden} onChange={(hidden) => set({ hidden })} />
        </>
      );
    }
    case 'vcard': {
      const d = data as VCardData;
      const f = (key: keyof VCardData, label: string, extra: Partial<Parameters<typeof TextInput>[0]> = {}) => (
        <TextInput key={key} label={label} value={d[key]} onChange={(v) => set<VCardData>({ [key]: v })} {...extra} />
      );
      return (
        <>
          <div className="grid-2">
            {f('firstName', 'First name')}
            {f('lastName', 'Last name')}
            {f('org', 'Organisation')}
            {f('title', 'Job title')}
            {f('phone', 'Phone', { type: 'tel', inputMode: 'tel' })}
            {f('email', 'Email', { type: 'email', inputMode: 'email' })}
          </div>
          {f('url', 'Website', { type: 'url', inputMode: 'url' })}
          {f('street', 'Street')}
          <div className="grid-2">
            {f('city', 'City')}
            {f('region', 'State / region')}
            {f('postcode', 'Postcode')}
            {f('country', 'Country')}
          </div>
          {f('note', 'Note', { multiline: true })}
        </>
      );
    }
    case 'upi': {
      const d = data as ContentDataMap['upi'];
      return (
        <>
          <TextInput label="UPI ID" placeholder="name@bank" value={d.vpa} onChange={(vpa) => set({ vpa })} />
          <TextInput label="Payee name" value={d.name} onChange={(name) => set({ name })} />
          <div className="grid-2">
            <TextInput label="Amount (₹, optional)" inputMode="decimal" value={d.amount} onChange={(amount) => set({ amount })} />
            <TextInput label="Note (optional)" value={d.note} onChange={(note) => set({ note })} />
          </div>
        </>
      );
    }
  }
  return null;
}
