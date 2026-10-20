import React, { useState, useEffect, useCallback } from 'react';
import { Transaction, INITIAL_TRANSACTIONS } from './types/finance';
import { Header, ActiveTab } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { TransactionsView } from './components/TransactionsView';
import { SharedExpensesView } from './components/SharedExpensesView';
import { ExportView } from './components/ExportView';
import { AddTransactionModal } from './components/AddTransactionModal';
import { 
  fetchTransactions, 
  createTransaction, 
  updateTransaction, 
  deleteTransaction, 
  toggleSettled, 
  toggleDebtorSettled,
  setAllDebtors,
  updateDebtors,
  resetTransactions

} from './services/api';  // fra filen /services/api.ts 
import { Loader2 } from 'lucide-react';
import { Debtor } from './types/finance';

export default function App() {


  // Sørg for at den starter som et tomt array [], ikke undefined!
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [prefilledCategoryFilter, setPrefilledCategoryFilter] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [networkTime, setNetworkTime] = useState<number | null>(null);

  // Load from Express backend on mount
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setApiError(null);

    
      // 1. Start uret lige før kaldet sendes af sted
      const startTime = performance.now();
      const response = await fetchTransactions();  // kalder ned i /services/api
      console.log('response',response)
      const data =  response.data; //transactions[]
      const PHPtime =  response.PHPtime;
      // 2. Stop uret når data er modtaget
      const endTime = performance.now();
      //let _NetworkTime = Number(endTime - startTime).toFixed(1) // duer ikke, toFixed() omgør den til str
      const NetworkTime = endTime - startTime - PHPtime;
      setNetworkTime(NetworkTime)

      console.log(`🌐 Samlet netværkstid (Frontend -> Websserver-> Svar): ${NetworkTime.toFixed(0)} ms`);


      // 🛡️ Ekstra sikkerhedstjek: Er det rent faktisk et array?
      if (Array.isArray(data)) {
        setTransactions(data);
      } else {
        console.error("Advarsel: Modtog ikke et gyldigt array af transaktioner:", data);
        setTransactions([]); // Sæt til tomt array som fallback for at undgå crash
      }

      
    } catch (err: any) {
      console.warn('API error, using initial dataset:', err);
      setApiError('Forbinder til server...');
      // Fallback to initial transactions
      setTransactions((prev) => {
        prev = Array.isArray(prev) ? prev : [];
        prev.length > 0 ? prev : INITIAL_TRANSACTIONS;
        return prev
      });
    } finally {
      setIsLoading(false);
    }
  }, []);





  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers wired to Express SQLite Backend
  const handleSaveTransaction = async (
    txData: Omit<Transaction, 'id'> & { id?: string }
  ) => {
    try {
      if (txData.id) {
        // Update in backend
        const response = await updateTransaction(txData.id, txData);  //{transaction,debug} obj 
        console.log('Svar fra backend:', response);
         // Træk selve transaktionen ud (hvis den ligger i et .transaction felt)
        const updated = response.transaction || response;
    
  ;
        setTransactions((prev) => prev.map((t) => (t.id === txData.id ? updated : t)));
      } else {
        // Create in backend
        const created = await createTransaction(txData);
        setTransactions((prev) => [created, ...prev]);
      }
    } catch (err: any) {
      console.error('Error saving transaction to backend:', err);
      // Fallback local update
      if (txData.id) {
        setTransactions((prev) => {
          prev = Array.isArray(prev) ? prev : [];
          return [created, ...prev];
        });

        
      } else {
        const fallback: Transaction = {
          ...txData,
          id: `tx-${Date.now().toString().slice(-5)}`,
        };
        setTransactions((prev) => [fallback, ...prev]);
      }
    } finally {
      setEditingTransaction(null);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await deleteTransaction(id);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } catch (err: any) {
      console.error('Error deleting transaction from backend:', err);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    }
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsAddModalOpen(true);
  };

  const handleToggleSettled = async (id: string) => {
    try {
      const updated = await toggleSettled(id);
      setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (err: any) {
      console.error('Error toggling settled on backend:', err);
      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? { ...t, settled: !t.settled } : t))
      );
    }
  };

  const handleSetAllDebtors = async (transactionId: string, targetSettled: boolean) => {
    try {
      // Kald backend med både ID og den ønskede tilstand
      const updated = await setAllDebtors(transactionId, targetSettled);
      setTransactions((prev) => prev.map((t) => (t.id === transactionId ? updated : t)));
    } catch (err) {
      console.error('Fejl ved opdatering af alle debitorer:', err);
    }
  };


  const handleToggleDebtorSettled = async (transactionId: string, debtorId: string) => {
    console.log('handleToggleDebtorSettled() called with transactionId:', transactionId,
       'debtorId:', debtorId);
    try {
      const updated = await toggleDebtorSettled(transactionId, debtorId);
      console.log('handleToggleDebtorSettled() backend response:', updated);
      setTransactions((prev) => prev.map((t) => (t.id === transactionId ? updated : t)));
    } catch (err: any) {
      console.error('Error toggling debtor on backend:', err);
      setTransactions((prev) =>
        prev.map((t) => {
          if (t.id !== transactionId || !t.debtors) return t;
          const nextDebtors = t.debtors.map((d) =>
            d.id === debtorId ? { ...d, settled: !d.settled } : d
          );
          const allSettled = nextDebtors.every((d) => d.settled);
          return { ...t, debtors: nextDebtors, settled: allSettled };
        })
      );
    }
  };

  const handleUpdateDebtors = async (transactionId: string, debtors: Debtor[]) => {
    console.log('handleUpdateDebtors() called with transactionId:', transactionId, 'debtors:', debtors);
    
    try {
      const updated = await updateDebtors(transactionId, debtors);
      setTransactions((prev) => prev.map((t) => (t.id === transactionId ? updated : t)));
    } catch (err: any) {
      console.error('Error updating debtors on backend:', err);
      setTransactions((prev) =>
        prev.map((t) => (t.id === transactionId ? { ...t, debtors } : t))
      );
    }
  };

  const handleResetData = async () => {
    if (window.confirm('Vil du nulstille SQLite databasen til de oprindelige 5 test-posteringer?')) {
      try {
        const resetList = await resetTransactions();
        setTransactions(resetList);
      } catch (err: any) {
        console.error('Error resetting backend data:', err);
        setTransactions(INITIAL_TRANSACTIONS);
      }
    }
  };

  const handleNavigateToTransactions = (categoryFilter?: string) => {
    if (categoryFilter) {
      setPrefilledCategoryFilter(categoryFilter);
    } else {
      setPrefilledCategoryFilter(null);
    }
    setActiveTab('transactions');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col">
      {/* Top Bar Header */}
      <Header
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'transactions') {
            setPrefilledCategoryFilter(null);
          }
        }}
        onOpenAddModal={() => {
          setEditingTransaction(null);
          setIsAddModalOpen(true);
        }}
        onResetData={handleResetData}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {isLoading && transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
            <p className="text-sm font-medium">Henter data fra fjern MySQL database(networkstid 1-2 sek)</p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardView
                transactions={transactions}
                onOpenAddModal={() => {
                  setEditingTransaction(null);
                  setIsAddModalOpen(true);
                }}
                onNavigateToTransactions={handleNavigateToTransactions}
                onNavigateToShared={() => setActiveTab('shared')}
              />
            )}

            {activeTab === 'transactions' && (
              <TransactionsView
                transactions={transactions}
                onOpenAddModal={() => {
                  setEditingTransaction(null);
                  setIsAddModalOpen(true);
                }}
                onEditTransaction={handleEditTransaction}
                onDeleteTransaction={handleDeleteTransaction}
                initialCategoryFilter={prefilledCategoryFilter}
              />
            )}

            {activeTab === 'shared' && (
              <SharedExpensesView
                transactions={transactions}
                //onToggleSettled ={handleToggleSettled}
                onToggleDebtorSettled={handleToggleDebtorSettled}
                onUpdateDebtors={handleUpdateDebtors}
                onSetAllDebtors = { handleSetAllDebtors }
                onAddTransaction={(tx) => handleSaveTransaction(tx)}
              />
            )}

            {activeTab === 'export' && (
              <ExportView transactions={transactions} />
            )}
          </>
        )}
      </main>

      {/* Add / Edit Transaction Modal */}
      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingTransaction(null);
        }}
        onSave={handleSaveTransaction}
        initialData={editingTransaction}
      />

      {/* Subtle footer */}
      <footer className="border-t border-slate-200/80 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">CampusCash</span>
            <span>·</span>
            <span>Studieøkonomi & SU-budget (Express + remote MySQL-database)</span>
            {networkTime !== null && (
            <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
              ⚡ Netværkstid: {networkTime.toFixed(0)} ms
            </span>
            )}
          </div>
          <div className="flex items-center gap-3">
             <span className="font-mono text-slate-600">{transactions.length > 0 ? transactions.length : 0} posteringer synkroniseret</span>
         
          {/*
          <button
            onClick={handleResetData}
            className="hover:text-slate-800 underline transition-colors"
          >
            Nulstil MySQL database
          </button>
          */}
         
          </div>
        </div>
      </footer>
    </div>
  );
}
