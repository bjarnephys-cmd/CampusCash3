import { Transaction } from '../types/finance';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('da-DK', {
    style: 'currency',
    currency: 'DKK',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('da-DK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    return new Intl.DateTimeFormat('da-DK', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateStr;
  }
}

export function generateCSV(transactions: Transaction[]): string {
  const headers = [
    'ID',
    'Dato',
    'Beskrivelse',
    'Type',
    'Kategori',
    'Beloeb_DKK',
    'Er_Delt',
    'Antal_Personer',
    'Din_Andel_DKK',
    'Afregnet'
  ];

  const rows = transactions.map((t) => {
    const yourShare = t.is_shared && t.split_between_count && t.split_between_count > 0
      ? (t.amount / t.split_between_count).toFixed(2)
      : t.amount.toFixed(2);

    return [
      `"${t.id}"`,
      `"${t.date}"`,
      `"${t.title.replace(/"/g, '""')}"`,
      `"${t.type}"`,
      `"${t.category.replace(/"/g, '""')}"`,
      t.amount.toFixed(2),
      t.is_shared ? 'Ja' : 'Nej',
      t.is_shared ? (t.split_between_count || 1) : 1,
      yourShare,
      t.settled ? 'Ja' : 'Nej'
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

export function downloadCSV(csvContent: string, fileName = 'campuscash_export.csv'): void {
  const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getDebtorsForTransaction(tx: Transaction) {
  if (!tx.is_shared || !tx.split_between_count || tx.split_between_count <= 1) {
    return [];
  }
  if (tx.debtors && tx.debtors.length > 0) {
    return tx.debtors;
  }
  const debtorCount = tx.split_between_count - 1;
  const perPerson = Math.round((tx.amount / tx.split_between_count) * 100) / 100;
  return Array.from({ length: debtorCount }, (_, i) => ({
    id: `d-${tx.id}-${i + 1}`,
    name: `Person ${i + 1}`,
    amount: perPerson,
    settled: Boolean(tx.settled),
  }));
}

export function getTransactionSettlementStats(tx: Transaction) {
  let debtors = getDebtorsForTransaction(tx);
  // 1. Gør debtors sikker, så den altid er et array
 
  if (typeof debtors === 'string') {
    try {
      debtors = JSON.parse(debtors);
    } catch (e) {
      debtors = [];
    }
  }
  debtors = Array.isArray(debtors) ? debtors : [];
  //console.log('in getTransactionSettlementStats(), debtors:',debtors)
  if (debtors.length === 0) {
    return {
      debtors: [],
      totalOwed: 0,
      totalSettled: 0,
      totalPending: 0,
      settledCount: 0,
      debtorCount: 0,
      isFullySettled: Boolean(tx.settled),
      isPartiallySettled: false,
      myShare: tx.amount,
    };
  }

  
  

  const amount = Number(tx.amount) || 0;
  const splitCount = Number(tx.split_between_count) || (debtors.length + 1);

  // 2. Beregninger med indbyggede sikkerhedstjek
  const count = Math.max(1, splitCount);
  const myShare = amount / count;
  const totalOwed = amount - myShare;  
 
  //console.log('getTransactionSettlementStats() called for transaction:', tx.id,'with debtors:', debtors,'myShare :', myShare,'totalOwed:', totalOwed);
  const totalSettled = debtors.filter((d) => d.settled).reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
  const totalPending = debtors.filter((d) => !d.settled).reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
  const settledCount = debtors.filter((d) => d.settled).length;
  //console.log('getTransactionSettlementStats() computed totals for transaction:', tx.id,'totalSettled:', totalSettled, 'totalPending:', totalPending);
  const isFullySettled = settledCount === debtors.length && debtors.length > 0;
  const isPartiallySettled = settledCount > 0 && settledCount < debtors.length;


  return {
    debtors,
    totalOwed,
    totalSettled,
    totalPending,
    settledCount,
    debtorCount: debtors.length,
    isFullySettled,
    isPartiallySettled,
    myShare,
  };
}

