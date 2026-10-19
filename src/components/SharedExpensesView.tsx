import React, { useState } from 'react';
import { 
  Users, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  Receipt, 
  CheckCircle2, 
  Clock, 
  Calculator,
  UserCheck,
  UserX,
  Edit2
} from 'lucide-react';
import { Transaction, Debtor } from '../types/finance';
import { formatCurrency, getTransactionSettlementStats } from '../utils/formatters';

interface SharedExpensesViewProps {
  transactions: Transaction[];
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  onToggleDebtorSettled: (transactionId: string, debtorId: string) => void;
  onUpdateDebtors?: (transactionId: string, debtors: Debtor[]) => void;  //? betyder den er optional
  onSetAllDebtors: (transactionId: string, targetSettled: boolean) => void;

}

interface Participant {
  id: string;
  name: string;
}

export const SharedExpensesView: React.FC<SharedExpensesViewProps> = ({
  transactions,
  onAddTransaction,
  onToggleDebtorSettled,
  onUpdateDebtors,
  onSetAllDebtors,


}) => {
  // Shared transactions from current ledger
  const sharedTxList = transactions.filter((t) => t.is_shared && t.type === 'expense');

  // Aggregates calculated per individual debtor settlement
  let totalOutlay = 0;
  let myTotalPortion = 0;
  let totalReimbursedAmount = 0;
  let totalPendingAmount = 0;
  let totalPendingDebtors = 0;
  let totalSettledDebtors = 0;

  sharedTxList.forEach((t) => {
    const stats = getTransactionSettlementStats(t);
    totalOutlay += t.amount;
    myTotalPortion += stats.myShare;
    totalReimbursedAmount += stats.totalSettled;
    totalPendingAmount += stats.totalPending;
    totalSettledDebtors += stats.settledCount;
    totalPendingDebtors += (stats.debtorCount - stats.settledCount);
  });

  // --- Group Split Calculator State ---
  const [calcTitle, setCalcTitle] = useState('Fællesaftensmad i kollegiet');
  const [calcAmount, setCalcAmount] = useState<string>('240');
  const [paidBy, setPaidBy] = useState<string>('Mig');
  const [participants, setParticipants] = useState<Participant[]>([
    { id: '1', name: 'Mig' },
    { id: '2', name: 'Sofie' },
    { id: '3', name: 'Lukas' },
    { id: '4', name: 'Freja' },
  ]);
  const [newPersonName, setNewPersonName] = useState('');
  const [copiedText, setCopiedText] = useState(false);
  const [copiedDebtorId, setCopiedDebtorId] = useState<string | null>(null);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [editingDebtorId, setEditingDebtorId] = useState<string | null>(null);
  const [tempDebtorName, setTempDebtorName] = useState<string>('');

  // Calculation results
  const parsedAmount = parseFloat(calcAmount.replace(',', '.')) || 0;
  const participantCount = participants.length > 0 ? participants.length : 1;
  const perPersonShare = parsedAmount > 0 ? Math.round((parsedAmount / participantCount) * 100) / 100 : 0;

  const handleAddParticipant = () => {
    if (!newPersonName.trim()) return;
    setParticipants([
      ...participants,
      { id: Date.now().toString(), name: newPersonName.trim() },
    ]);
    setNewPersonName('');
  };

  const handleRemoveParticipant = (id: string) => {
    if (participants.length <= 2) {
      alert('Der skal være mindst 2 personer til et gruppesplit.');
      return;
    }
    setParticipants(participants.filter((p) => p.id !== id));
  };

  // Generate friendly message for MobilePay
  const mobilePayMessage = `Hej! 🍕 Udlæg til "${calcTitle}": Samlet beløb ${formatCurrency(parsedAmount)}, så det er ${formatCurrency(perPersonShare)} pr. person. Send gerne via MobilePay når du har tid!`;

  const copyMobilePayMessage = () => {
    navigator.clipboard.writeText(mobilePayMessage);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const copyIndividualReminder = (debtorName: string, amount: number, billTitle: string, id: string) => {
    const text = `Hej ${debtorName}! 🍕 Husk venligst ${formatCurrency(amount)} for "${billTitle}" via MobilePay når du har tid. Mange tak! 👍`;
    navigator.clipboard.writeText(text);
    setCopiedDebtorId(id);
    setTimeout(() => setCopiedDebtorId(null), 2000);
  };

  // Add to ledger
  const handleSaveToLedger = () => {
    console.log('CampusCash3, handleSaveToLedger()' )
    if (parsedAmount <= 0) return;

    // Build specific debtors from participants other than 'Mig'
    const otherParticipants = participants.filter((p) => p.name.trim().toLowerCase() !== 'mig');
    const createdDebtors: Debtor[] = otherParticipants.map((p, idx) => ({
      id: `d-${Date.now()}-${idx + 1}`,
      name: p.name.trim(),
      amount: perPersonShare,
      settled: false,
    }));

    onAddTransaction({
      title: calcTitle.trim() || 'Fællesudgift',
      amount: parsedAmount,
      type: 'expense',
      category: 'Bytur/Socialt',
      date: new Date().toISOString().split('T')[0],
      is_shared: true,
      split_between_count: participantCount,
      notes: `Delt mellem: ${participants.map((p) => p.name).join(', ')}`,
      settled: false,
      debtors: createdDebtors,
    });
    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 2500);
  };

  const handleSaveDebtorName = (tx: Transaction, debtorId: string) => {
    if (!tempDebtorName.trim() || !onUpdateDebtors) {
      setEditingDebtorId(null);
      return;
    }
    const currentStats = getTransactionSettlementStats(tx);
    const updated = currentStats.debtors.map((d) =>
      d.id === debtorId ? { ...d, name: tempDebtorName.trim() } : d
    );
    console.log('handleSaveDebtorName() called for transaction:', tx.id, 'debtorId:', 
      debtorId, 'newName:', tempDebtorName.trim(),'debtor', updated);
    
    onUpdateDebtors(tx.id, updated);
    setEditingDebtorId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Fællesudgifter & Gruppesplit
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Hold styr på hvem der skylder hvad og afregn hver enkelt skyldner individuelt
        </p>
      </div>

      {/* Summary Stats Cards - Corrected with Individual Settlements */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Outlay */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Samlet udlagt af dig</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {formatCurrency(totalOutlay)}
            </span>
            <div className="text-xs text-slate-500 mt-1">
              Din egen andel:{' '}
              <strong className="font-mono text-slate-700">{formatCurrency(myTotalPortion)}</strong>
            </div>
          </div>
        </div>

        {/* Card 2: Pending Owed (Dynamic based on debtors) */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Afventer betaling (tilgodehavende)</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-amber-600">
              {formatCurrency(totalPendingAmount)}
            </span>
            <div className="text-xs text-slate-500 mt-1">
              <strong className="font-mono text-amber-700">{totalPendingDebtors}</strong> {totalPendingDebtors === 1 ? 'person mangler' : 'personer mangler'} at betale
            </div>
          </div>
        </div>

        {/* Card 3: Reimbursed Amount */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Allerede modtaget / afregnet</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-emerald-700">
              {formatCurrency(totalReimbursedAmount)}
            </span>
            <div className="text-xs text-slate-500 mt-1">
              <strong className="font-mono text-emerald-700">{totalSettledDebtors}</strong> {totalSettledDebtors === 1 ? 'tilbagebetaling' : 'tilbagebetalinger'} modtaget
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Group Split Calculator (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Kvik-Split Beregner</h2>
                <p className="text-xs text-slate-500 mt-0.5">Beregn lynhurtigt hvem der skylder hvad</p>
              </div>
            </div>
            <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
              {participantCount} deltagere
            </span>
          </div>

          {/* Calculator Inputs */}
          <div className="space-y-4 text-xs sm:text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hvad handler udlægget om?
                </label>
                <input
                  type="text"
                  value={calcTitle}
                  onChange={(e) => setCalcTitle(e.target.value)}
                  placeholder="f.eks. Fredagsbar, Pizza, Kollegieindkøb..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Samlet regning (DKK)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={calcAmount}
                    onChange={(e) => setCalcAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-3 pr-10 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                  />
                  <span className="absolute right-3 top-2 text-xs font-mono text-slate-400">
                    kr.
                  </span>
                </div>
              </div>
            </div>

            {/* Participants list */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Deltagere i regningen ({participants.length})
              </label>

              <div className="flex flex-wrap gap-1.5 mb-2">
                {participants.map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                  >
                    <span>{person.name}</span>
                    {participants.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveParticipant(person.id)}
                        className="text-slate-400 hover:text-rose-600 ml-1 text-sm leading-none"
                        title="Fjern person"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add participant input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddParticipant();
                    }
                  }}
                  placeholder="Tilføj navn (f.eks. Mathias, Line)..."
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleAddParticipant}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  + Tilføj
                </button>
              </div>
            </div>

            {/* Calculation Result Callout */}
            <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-950">
                  Ligeligt split pr. person:
                </span>
                <span className="text-lg font-bold font-mono text-emerald-800">
                  {formatCurrency(perPersonShare)}
                </span>
              </div>

              <div className="pt-2 border-t border-emerald-200/60 text-xs text-emerald-900 space-y-1">
                <div className="flex justify-between">
                  <span>Din andel:</span>
                  <span className="font-mono font-medium">{formatCurrency(perPersonShare)}</span>
                </div>
                <div className="flex justify-between">
                  <span>De {participants.length - 1} andre skylder dig i alt:</span>
                  <span className="font-mono font-bold">{formatCurrency(parsedAmount - perPersonShare)}</span>
                </div>
              </div>
            </div>

            {/* MobilePay Message Sharing */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  MobilePay fællesbesked
                </span>
                <button
                  type="button"
                  onClick={copyMobilePayMessage}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
                >
                  {copiedText ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Kopieret!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Kopier tekst</span>
                    </>
                  )}
                </button>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 select-all">
                {mobilePayMessage}
              </div>
            </div>

            {/* Add to Transactions Ledger */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSaveToLedger}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-xs"
              >
                {addedSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Tilføjet med individuelle skyldnere!</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Tilføj som postering i CampusCash</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Registered Shared Transactions with Individual Debtor Checklist (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Registrerede Fællesposter</h2>
              <p className="text-xs text-slate-500 mt-0.5">Afkryds hver enkelt person når de overfører via MobilePay</p>
            </div>
            <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
              {sharedTxList.length} udlæg
            </span>
          </div>

          <div className="space-y-4">
            {sharedTxList.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Ingen registrerede fællesudgifter endnu. Opret et nyt udlæg i regnearket eller via Kvik-Split.
              </div>
            ) : (
              sharedTxList.map((tx) => {
                const count = tx.split_between_count || 1;
                const stats = getTransactionSettlementStats(tx);
                const isComplete = stats.isFullySettled;
                const isPartial = stats.isPartiallySettled;

                return (
                  <div
                    key={tx.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isComplete
                        ? 'bg-slate-50/70 border-slate-200 opacity-80'
                        : isPartial
                        ? 'bg-amber-50/20 border-amber-200'
                        : 'bg-white border-slate-200/90 shadow-2xs'
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-slate-900">{tx.title}</h4>
                          <span className="text-xs font-mono text-slate-500">
                            ({formatCurrency(tx.amount)})
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <span>{tx.date}</span>
                          <span>·</span>
                          <span>Delt i {count} dele</span>
                          <span>·</span>
                          <span>Din andel: <strong className="font-mono text-slate-700">{formatCurrency(stats.myShare)}</strong></span>
                        </div>
                      </div>

                      {/* Status Tag */}
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-md shrink-0 ${
                          isComplete
                            ? 'bg-emerald-100 text-emerald-800'
                            : isPartial
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {isComplete
                          ? `Fuldt afregnet (${stats.settledCount}/${stats.debtorCount})`
                          : isPartial
                          ? `Delvist (${stats.settledCount}/${stats.debtorCount} har betalt)`
                          : `Afventer (${stats.debtorCount} skylder)`}
                      </span>
                    </div>

                    {/* Progress Bar of Collected Money */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                        <span>
                          Modtaget: <strong className="font-mono text-emerald-700">{formatCurrency(stats.totalSettled)}</strong>
                        </span>
                        <span>
                          Mangler: <strong className="font-mono text-amber-600">{formatCurrency(stats.totalPending)}</strong>
                        </span>
                      </div>
                      <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-600 h-full transition-all duration-300"
                          style={{
                            width: `${stats.totalOwed > 0 ? (stats.totalSettled / stats.totalOwed) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Skyldner-liste (Debtors Checklist) */}
                    <div className="mt-3.5 pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-500" />
                          <span>Hvem skylder penge på denne regning?</span>
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Afkryds når en skyldner betaler
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {stats.debtors.map((debtor) => {
                          const isCopied = copiedDebtorId === debtor.id;

                          return (
                            <div
                              key={debtor.id}
                              className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-colors ${
                                debtor.settled
                                  ? 'bg-emerald-50/50 border-emerald-200/70 text-slate-600'
                                  : 'bg-slate-50 hover:bg-slate-100/70 border-slate-200 text-slate-900'
                              }`}
                            >
                              {/* Checkbox and Name */}
                              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                <input
                                  type="checkbox"
                                  id={`chk-${tx.id}-${debtor.id}`}
                                  checked={debtor.settled}
                                  onChange={() => onToggleDebtorSettled(tx.id, debtor.id)}
                                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                                />

                                {editingDebtorId === debtor.id ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      value={tempDebtorName}
                                      onChange={(e) => setTempDebtorName(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          handleSaveDebtorName(tx, debtor.id);
                                        }
                                      }}
                                      className="px-1.5 py-0.5 text-xs border rounded bg-white"
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSaveDebtorName(tx, debtor.id)}
                                      className="px-1.5 py-0.5 text-[10px] bg-emerald-600 text-white rounded"
                                    >
                                      Gem
                                    </button>
                                  </div>
                                ) : (
                                  <label
                                    htmlFor={`chk-${tx.id}-${debtor.id}`}
                                    className="cursor-pointer flex items-center gap-1.5 truncate"
                                  >
                                    <span
                                      className={`font-medium truncate ${
                                        debtor.settled ? 'line-through text-slate-400' : 'text-slate-800'
                                      }`}
                                    >
                                      {debtor.name}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setEditingDebtorId(debtor.id);
                                        setTempDebtorName(debtor.name);
                                      }}
                                      className="text-slate-400 hover:text-slate-600 p-0.5"
                                      title="Omdøb person"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                  </label>
                                )}
                              </div>

                              {/* Amount & Status Badge */}
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono font-semibold text-slate-800 text-xs">
                                  {formatCurrency(debtor.amount)}
                                </span>

                                {!debtor.settled && (
                                  <button
                                    type="button"
                                    onClick={() => copyIndividualReminder(debtor.name, debtor.amount, tx.title, debtor.id)}
                                    className="px-2 py-0.5 text-[10px] text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded transition-colors"
                                    title="Kopier MobilePay påmindelse"
                                  >
                                    {isCopied ? 'Kopieret!' : 'Send påmindelse'}
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => onToggleDebtorSettled(tx.id, debtor.id)}
                                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                                    debtor.settled
                                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                      : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                  }`}
                                >
                                  {debtor.settled ? 'Har betalt ✓' : 'Mangler'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Bulk Action Footer */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span>
                        Udestående: <strong className="font-mono text-slate-800">{formatCurrency(stats.totalPending)}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => onSetAllDebtors(tx.id, !isComplete)}
                        className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:underline"
                      >
                        {isComplete ? 'Nulstil alle til udestående' : 'Marker alle som betalt ✓'}
                      </button>
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
