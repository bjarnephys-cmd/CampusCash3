import { Transaction } from '../types/finance';
const PHP_API_URL = 'https://bjarnephys.com/MySQL/transactions.php';

/*
export interface DebtorDTO {
  id: string;
  name: string;
  amount: number;
  settled: boolean;
  settled_at?: string;
}

export interface Transaction {
  id: string;
  date: string;
  title: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  is_shared: boolean;
  split_between_count?: number;
  notes?: string;
  settled?: boolean;
  debtors?: DebtorDTO[];
}
*/
const API_BASE = '/api';

export async function fetchTransactions(filters?: {
  type?: string;
  category?: string;
  search?: string;
}): Promise<{ data: Transaction[]; PHPtime: any  }> {
  // Promise<Transaction[]> lover til resten at levere Transaction[]  

  const params = new URLSearchParams();
  if (filters?.type && filters.type !== 'all') params.set('type', filters.type);
  if (filters?.category && filters.category !== 'all') params.set('category', filters.category);
  if (filters?.search) params.set('search', filters.search);
  
  const url = `${API_BASE}/transactions${params.toString() ? `?${params.toString()}` : ''}`;
  //kalder server.ts .kode

  console.log('api.ts/fetchTransactions(), url:',url)
  
  //const queryString = params.toString();
  //const url = `${PHP_API_URL}${queryString ? `?${queryString}` : ''}`;
  const t1 = performance.now(); // Lige før HTTP fetch
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch transactions: ${response.statusText}`);
  }

  // HUSK AWAIT HER:
  const json = await response.json();

  const t2 = performance.now(); // Svar modtaget over netværket

  console.log('Svar fra PHP backend:', json);
  console.log('PHP Debug timings:', json._debug); // <--- Her kan du tilgå din _debug!
  console.log(`Networkstime:        ${(t2 - t1).toFixed(2)} ms`);
  //console.log('fetchTransactions(), json:',json)
  json.PHPtime=json._debug.php_total_ms;
  return json
} 


function buildDefaultDebtors(id: string, amount: number, splitCount: number, settled = false): DebtorDTO[] {
  const count = Math.max(1, splitCount - 1);
  const perPerson = Math.round((amount / splitCount) * 100) / 100;
  return Array.from({ length: count }, (_, i) => ({
    id: `d-${id}-${i + 1}`,
    name: `Person ${i + 1}`,
    amount: perPerson,
    settled: settled,
  }));
}


// Hjælpefunktion til at mappe og parse rækker fra PHP-API'et
function formatRow(row: any): TransactionDTO {
  let debtors: DebtorDTO[] | undefined = undefined;

  const isSharedBool = Number(row.is_shared) === 1;

  if (isSharedBool) {
    if (row.debtors) {
      try {
        debtors = typeof row.debtors === 'string' ? JSON.parse(row.debtors) : row.debtors;
      } catch {
        debtors = undefined;
      }
    }

    const splitCount = row.split_between_count ? Number(row.split_between_count) : 2;
    if (!debtors || debtors.length === 0) {
      debtors = buildDefaultDebtors(row.id || 'tx-temp', Number(row.amount) || 0, splitCount, Number(row.settled) === 1);
    }
  }

  // En delt transaktion er først totalt settled, hvis alle debtors har afregnet
  const isSettled = isSharedBool && debtors && debtors.length > 0
    ? debtors.every((d) => d.settled)
    : Number(row.settled) === 1;

  return {
    id: row.id,
    date: row.date,
    title: row.title,
    amount: Number(row.amount) || 0,
    type: row.type,
    category: row.category,
    is_shared: isSharedBool,
    split_between_count: row.split_between_count ? Number(row.split_between_count) : undefined,
    notes: row.notes || undefined,
    settled: isSettled,
    debtors: debtors,
  };
}



export async function createTransaction(data: Omit<TransactionDTO, 'id'> & { id?: string }): Promise<TransactionDTO> {
  const id = '' // data.id || `tx-${Date.now().toString().slice(-6)}`; //overskrivs i php
  const splitCount = data.split_between_count || 1;

  let debtors = data.debtors;
   // Sikr at is_shared bliver behandlet som en sand/falsk værdi
  const isShared = Boolean(data.is_shared);
  
  if (data.is_shared && (!debtors || debtors.length === 0)) {
    debtors = buildDefaultDebtors(id, data.amount, splitCount, Boolean(data.settled));
  }
 

  // Forbered data til PHP (konverter booleans til 0/1 og debtors til JSON-streng)
  const payload = {
    ...data,
    id,
    is_shared: data.is_shared ? 1 : 0,
    settled: data.settled ? 1 : 0,
    debtors: debtors ? JSON.stringify(debtors) : null
  };
  //console.log('payload:',payload)
  const res = await fetch(`${PHP_API_URL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  //console.log('responce:',res)
  const json: any = await res.json();
  if (!res.ok) throw new Error(json.error || 'Fejl ved oprettelse af transaktion');
  
  return formatRow(json.transaction || payload);
}

export async function updateTransaction(
  id: string,
  data: Partial<Transaction>
): Promise<Transaction> {
  let body = JSON.stringify(data);
  //console.log(' updateTransaction(), body:',body)
  const response = await fetch(`${API_BASE}/transactions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: body // JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to update transaction: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteTransaction(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/transactions/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete transaction: ${response.statusText}`);
  }
}

