import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine, ComposedChart, Line } from 'recharts';
import { FinancialState, NotificationItem, Debt } from '../types';
import { TrendingDown, TrendingUp, DollarSign, Wallet, Target, ArrowRight, Lightbulb, Zap, Trophy, Calendar, PiggyBank } from 'lucide-react';
import { NotificationsList } from './Notifications';

interface DashboardProps {
  data: FinancialState;
  notifications: NotificationItem[];
}

type StrategyType = 'snowball' | 'avalanche';

export const Dashboard: React.FC<DashboardProps> = ({ data, notifications }) => {
  const [strategy, setStrategy] = useState<StrategyType | null>(null);

  const totalDebt = data.debts.reduce((acc, d) => acc + d.currentAmount, 0);
  const initialTotalDebt = data.debts.reduce((acc, d) => acc + d.initialAmount, 0);
  const totalPaidOff = initialTotalDebt - totalDebt;

  const totalIncome = data.incomes.reduce((acc, i) => acc + i.amount, 0);
  const totalExpenses = data.expenses.reduce((acc, e) => acc + e.amount, 0);
  const totalMinPayments = data.debts.reduce((acc, d) => acc + d.minPayment, 0);
  
  const availableMoney = totalIncome - totalExpenses - totalMinPayments;
  const paymentCapacity = availableMoney + totalMinPayments; // Total money available to attack debt
  
  // Format currency
  const fmt = (num: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(num);

  const debtBreakdown = data.debts.map(d => ({
    name: d.name,
    amount: d.currentAmount,
    color: d.color
  }));

  // Analyze Debts for Recommendation
  const analysis = useMemo(() => {
    const activeDebts = data.debts.filter(d => d.currentAmount > 0);
    if (activeDebts.length === 0) return null;

    const maxInterestDebt = [...activeDebts].sort((a, b) => (b.interestRate || 0) - (a.interestRate || 0))[0];
    const minBalanceDebt = [...activeDebts].sort((a, b) => a.currentAmount - b.currentAmount)[0];

    let recommended: StrategyType = 'avalanche';
    let reason = '';

    const maxInterest = maxInterestDebt.interestRate || 0;
    
    if (maxInterest > 40) {
      recommended = 'avalanche';
      reason = `Tu deuda "${maxInterestDebt.name}" tiene un interés muy alto (${maxInterest}%). Atacarla primero te ahorrará mucho dinero.`;
    } else if (minBalanceDebt.currentAmount < 5000) {
      recommended = 'snowball';
      reason = `Tienes una deuda pequeña "${minBalanceDebt.name}" ($${minBalanceDebt.currentAmount}). Eliminarla rápido te dará motivación inmediata.`;
    } else {
      recommended = 'avalanche';
      reason = "Matemáticamente, pagar la deuda con mayor interés siempre ahorra más dinero a largo plazo.";
    }

    return { recommended, reason, maxInterestDebt, minBalanceDebt };
  }, [data.debts]);

  const currentStrategy = strategy || analysis?.recommended || 'avalanche';

  // --- PROJECTION ENGINE ---
  const projection = useMemo(() => {
    if (totalDebt === 0) return null;
    
    // Deep clone debts to simulate
    let simDebts = data.debts.map(d => ({...d}));
    let month = 0;
    let currentTotalDebt = totalDebt;
    let accumulatedWealth = 0; // The "Green" part
    const projectionData = [];
    const maxMonths = 60; // Limit projection to 5 years
    
    // Add current state
    projectionData.push({
        month: 'Hoy',
        deuda: currentTotalDebt,
        riqueza: 0,
        index: 0
    });

    while ((currentTotalDebt > 0 || month < 12) && month < maxMonths) { // Continue a bit after debt is 0 to show wealth
      month++;
      let monthlyBudget = paymentCapacity; // The total firepower (Min payments + Extra)

      // 1. Apply Interest
      simDebts.forEach(d => {
        if (d.currentAmount > 0 && d.interestRate) {
           const monthlyRate = (d.interestRate / 100) / 12;
           d.currentAmount += d.currentAmount * monthlyRate;
        }
      });

      // 2. Pay Minimums first
      simDebts.forEach(d => {
        if (d.currentAmount > 0) {
           const payment = Math.min(d.currentAmount, d.minPayment);
           d.currentAmount -= payment;
           monthlyBudget -= payment;
        }
      });

      // 3. Pay Extra with remaining budget (Strategy)
      if (monthlyBudget > 0) {
          // Sort based on strategy
          const activeDebts = simDebts.filter(d => d.currentAmount > 0);
          
          if (activeDebts.length > 0) {
            let targetDebt;
            if (currentStrategy === 'snowball') {
                 targetDebt = activeDebts.sort((a, b) => a.currentAmount - b.currentAmount)[0];
            } else {
                 targetDebt = activeDebts.sort((a, b) => (b.interestRate || 0) - (a.interestRate || 0))[0];
            }

            // Apply all remaining budget to target
            const extraPayment = Math.min(targetDebt.currentAmount, monthlyBudget);
            targetDebt.currentAmount -= extraPayment;
            monthlyBudget -= extraPayment;
          } else {
            // No debts left! This money goes to Wealth/Savings
            accumulatedWealth += monthlyBudget;
          }
      }

      currentTotalDebt = simDebts.reduce((acc, d) => acc + d.currentAmount, 0);
      
      // If we still have budget left (debts finished mid-calculation), add to wealth
      if (currentTotalDebt === 0 && monthlyBudget > 0) {
          accumulatedWealth += monthlyBudget;
      }

      projectionData.push({
          month: `Mes ${month}`,
          deuda: Math.max(0, Math.round(currentTotalDebt)),
          riqueza: Math.round(accumulatedWealth),
          index: month
      });
    }

    const debtFreeMonth = projectionData.find(p => p.deuda === 0)?.index || maxMonths;
    const debtFreeDate = new Date();
    debtFreeDate.setMonth(debtFreeDate.getMonth() + debtFreeMonth);

    return { 
        data: projectionData, 
        debtFreeInMonths: debtFreeMonth,
        debtFreeDate: debtFreeDate 
    };
  }, [data.debts, paymentCapacity, currentStrategy, totalDebt]);


  const getPriorityDebt = (): Debt | null => {
    const activeDebts = data.debts.filter(d => d.currentAmount > 0);
    if (activeDebts.length === 0) return null;

    if (currentStrategy === 'snowball') {
      return [...activeDebts].sort((a, b) => a.currentAmount - b.currentAmount)[0];
    } else {
      return [...activeDebts].sort((a, b) => (b.interestRate || 0) - (a.interestRate || 0))[0];
    }
  };

  const priorityDebt = getPriorityDebt();

  // Prepare History Data for "Paid vs Owed"
  const historyDataWithPaid = data.history.map(h => ({
    ...h,
    paid: Math.max(0, initialTotalDebt - h.totalDebt) // Calculate how much was paid off based on initial
  }));
  // Add current state to history chart
  const currentHistoryPoint = {
      date: 'Hoy',
      totalDebt: totalDebt,
      paid: totalPaidOff
  };
  const finalHistoryData = [...historyDataWithPaid, currentHistoryPoint];

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Notifications Section */}
      <NotificationsList items={notifications} />

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Debt Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-16 -mt-16 opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
          <div>
            <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Deuda Pendiente</p>
            <h2 className="text-4xl font-bold text-slate-800 mt-2 tracking-tight">{fmt(totalDebt)}</h2>
          </div>
          <div className="mt-4 flex items-center text-danger-600 text-sm font-medium z-10">
            <TrendingDown className="w-4 h-4 mr-1" />
            <span>Falta pagar {initialTotalDebt > 0 ? ((totalDebt / initialTotalDebt) * 100).toFixed(1) : 0}%</span>
          </div>
          <div className="w-full bg-slate-100 h-2 mt-4 rounded-full overflow-hidden">
             <div className="bg-danger-500 h-full transition-all duration-1000" style={{width: `${initialTotalDebt > 0 ? (totalDebt / initialTotalDebt) * 100 : 0}%`}}></div>
          </div>
        </div>

        {/* Progress Card (Green) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full -mr-16 -mt-16 opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
          <div>
            <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Total Pagado</p>
            <h2 className="text-4xl font-bold text-slate-800 mt-2 tracking-tight">{fmt(totalPaidOff)}</h2>
          </div>
          <div className="mt-4 flex items-center text-brand-600 text-sm font-medium z-10">
            <Trophy className="w-4 h-4 mr-1" />
            <span>Progreso: {initialTotalDebt > 0 ? ((totalPaidOff / initialTotalDebt) * 100).toFixed(1) : 0}%</span>
          </div>
           <div className="w-full bg-slate-100 h-2 mt-4 rounded-full overflow-hidden">
             <div className="bg-brand-500 h-full transition-all duration-1000" style={{width: `${initialTotalDebt > 0 ? (totalPaidOff / initialTotalDebt) * 100 : 0}%`}}></div>
          </div>
        </div>

        {/* Income Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-all">
          <div>
            <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Ingresos Mes</p>
            <h2 className="text-4xl font-bold text-slate-800 mt-2 tracking-tight">{fmt(totalIncome)}</h2>
          </div>
          <div className="mt-4 flex items-center text-slate-400 text-sm">
            <Wallet className="w-4 h-4 mr-1" />
            <span>Capacidad Total de la Pareja</span>
          </div>
        </div>

        {/* Available Money Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-all">
          <div>
            <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Flujo Libre</p>
            <h2 className={`text-4xl font-bold mt-2 tracking-tight ${availableMoney >= 0 ? 'text-brand-600' : 'text-danger-600'}`}>
              {fmt(availableMoney)}
            </h2>
          </div>
          <div className="mt-4 flex items-center text-slate-500 text-sm">
            <DollarSign className="w-4 h-4 mr-1" />
            <span>Disponible para deuda extra</span>
          </div>
        </div>
      </div>

      {/* PROJECTION CHART (The "Green Light") */}
      {projection && totalDebt > 0 && (
        <div className="bg-slate-900 rounded-2xl p-8 shadow-xl text-white relative overflow-hidden border border-slate-800">
           {/* Decorative Elements */}
           <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-500 rounded-full blur-[150px] opacity-10 pointer-events-none"></div>
           <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500 rounded-full blur-[150px] opacity-10 pointer-events-none"></div>

           <div className="relative z-10 grid lg:grid-cols-3 gap-10">
              <div className="lg:col-span-1 space-y-8 flex flex-col justify-center">
                 <div>
                    <h3 className="text-3xl font-bold flex items-center tracking-tight">
                        <Calendar className="w-8 h-8 mr-3 text-brand-400" />
                        Tu Libertad Financiera
                    </h3>
                    <p className="text-slate-400 mt-3 text-lg leading-relaxed">
                        Con su ritmo actual de <span className="text-white font-bold">{fmt(paymentCapacity)}</span> al mes, el futuro luce prometedor.
                    </p>
                 </div>

                 <div className="bg-white/5 rounded-2xl p-6 border border-white/10 backdrop-blur-md">
                    <p className="text-sm text-slate-400 uppercase tracking-widest font-bold">Estarás libre de deudas en</p>
                    <div className="flex items-baseline mt-2">
                        <span className="text-6xl font-bold text-white tracking-tighter">{projection.debtFreeInMonths}</span>
                        <span className="text-2xl ml-3 text-slate-400 font-light">meses</span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-brand-400 font-bold flex items-center text-lg">
                            <Target className="w-5 h-5 mr-2" />
                            {projection.debtFreeDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                 </div>

                 <div className="p-5 rounded-xl bg-gradient-to-r from-slate-800 to-slate-800/50 border border-slate-700/50">
                    <div className="flex items-start">
                        <PiggyBank className="w-6 h-6 text-green-400 mt-1 mr-4 flex-shrink-0" />
                        <div>
                            <p className="font-bold text-green-400 text-base">Visión a Futuro</p>
                            <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                                El área <span className="text-green-500 font-bold">verde</span> representa su riqueza acumulada una vez que eliminen la deuda (área roja).
                            </p>
                        </div>
                    </div>
                 </div>
              </div>

              <div className="lg:col-span-2 h-[450px]">
                 <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={projection.data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorDeudaProj" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorRiquezaProj" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis dataKey="month" stroke="#94a3b8" tick={{fontSize: 12}} minTickGap={30} />
                        <YAxis stroke="#94a3b8" tickFormatter={(val) => `$${val/1000}k`} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                            formatter={(value: number, name: string) => [fmt(value), name === 'deuda' ? 'Deuda Restante' : 'Riqueza Acumulada']}
                            labelStyle={{ color: '#cbd5e1', fontWeight: 'bold' }}
                        />
                        <Area type="monotone" dataKey="deuda" stroke="#ef4444" fill="url(#colorDeudaProj)" strokeWidth={3} name="deuda" animationDuration={2000} />
                        <Area type="monotone" dataKey="riqueza" stroke="#22c55e" fill="url(#colorRiquezaProj)" strokeWidth={3} name="riqueza" animationDuration={2000} />
                        <ReferenceLine y={0} stroke="#475569" />
                    </ComposedChart>
                 </ResponsiveContainer>
              </div>
           </div>
        </div>
      )}

      {/* Strategy Section */}
      {priorityDebt && availableMoney > 0 && analysis && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 bg-slate-50 border-b border-slate-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="font-bold text-xl text-slate-800 flex items-center">
                        <Zap className="w-6 h-6 text-yellow-500 mr-2" />
                        Estrategia Recomendada
                    </h3>
                    <p className="text-slate-500 text-sm mt-1">
                        Basado en sus tasas de interés y saldos actuales.
                    </p>
                </div>
                
                {/* Strategy Toggles */}
                <div className="flex bg-slate-200 rounded-lg p-1 self-start">
                    <button 
                        onClick={() => setStrategy('avalanche')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            currentStrategy === 'avalanche' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Avalancha (Interés Alto)
                    </button>
                    <button 
                        onClick={() => setStrategy('snowball')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            currentStrategy === 'snowball' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Bola de Nieve (Saldo Bajo)
                    </button>
                </div>
            </div>
          </div>

          <div className="p-8">
                <div className="flex flex-col md:flex-row items-center md:space-x-8 space-y-6 md:space-y-0">
                  <div className="flex-shrink-0">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center bg-brand-100 text-brand-600 shadow-inner border border-brand-200 animate-pulse ring-4 ring-brand-50">
                       <span className="text-3xl font-bold">1</span>
                    </div>
                  </div>
                  <div className="flex-grow text-center md:text-left">
                    <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-2">Objetivo Principal</p>
                    <div className="flex items-center justify-center md:justify-start space-x-4 mb-2">
                      <span className="text-3xl font-bold text-slate-900">{priorityDebt.name}</span>
                      <div className="w-4 h-4 rounded-full shadow-sm ring-2 ring-white" style={{backgroundColor: priorityDebt.color}}></div>
                    </div>
                    <p className="text-slate-600 leading-relaxed max-w-2xl">
                       {analysis.reason}
                    </p>
                  </div>
                  <div className="flex-shrink-0 bg-slate-50 border border-slate-200 px-8 py-6 rounded-2xl text-center min-w-[200px]">
                     <p className="text-xs text-slate-400 uppercase font-bold mb-2">Pago Mensual Sugerido</p>
                     <p className="text-3xl font-bold text-brand-600 tracking-tight">{fmt(priorityDebt.minPayment + availableMoney)}</p>
                     <p className="text-xs text-slate-400 mt-1">(Mínimo + Extras)</p>
                  </div>
                </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* History Chart - Now with Green/Red */}
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-bold text-slate-800">Historial: Pagado vs Pendiente</h3>
              <div className="flex space-x-4 text-sm font-medium">
                  <span className="flex items-center text-brand-600"><div className="w-3 h-3 bg-brand-500 rounded-full mr-2"></div> Pagado</span>
                  <span className="flex items-center text-danger-500"><div className="w-3 h-3 bg-danger-500 rounded-full mr-2"></div> Deuda</span>
              </div>
          </div>
          <div className="h-80 lg:h-96">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={finalHistoryData}>
                <defs>
                  <linearGradient id="colorDebtHist" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPaidHist" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} dy={10} />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip 
                  formatter={(value: number, name: string) => [fmt(value), name === 'totalDebt' ? 'Deuda Restante' : 'Acumulado Pagado']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '5 5'}}
                />
                <Area type="monotone" dataKey="paid" stackId="1" stroke="#22c55e" fillOpacity={1} fill="url(#colorPaidHist)" strokeWidth={3} name="paid" activeDot={{r: 6}} />
                <Area type="monotone" dataKey="totalDebt" stackId="1" stroke="#ef4444" fillOpacity={1} fill="url(#colorDebtHist)" strokeWidth={3} name="totalDebt" activeDot={{r: 6}} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribution Chart */}
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-xl font-bold text-slate-800 mb-8">Composición de Deuda</h3>
          <div className="h-80 lg:h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={debtBreakdown} layout="vertical" margin={{ left: 40, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 14, fill: '#334155', fontWeight: 500}} axisLine={false} tickLine={false} />
                <Tooltip 
                   formatter={(value: number) => [fmt(value), 'Saldo']}
                   cursor={{fill: '#f8fafc'}}
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="amount" radius={[0, 6, 6, 0]} barSize={40}>
                  {debtBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};