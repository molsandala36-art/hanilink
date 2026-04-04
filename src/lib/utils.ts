import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD',
  }).format(amount);
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('fr-MA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function getDefaultVatRate() {
  if (typeof window === 'undefined') return '20';

  const storedRate = window.localStorage.getItem('defaultVatRate');
  const parsedRate = Number(storedRate);

  if (!storedRate || Number.isNaN(parsedRate) || parsedRate < 0) {
    return '20';
  }

  return storedRate;
}
