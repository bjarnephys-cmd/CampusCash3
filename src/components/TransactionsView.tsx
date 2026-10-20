import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  Trash2, 
  Edit3, 
  ArrowUpRight, 
  ArrowDownRight, 
  Users, 
  CheckCircle2, 
  SlidersHorizontal,
  X
} from 'lucide-react';
import { Transaction, STUDENT_CATEGORIES, CATEGORY_COLORS } from '../types/finance';
import { formatCurrency, formatDate, getTransactionSettlementStats } from '../utils/formatters';

interface TransactionsViewProps {
  transactions: Transaction[];
  onOpenAddModal: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  initialCategoryFilter?: string | null;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  onOpenAddModal,
  onEditTransaction,
  onDeleteTransaction,
  initialCategoryFilter,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income' | 'shared'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategoryFilter || 'all');
  const [sortOrder, setSortOrder] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');

  // Filtered & Sorted Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Search, for hver tx tjekkes om den kommer igennem filter, hvis ikke sker return false: der laves ny temp-liste med transaktiion, som returns true gennem filteret, disse fortsætter så gennem sorterings-mekanismen 
   
      const query = (searchQuery ?? '').toLowerCase();
      const matchesSearch = 
      (tx.title ?? '').toLowerCase().includes(query) ||
      (tx.category ?? '').toLowerCase().includes(query) ||
      (tx.notes ?? '').toLowerCase().includes(query);
      

      if (!matchesSearch) return false;

      // Type filter
      if (typeFilter === 'income' && tx.type !== 'income') return false;
      if (typeFilter === 'expense' && tx.type !== 'expense') return false;
      if (typeFilter === 'shared' && (!tx.is_shared || tx.type !== 'expense')) return false;

      // Category filter
      if (categoryFilter !== 'all' && tx.category !== categoryFilter) return false;

