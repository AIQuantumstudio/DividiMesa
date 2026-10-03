const PIN_STORAGE_KEY = 'dividimesa_admin_pin';

let memoryPin: string | null = null;
let failedAttempts = 0;
let lockedUntilTimestamp = 0;

export async function hashPin(pin: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode('dividimesa:' + pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback if subtle crypto is not available in some environment
    return 'p:' + btoa(pin);
  }
}

export function getStoredPin(): string | null {
  try {
    return localStorage.getItem(PIN_STORAGE_KEY) || memoryPin;
  } catch {
    return memoryPin;
  }
}

export function setStoredPin(hash: string): void {
  memoryPin = hash;
  try {
    localStorage.setItem(PIN_STORAGE_KEY, hash);
  } catch {
    // LocalStorage might be disabled in private mode
  }
}

export function hasConfiguredPin(): boolean {
  return !!getStoredPin();
}

export function getLockoutRemainingSeconds(): number {
  const wait = lockedUntilTimestamp - Date.now();
  return wait > 0 ? Math.ceil(wait / 1000) : 0;
}

export async function verifyPin(enteredPin: string): Promise<{ success: boolean; error?: string }> {
  const remaining = getLockoutRemainingSeconds();
  if (remaining > 0) {
    return { success: false, error: `Demasiados intentos. Esperá ${remaining} s` };
  }

  const stored = getStoredPin();
  if (!stored) {
    return { success: false, error: 'No hay clave configurada' };
  }

  const enteredHash = await hashPin(enteredPin);
  if (enteredHash === stored) {
    failedAttempts = 0;
    return { success: true };
  }

  failedAttempts++;
  if (failedAttempts >= 5) {
    lockedUntilTimestamp = Date.now() + 30000;
    failedAttempts = 0;
    return { success: false, error: 'Demasiados intentos. Esperá 30 s' };
  }

  return { success: false, error: 'Clave incorrecta' };
}
