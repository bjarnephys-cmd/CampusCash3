import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  ChevronRight,
  Plus
} from 'lucide-react';
import { Transaction, CATEGORY_COLORS } from '../types/finance';
import { formatCurrency, formatDate, getTransactionSettlementStats } from '../utils/formatters';
import { CategoryPieChart } from './CategoryPieChart';

interface DashboardViewProps {
  transactions: Transaction[];
  onOpenAddModal: () => void;
  onNavigateToTransactions: (categoryFilter?: string) => void;
  onNavigateToShared: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  transactions,
  onOpenAddModal,
  onNavigateToTransactions,
  onNavigateToShared,
}) => {
  // Calculations
  //console.log('DashboardView() called with transactions:', transactions);
  // Garanter at safeTransactions altid er et ægte array
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const expenseTransactions = safeTransactions.filter((t) => t.type === 'expense');
  const incomeTransactions  = safeTransactions.filter((t) => t.type === 'income');

  
const totalIncome = incomeTransactions.reduce((acc, t) => acc + Number(t.amount || 0), 0); //t.amount modtages som str
const totalExpense = expenseTransactions.reduce((acc, t) => acc + Number(t.amount || 0), 0);

// Shared calculations based on individual debtor statuses
const sharedExpenses = expenseTransactions.filter((t) => t.is_shared);
const totalSharedOutlay = sharedExpenses.reduce((acc, t) => acc + Number(t.amount || 0), 0);
 
//console.log('totalIncome =', totalIncome,' totalExpense', totalExpense, 'totalDashboardView() sharedExpenses:', sharedExpenses, 'totalSharedOutlay:', totalSharedOutlay);
  
  let totalPendingOwed = 0;
  let totalReimbursed = 0;
  let yourSharedPortion = 0;

  sharedExpenses.forEach((t) => {
    const stats = getTransactionSettlementStats(t);
    totalPendingOwed += stats.totalPending;
    totalReimbursed += stats.totalSettled;
    yourSharedPortion += stats.myShare;
    //console.log(`Transaction ID: ${t.id}, Total Pending: ${stats.totalPending}, Total Settled: ${stats.totalSettled}, My Share: ${stats.myShare}`);
  });
  //console.log('totalPendingOwed',totalPendingOwed,'totalReimbursed',totalReimbursed,'yourSharedPortion',yourSharedPortion);
  // Balance calculation (accounting for reimbursements received from debtors)
  const netBalance = totalIncome - totalExpense + totalReimbursed;
 
  // Student Daily Pacing Indicator (October has 31 days)
  const currentDayOfMonth = 5;
  const daysInMonth = 31;
  const daysRemaining = daysInMonth - currentDayOfMonth;
  const dailySpendable = netBalance > 0 && daysRemaining > 0 ? netBalance / daysRemaining : 0;
  const effectiveExpense = totalExpense - totalReimbursed;
  const expensePercentageOfIncome = totalIncome > 0 ? (effectiveExpense / totalIncome) * 100 : 0;

   //console.log('DashboardView() called with transactions:', safeTransactions, 'netBalance:', netBalance, 'dailySpendable:', dailySpendable, 'expensePercentageOfIncome:', expensePercentageOfIncome);


  // Recent 5 transactions
  
  const recentTransactions = [...safeTransactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Page Title & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            SU & Studiebudget Oversigt
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Status for oktober 2026 · {daysRemaining} dage tilbage til næste SU-udbetaling
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-slate-600" />
            <span>Hurtig postering</span>
          </button>
        </div>
      </div>

      {/* 4 Key Metric Cards (Single-Elevation, hairline borders) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Balance Card */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Nuværende rådighedsbeløb</span>
            <div className={`p-1.5 rounded-lg ${netBalance >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tracking-tight text-slate-900">
              {formatCurrency(netBalance)}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                <strong className="font-mono text-slate-700">{formatCurrency(dailySpendable)}</strong>/dag i restbudget
              </span>
            </div>
          </div>
        </div>

        {/* Total Income Card */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Samlet indtægt (SU & Job)</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tracking-tight text-emerald-700">
              +{formatCurrency(totalIncome)}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              <span>{incomeTransactions.length} indtægtspostering i alt</span>
            </div>
          </div>
        </div>

        {/* Total Expenses Card */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Samlede udgifter</span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-700">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tracking-tight text-slate-900">
              -{formatCurrency(totalExpense)}
            </div>
            <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
              <span>{expenseTransactions.length} udgifter registreret</span>
              <span className="font-mono text-slate-600 font-medium">
                {expensePercentageOfIncome.toFixed(0)}% af SU
              </span>
            </div>
          </div>
        </div>

        {/* Shared Outlay Card */}
        <div 
          onClick={onNavigateToShared}
          className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs flex flex-col justify-between cursor-pointer hover:border-slate-300 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Fællesudlæg tilgode</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 group-hover:bg-indigo-100 transition-colors">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tracking-tight text-slate-900">
              {formatCurrency(totalPendingOwed)}
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
              <span>{totalReimbursed > 0 ? `${formatCurrency(totalReimbursed)} modtaget` : 'Andre skylder dig'}</span>
              <span className="text-indigo-600 font-medium flex items-center gap-0.5 group-hover:underline">
                Se split <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Progress & Budget Pacing Banner */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-800">Budgetforbrug vs. Indkomst</span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500">
              Brugt {formatCurrency(totalExpense)} af {formatCurrency(totalIncome)}
            </span>
          </div>
          <span className="text-xs font-mono font-medium text-slate-700">
            {netBalance >= 0 ? `${(100 - expensePercentageOfIncome).toFixed(1)}% tilbage til opsparing / buffer` : 'Budget overskredet'}
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
          <div 
            className="bg-emerald-600 h-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, 100 - expensePercentageOfIncome))}%` }}
            title="Resterende rådighedsbeløb"
          />
          <div 
            className="bg-slate-400 h-full transition-all duration-500"
            style={{ width: `${Math.min(100, expensePercentageOfIncome)}%` }}
            title="Forbrugte midler"
          />
        </div>
      </div>

      {/* Grid: Interactive Pie Chart (60%) & Recent Activity (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Category Pie Chart */}
        <div className="lg:col-span-7">
          <CategoryPieChart
            transactions={transactions}
            onSelectCategory={(cat) => onNavigateToTransactions(cat)}
          />
        </div>

        {/* Recent Transactions List */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">Seneste posteringer</h3>
              <p className="text-xs text-slate-500 mt-0.5">Sidst registrerede SU, køb og udlæg</p>
            </div>
            <button
              onClick={() => onNavigateToTransactions()}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors flex items-center gap-0.5"
            >
              <span>Se alle ({transactions.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {recentTransactions.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Ingen posteringer endnu.</p>
            ) : (
              recentTransactions.map((tx, index) => {
                const isIncome = tx.type === 'income';
                const catColor = CATEGORY_COLORS[tx.category];

                return (
                  <div
                    key={tx.id ? `${tx.id}-${index}` : index} // før key=t.id
                    onClick={() => onNavigateToTransactions()}
                    className="py-3 flex items-center justify-between hover:bg-slate-50/70 -mx-2 px-2 rounded-lg transition-colors cursor-pointer"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-slate-900 truncate">
                          {tx.title}
                        </span>
                        {tx.is_shared && (
                          <span className="shrink-0 text-[10px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200/60">
                            Delt
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                        <span>{formatDate(tx.date)}</span>
                        <span aria-hidden="true">·</span>
                        <span 
                          className="font-medium"
                          style={{ color: catColor?.fill || '#64748B' }}
                        >
                          {tx.category}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span
                        className={`font-mono text-xs font-semibold ${
                          isIncome ? 'text-emerald-700' : 'text-slate-900'
                        }`}
                      >
                        {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                      </span>
                      {tx.is_shared && tx.split_between_count && (
                        <span className="block text-[10px] font-mono text-slate-400 mt-0.5">
                          Din andel: {formatCurrency(tx.amount / tx.split_between_count)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
