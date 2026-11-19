export interface ProductVersionInfo {
  name: string;
  shortName: string;
  version: string;
  major: number;
  minor: number;
  patch: number;
  schemaVersion: string;
  edition: string;
  releaseStatus: 'PRODUCTION READY' | 'STAGING';
  releaseNotes: string[];
}

export const PRODUCT_INFO: ProductVersionInfo = {
  name: 'Supartha Panel — Digital SMM Platform',
  shortName: 'Supartha Panel',
  version: 'v1.0.0',
  major: 1,
  minor: 0,
  patch: 0,
  schemaVersion: '1.0.0',
  edition: 'Commercial Multi-Buyer Edition',
  releaseStatus: 'PRODUCTION READY',
  releaseNotes: [
    'Multi-buyer white-label architecture with isolated Firebase project & Firestore DB per buyer.',
    '8-step guided Setup Wizard, idempotent database initializer, non-destructive repair, and safe JSON config backup.',
    'Atomic Firestore transactions for order placement, wallet deduction, duplicate-order lock, deposit approval, and refund protection.',
    'Server-side SMM Provider API proxy with credential isolation, automated status sync, and retry backoff.',
    'RBAC-enforced Admin Console (Super Admin, Admin, Manager, Support Staff), Support Ticket chat, Audit Logs, and Real-time Notifications.',
  ],
};

export function generateInstallationId(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < 6; i += 1) {
      suffix += alphabet[bytes[i] % alphabet.length];
    }
  } else {
    for (let i = 0; i < 6; i += 1) {
      suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
  }
  return `SPP-${suffix}`;
}

export function compareSemver(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .replace(/^v/i, '')
      .split('.')
      .map((n) => Number.parseInt(n, 10) || 0);
  const [aMaj = 0, aMin = 0, aPat = 0] = parse(a);
  const [bMaj = 0, bMin = 0, bPat = 0] = parse(b);
  if (aMaj !== bMaj) return aMaj > bMaj ? 1 : -1;
  if (aMin !== bMin) return aMin > bMin ? 1 : -1;
  if (aPat !== bPat) return aPat > bPat ? 1 : -1;
  return 0;
}