      return true;
    }).sort((a, b) => {
      if (sortOrder === 'date-desc') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (sortOrder === 'date-asc') {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      if (sortOrder === 'amount-desc') {
        return b.amount - a.amount;
      }
      if (sortOrder === 'amount-asc') {
        return a.amount - b.amount;
      }
      return 0;
    });
  }, [transactions, searchQuery, typeFilter, categoryFilter, sortOrder]);  // koden i {} køeres kun hvis een af størrelserne i [] ændres!

  // Aggregate stats for filtered set
  const filteredTotal = filteredTransactions.reduce((acc, t) => {
    return t.type === 'income' ? acc + t.amount : acc - t.amount;
  }, 0);

  const hasActiveFilters = searchQuery !== '' || typeFilter !== 'all' || categoryFilter !== 'all' || sortOrder !== 'date-desc';

  const resetFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setCategoryFilter('all');
    setSortOrder('date-desc');
  }; // ved resetFilters settes disse default-værdier

  // Get all unique categories present in transactions plus standard ones
  const availableCategories = useMemo(() => {
    const set = new Set([...STUDENT_CATEGORIES, ...transactions.map((t) => t.category)]);
    return Array.from(set);
  }, [transactions]);

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Posteringer
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Overblik over alle registrerede indtægter, udgifter og fælles regninger
          </p>
        </div>

        <button
          onClick={onOpenAddModal}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 rounded-lg shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Opret postering</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs space-y-3">
        {/* Search & Main Type Segmented Control */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Søg i titel, kategori eller noter..."
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Type Segmented Buttons */}
          <div className="sm:col-span-6 flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto no-scrollbar">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex-1 text-center ${
                typeFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Alle ({transactions.length})
            </button>
            <button
              onClick={() => setTypeFilter('expense')}
              className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex-1 text-center ${
                typeFilter === 'expense'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Udgifter
            </button>
            <button
              onClick={() => setTypeFilter('income')}
              className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex-1 text-center ${
                typeFilter === 'income'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Indtægt
            </button>
            <button
              onClick={() => setTypeFilter('shared')}
              className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex-1 text-center ${
                typeFilter === 'shared'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Fælles
            </button>
          </div>
        </div>

        {/* Category & Sorting Secondary Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Filter className="w-3.5 h-3.5" />
              <span>Kategori:</span>
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
            >
              <option value="all">Alle kategorier</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1.5 text-slate-500 ml-2">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Sortering:</span>
            </div>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
            >
              <option value="date-desc">Dato: Nyeste først</option>
              <option value="date-asc">Dato: Ældste først</option>
              <option value="amount-desc">Beløb: Højest først</option>
              <option value="amount-asc">Beløb: Lavest først</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs text-rose-600 hover:text-rose-700 font-medium hover:underline transition-colors"
            >
              Ryd alle filtre
            </button>
          )}
        </div>
      </div>

      {/* Filter Stats Bar */}
      <div className="flex items-center justify-between px-1 text-xs text-slate-500">
        <span>
          Viser <strong className="font-mono text-slate-800">{filteredTransactions.length}</strong> af {transactions.length} posteringer
        </span>
        <span>
          Nettosum for viste:{' '}
          <strong
            className={`font-mono ${
              filteredTotal >= 0 ? 'text-emerald-700 font-semibold' : 'text-slate-900 font-semibold'
            }`}
          >
            {formatCurrency(filteredTotal)}
          </strong>
        </span>
      </div>

      {/* Transactions Data Table */}
      <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-xs">
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-800">Ingen posteringer matcher dine filtre</p>
            <p className="text-xs text-slate-500 mt-1">Prøv at søge efter noget andet eller nulstil dine filtre.</p>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="mt-4 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
              >
                Nulstil filtre
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold text-slate-500 tracking-wider">
                  <th className="py-3 px-4">Dato</th>
                  <th className="py-3 px-4">Beskrivelse</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4 text-center">Type</th>
                  <th className="py-3 px-4 text-right">Beløb (DKK)</th>
                  <th className="py-3 px-4 text-right">Handlinger</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">


                {filteredTransactions.map((tx) => {
                  //console.log('tx:',tx.id)
                  
                  
                  const isIncome = tx.type === 'income';
                  const catColor = CATEGORY_COLORS[tx.category];
                  const sharedStats = tx.is_shared ? getTransactionSettlementStats(tx) : null;

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Date */}
                      <td className="py-3 px-4 text-slate-600 font-mono text-xs whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>

                      {/* Title & metadata */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{tx.title}</span>
                          {tx.is_shared && sharedStats && (
                            <span className={`inline-flex items-center gap-1 text-[11px] font-mono px-1.5 py-0.2 rounded border ${
                              sharedStats.isFullySettled
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : sharedStats.isPartiallySettled
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-200/60'
                            }`}>
                              <Users className="w-3 h-3" />
                              Delt ({tx.split_between_count} pers.) · {
                                sharedStats.isFullySettled 
                                  ? 'Alle har betalt ✓' 
                                  : `${sharedStats.settledCount}/${sharedStats.debtorCount} betalt`
                              }
                            </span>
                          )}
                        </div>
                        {tx.is_shared && sharedStats && (
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            Din andel: {formatCurrency(sharedStats.myShare)} · Modtaget: <strong className="text-emerald-700">{formatCurrency(sharedStats.totalSettled)}</strong> · Mangler: <strong className="text-amber-700">{formatCurrency(sharedStats.totalPending)}</strong>
                          </div>
                        )}
                        {tx.notes && (
                          <div className="text-[11px] text-slate-400 mt-0.5 italic">
                            {tx.notes}
                          </div>
                        )}
                      </td>

                      {/* Category - clean text without pill slop */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: catColor?.fill || '#64748B' }}
                          />
                          <span className="text-slate-700 font-medium text-xs">
                            {tx.category}
                          </span>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {isIncome ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                            Indtægt
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            <ArrowDownRight className="w-3 h-3 text-slate-400" />
                            Udgift
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono">
                        <span
                          className={`font-semibold ${
                            isIncome ? 'text-emerald-700' : 'text-slate-900'
                          }`}
                        >
                          {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onEditTransaction(tx)}
                            title="Rediger postering"
                            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Vil du slette posteringen "${tx.title}"?`)) {
                                onDeleteTransaction(tx.id);
                              }
                            }}
                            title="Slet postering"
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
