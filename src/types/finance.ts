export type TransactionType = 'income' | 'expense';

export interface Debtor {
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
  type: TransactionType;
  category: string;
  is_shared: boolean;
  split_between_count?: number;
  notes?: string;
  settled?: boolean;
  debtors?: Debtor[];   // ? for at vise optional felt
}

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: "tx-101",
    date: "2026-10-01",
    title: "SU Udbetaling",
    amount: 6820.00,
    type: "income",
    category: "SU/Job",
    is_shared: false
  },
  {
    id: "tx-102",
    date: "2026-10-01",
    title: "Husleje Kollegie",
    amount: 3200.00,
    type: "expense",
    category: "Bolig/Husleje",
    is_shared: false
  },
  {
    id: "tx-103",
    date: "2026-10-03",
    title: "Kantine Frokost",
    amount: 45.00,
    type: "expense",
    category: "Kantine/Mad",
    is_shared: false
  },
  {
    id: "tx-104",
    date: "2026-10-04",
    title: "Pensumbog i Mikroøkonomi",
    amount: 420.00,
    type: "expense",
    category: "Bøger/Pensum",
    is_shared: false
  },
  {
    id: "tx-105",
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

export const CATEGORY_COLORS: Record<string, { bg: string; text: string; fill: string; border: string }> = {
  "SU/Job": { bg: "bg-emerald-50", text: "text-emerald-700", fill: "#059669", border: "border-emerald-200" },
  "Bolig/Husleje": { bg: "bg-blue-50", text: "text-blue-700", fill: "#2563EB", border: "border-blue-200" },
  "Kantine/Mad": { bg: "bg-amber-50", text: "text-amber-700", fill: "#D97706", border: "border-amber-200" },
  "Bøger/Pensum": { bg: "bg-purple-50", text: "text-purple-700", fill: "#7C3AED", border: "border-purple-200" },
  "Bytur/Socialt": { bg: "bg-rose-50", text: "text-rose-700", fill: "#E11D48", border: "border-rose-200" },
  "Transport": { bg: "bg-cyan-50", text: "text-cyan-700", fill: "#0891B2", border: "border-cyan-200" },
  "Abonnementer": { bg: "bg-indigo-50", text: "text-indigo-700", fill: "#4F46E5", border: "border-indigo-200" },
  "Diverse": { bg: "bg-slate-50", text: "text-slate-700", fill: "#475569", border: "border-slate-200" },
};

export const DEFAULT_CATEGORY_FILL = "#64748B";

export const STUDENT_CATEGORIES = [
  "Bolig/Husleje",
  "Kantine/Mad",
  "Bøger/Pensum",
  "Bytur/Socialt",
  "SU/Job",
  "Transport",
  "Abonnementer",
  "Diverse"
];