export async function toggleSettled(id: string): Promise<Transaction> {
  const response = await fetch(`${API_BASE}/transactions/${id}/settled`, {
    method: 'PATCH',
  });
  if (!response.ok) {
    throw new Error(`Failed to toggle settled: ${response.statusText}`);
  }
  return response.json();
}

export async function toggleDebtorSettled(
  transactionId: string,
  debtorId: string
): Promise<any> {
  const response = await fetch(`${PHP_API_URL}?action=toggle_debtor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction_id: transactionId, debtor_id: debtorId }),
  });
  console.log('in toggleDebtorSettled(), respons:',response);
  const json: any = await response.json();
  //console.log('in toggleDebtorSettled(), json:',json);
  if (!response.ok) {
    throw new Error(json.error || `Fejl ved opdatering af debitor-status: ${response.statusText}`);
  }
  return json.transaction || json;
}


export async function setAllDebtors(
  transactionId: string,
  targetSettled: boolean
): Promise<any> {
  const response = await fetch(`${PHP_API_URL}?action=set_all_debtors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction_id: transactionId, targetSettled: targetSettled}),
  });
  //console.log('in setAllDebtors(), respons:',response);
  const json: any = await response.json();
  //console.log(' json:',json);
  if (!response.ok) {
    throw new Error(json.error || `Fejl ved opdatering af debitor-status: ${response.statusText}`);
  }
  return json.transaction || json;
}

export async function updateDebtors(
  transactionId: string,
  debtors: any[]
): Promise<any> {
  const response = await fetch(`${PHP_API_URL}?action=update_debtors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction_id: transactionId, debtors }),
  });
  console.log('in updateDebtors(), respons:',response);
  const json: any = await response.json();
  console.log('in updateDebtors(), json:',json);
  if (!response.ok) {
    throw new Error(json.error || `Fejl ved opdatering af debitorer: ${response.statusText}`);
  }
  return json.transaction || json;
}
export async function resetTransactions(): Promise<Transaction[]> {
  const response = await fetch(`${API_BASE}/transactions/reset`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to reset transactions: ${response.statusText}`);
  }
  const result = await response.json();
  return result.data;
}

export function getCSVDownloadUrl(type?: string): string {
  const params = new URLSearchParams();
  if (type && type !== 'all') params.set('type', type);
  return `${API_BASE}/export/csv${params.toString() ? `?${params.toString()}` : ''}`;
}
