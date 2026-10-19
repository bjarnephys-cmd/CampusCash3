// db.ts (Tilpasset til PHP Backend via HTTP fetch med fuld Debtors/Deltager-støtte)

const PHP_API_URL = 'https://bjarnephys.com/MySQL/transactions.php';

export interface DebtorDTO {
  id: string;
  name: string;
  amount: number;
  settled: boolean;
  settled_at?: string;
}

export interface TransactionDTO {
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

export const INITIAL_DATA: Omit<TransactionDTO, 'id'>[] = [
  {
    date: "2026-10-01",
    title: "SU Udbetaling",
    amount: 6820.00,
    type: "income",
    category: "SU/Job",
    is_shared: false
  },
  {
    date: "2026-10-01",
    title: "Husleje Kollegie",
    amount: 3200.00,
    type: "expense",
    category: "Bolig/Husleje",
    is_shared: false
  },
  {
    date: "2026-10-03",
    title: "Kantine Frokost",
    amount: 45.00,
    type: "expense",
    category: "Kantine/Mad",
    is_shared: false
  },
  {
    date: "2026-10-04",
    title: "Pensumbog i Mikroøkonomi",
    amount: 420.00,
    type: "expense",
    category: "Bøger/Pensum",
    is_shared: false
  },
  {
    date: "2026-10-05",
    title: "Snacks til Klubmøde",
    amount: 150.00,
    type: "expense",
    category: "Bytur/Socialt",
    is_shared: true,
    split_between_count: 3,
    debtors: [
      { id: "d-105-1", name: "Person 1", amount: 50.00, settled: false },
      { id: "d-105-2", name: "Person 2", amount: 50.00, settled: false }
    ]
  }
];

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

export async function getAllTransactions(filters?: { 
  type?: string; 
  category?: string; 
  search?: string; 
  is_shared?: boolean 
}): Promise<TransactionDTO[]> {
  console.log('getAllTransactions()' );
  const url = new URL(PHP_API_URL);
  url.searchParams.append('method', 'get');

  if (filters?.type && filters.type !== 'all') {
    if (filters.type === 'shared') {
      url.searchParams.append('is_shared', '1');
      url.searchParams.append('type', 'expense');
    } else {
      url.searchParams.append('type', filters.type);
    }
  }

  if (filters?.category && filters.category !== 'all') {
    url.searchParams.append('category', filters.category);
  }

  if (filters?.search) {
    url.searchParams.append('search', filters.search);
  }

  if (filters?.is_shared) {
    url.searchParams.append('is_shared', '1');
  }

  const res = await fetch(url.toString());
  console.log('response:', res);
  if (!res.ok) throw new Error('Fejl ved hentning af transaktioner fra PHP API');
  
  const json: any = await res.json();
  return (json.data || []).map(formatRow);
}

export async function getTransactionById(id: string): Promise<TransactionDTO | null> {
  const res = await fetch(`${PHP_API_URL}?method=get&id=${id}`);
  if (!res.ok) return null;
  
  const json: any = await res.json();
  const rows = json.data || [];
  if (rows.length === 0) return null;
  
  return formatRow(rows[0]);
}

export async function createTransaction(data: Omit<TransactionDTO, 'id'> & { id?: string }): Promise<TransactionDTO> {
  const id = data.id || `tx-${Date.now().toString().slice(-6)}`; //overskrivs i php
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
  console.log('payload:',payload)
  const res = await fetch(`${PHP_API_URL}?method=post`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const json: any = await res.json();
  if (!res.ok) throw new Error(json.error || 'Fejl ved oprettelse af transaktion');
  
  return formatRow(json.transaction || payload);
}

export async function updateTransaction(id: string, data: Partial<TransactionDTO>): Promise<TransactionDTO | null> {
  const current = await getTransactionById(id);
  if (!current) return null;

  const merged = { ...current, ...data };
  const splitCount = merged.split_between_count || 1;

  let debtors = merged.debtors;
  if (merged.is_shared && (!debtors || debtors.length === 0)) {
    debtors = buildDefaultDebtors(id, merged.amount, splitCount, Boolean(merged.settled));
  } //indsæt standard 

  const isAllSettled = merged.is_shared && debtors && debtors.length > 0
    ? debtors.every((d) => d.settled)
    : Boolean(merged.settled);

  const payload = {
    ...merged,
    is_shared: merged.is_shared ? 1 : 0,
    settled: isAllSettled ? 1 : 0,
    debtors: debtors ? JSON.stringify(debtors) : null
  };

  const res = await fetch(`${PHP_API_URL}?id=${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const json: any = await res.json();
  if (!res.ok) return null;
  
  return formatRow(json.transaction || payload);
}

export async function deleteTransaction(id: string): Promise<boolean> {
  const res = await fetch(`${PHP_API_URL}?id=${id}`, {
    method: 'DELETE'
  });
  return res.ok;
}

export async function toggleSettledTransaction(id: string): Promise<TransactionDTO | null> {
  const current = await getTransactionById(id);
  if (!current) return null;

  const newSettledState = !current.settled;
  let newDebtors = current.debtors;
  
  if (current.is_shared && current.debtors && current.debtors.length > 0) {
    newDebtors = current.debtors.map((d) => ({
      ...d,
      settled: newSettledState,
      settled_at: newSettledState ? new Date().toISOString() : undefined,
    }));
  }

  return updateTransaction(id, {
    settled: newSettledState,
    debtors: newDebtors,
  });
}

// NY FUNKTION: Afkryds en enkelt debtor (delvis afregning)
export async function toggleDebtorSettled(transactionId: string, debtorId: string): Promise<TransactionDTO | null> {
  const current = await getTransactionById(transactionId);
  if (!current || !current.debtors) return null;
  console.log('toggleDebtorSettled, debtorId:',debtorId )
  const updatedDebtors = current.debtors.map((d) => {
    if (d.id === debtorId) {
      const nextSettled = !d.settled;
      return {
        ...d,
        settled: nextSettled,
        settled_at: nextSettled ? new Date().toISOString() : undefined,
      };
    }
    return d;
  });

  return updateTransaction(transactionId, {
    debtors: updatedDebtors,
  });
}

export async function updateDebtors(transactionId: string, debtors: DebtorDTO[]): Promise<TransactionDTO | null> {
  return updateTransaction(transactionId, {
    debtors,
  });
}

export async function resetDatabase(): Promise<TransactionDTO[]> {
  return getAllTransactions();
}