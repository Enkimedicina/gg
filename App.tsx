import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { DebtManager } from './components/DebtManager';
import { BudgetManager } from './components/BudgetManager';
import { ProjectionTable } from './components/ProjectionTable';
import { AIAdvisor } from './components/AIAdvisor';
import { Login } from './components/Login';
import { FinancialState, View, Debt, Income, Expense, NotificationItem, UserProfile } from './types';
import { initFirebase, subscribeToData, saveDataToCloud, FirebaseConfig, isFirebaseConfigured } from './services/firebase';

// Simple ID generator since we can't add external packages easily
const generateId = () => Math.random().toString(36).substr(2, 9);

const INITIAL_STATE: FinancialState = {
  debts: [
    { id: '1', name: 'BBVA', initialAmount: 50000, currentAmount: 45000, minPayment: 2500, color: '#1e40af', dueDay: 15, interestRate: 45 },
    { id: '2', name: 'Plata Card', initialAmount: 15000, currentAmount: 12000, minPayment: 1000, color: '#ec4899', dueDay: 5, interestRate: 65 },
    { id: '3', name: 'Fovissste', initialAmount: 800000, currentAmount: 750000, minPayment: 5000, color: '#f59e0b', dueDay: 28, interestRate: 11 },
  ],
  expenses: [
    { id: '1', name: 'Luz', amount: 500, category: 'Services', frequency: 'Monthly', dueDay: 10 },
    { id: '2', name: 'Internet', amount: 600, category: 'Services', frequency: 'Monthly', dueDay: 5 },
    { id: '3', name: 'Comida Semanal', amount: 1000, category: 'Food', frequency: 'Weekly', dueDay: 1 }, // Lunes
    { id: '4', name: 'Niñera', amount: 1500, category: 'Nanny', frequency: 'Bi-weekly', dueDay: 15 },
  ],
  incomes: [
    { id: '1', source: 'Edna', amount: 18000 },
    { id: '2', source: 'Ronaldo', amount: 20000 },
  ],
  payments: [],
  history: [
    { date: '2023-10', totalDebt: 865000 },
    { date: '2023-11', totalDebt: 855000 },
    { date: '2023-12', totalDebt: 840000 },
    { date: '2024-01', totalDebt: 825000 },
    { date: '2024-02', totalDebt: 807000 },
  ]
};

const App: React.FC = () => {
  // State Initialization
  const [data, setData] = useState<FinancialState>(INITIAL_STATE);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  
  // Auth & Sync States
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile>('Edna');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [syncMessage, setSyncMessage] = useState('');

  // Use a ref to prevent saving data that came from the cloud back to the cloud (loop prevention)
  const isRemoteUpdate = useRef(false);

  // Initialize Data (Local or Cloud)
  useEffect(() => {
    // 1. Load User Preference
    const savedUser = localStorage.getItem('finances_er_user');
    if (savedUser) setCurrentUser(savedUser as UserProfile);

    // 2. Load Local Data First (Instant render)
    try {
      const saved = localStorage.getItem('finances_er_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        setData({ ...INITIAL_STATE, ...parsed });
      }
    } catch (e) { console.error(e); }
    setIsDataLoaded(true);

    // 3. Initialize Firebase if config exists
    const fbConfigStr = localStorage.getItem('finances_er_firebase_config');
    if (fbConfigStr) {
      try {
        const config = JSON.parse(fbConfigStr);
        if (initFirebase(config)) {
            setCloudStatus('connecting');
        }
      } catch (e) {
        console.error("Invalid firebase config", e);
      }
    }
  }, []);

  // --- SYNC ENGINE ---

  // Connect to Cloud Real-time Stream
  useEffect(() => {
    if (cloudStatus === 'connecting' || (cloudStatus === 'connected' && isFirebaseConfigured())) {
        const unsubscribe = subscribeToData(
            (newData) => {
                // We received data from another device
                isRemoteUpdate.current = true; 
                setData(prev => {
                    // Only update if actually different to avoid renders
                    if (JSON.stringify(prev) !== JSON.stringify(newData)) {
                        console.log("Cloud update received", new Date().toISOString());
                        return newData;
                    }
                    return prev;
                });
                setCloudStatus('connected');
                // Also save to local storage as backup
                localStorage.setItem('finances_er_v1', JSON.stringify(newData));
                setTimeout(() => isRemoteUpdate.current = false, 500);
            },
            (err) => {
                setSyncMessage(err);
                setCloudStatus('error');
            }
        );
        return () => unsubscribe && unsubscribe();
    }
  }, [cloudStatus]);

  // Save changes to Cloud (Debounced) & Local
  useEffect(() => {
    if (!isDataLoaded) return;

    // Always save local
    localStorage.setItem('finances_er_v1', JSON.stringify(data));

    // If cloud is connected and this wasn't a remote update, push to cloud
    if (cloudStatus === 'connected' && !isRemoteUpdate.current) {
        const timeoutId = setTimeout(() => {
            saveDataToCloud(data).catch(console.error);
        }, 1000); // Debounce saves by 1s
        return () => clearTimeout(timeoutId);
    }
  }, [data, cloudStatus, isDataLoaded]);

  // --- NOTIFICATIONS SYSTEM ---

  useEffect(() => {
    if (isLoggedIn && 'Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission().then(p => setPushEnabled(p === 'granted'));
    } else if ('Notification' in window && Notification.permission === 'granted') {
      setPushEnabled(true);
    }
  }, [isLoggedIn]);

  const sendSystemNotification = useCallback((title: string, body: string) => {
    if (pushEnabled && 'Notification' in window && document.visibilityState === 'hidden') {
      new Notification(title, { body, icon: 'https://cdn-icons-png.flaticon.com/512/2933/2933116.png' });
    }
  }, [pushEnabled]);

  // Calculate internal notifications based on data and date
  useEffect(() => {
    const calculateNotifications = () => {
      const today = new Date();
      const currentDay = today.getDate(); // 1-31
      const currentDayOfWeek = today.getDay(); // 0-6 (0=Sunday)
      const notes: NotificationItem[] = [];

      // 1. Monthly Check-in (Days 1-5)
      if (currentDay <= 3) {
        notes.push({
          id: 'monthly-checkin',
          type: 'info',
          title: 'Inicio de Mes',
          message: 'Es momento de registrar tus ingresos del mes para actualizar el presupuesto.'
        });
      }

      // 2. Debt Due Dates
      if (data.debts) {
        data.debts.forEach(debt => {
            if (debt.currentAmount > 0 && debt.dueDay) {
            const dueDay = debt.dueDay;
            if (currentDay === dueDay) {
                notes.push({
                id: `debt-due-${debt.id}`,
                type: 'warning',
                title: '¡Vencimiento Hoy!',
                message: `El pago mínimo de ${debt.name} vence hoy. Evita recargos.`
                });
            } else if (dueDay > currentDay && dueDay <= currentDay + 3) {
                const daysLeft = dueDay - currentDay;
                notes.push({
                id: `debt-upcoming-${debt.id}`,
                type: 'info',
                title: 'Pago Próximo',
                message: `El pago de ${debt.name} es en ${daysLeft} días.`
                });
            }
            }
        });
      }

      // 3. Expense Reminders
      if (data.expenses) {
        data.expenses.forEach(exp => {
            let shouldNotify = false;
            let msg = '';

            if (!exp.frequency || exp.frequency === 'Monthly') {
                if (exp.dueDay && currentDay === exp.dueDay) { shouldNotify = true; msg = `Hoy corresponde pagar: ${exp.name}.`; }
            }
            if (exp.frequency === 'Weekly') {
                if (exp.dueDay !== undefined && currentDayOfWeek === exp.dueDay) { shouldNotify = true; msg = `Semanal: Hoy toca el gasto de ${exp.name}.`; }
            }
            if (exp.frequency === 'Bi-weekly') {
                if (exp.dueDay && (currentDay === exp.dueDay || currentDay === exp.dueDay + 15)) { shouldNotify = true; msg = `Quincenal: Hoy corresponde el gasto de ${exp.name}.`; }
            }

            if (shouldNotify) {
                notes.push({
                    id: `exp-${exp.id}-${today.getTime()}`, 
                    type: 'info',
                    title: 'Gasto Fijo',
                    message: msg
                });
            }
        });
      }
      
      setNotifications(notes);
    };

    calculateNotifications();
    const interval = setInterval(calculateNotifications, 60000); 
    return () => clearInterval(interval);

  }, [data]);


  // --- ACTIONS ---

  const handleLogin = (user: UserProfile) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
    localStorage.setItem('finances_er_user', user);
  };

  const handleCloudConfig = (config: FirebaseConfig) => {
      localStorage.setItem('finances_er_firebase_config', JSON.stringify(config));
      if (initFirebase(config)) {
          setCloudStatus('connecting');
      }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
  };

  const handleAddDebt = (debt: Omit<Debt, 'id'>) => {
    const newDebt = { ...debt, id: generateId() };
    setData(prev => ({ ...prev, debts: [...prev.debts, newDebt] }));
    sendSystemNotification('Nueva Deuda', `${currentUser} agregó la deuda "${debt.name}"`);
  };

  const handleUpdateDebt = (updatedDebt: Debt) => {
    setData(prev => ({
      ...prev,
      debts: prev.debts.map(d => d.id === updatedDebt.id ? updatedDebt : d)
    }));
  };

  const handleDeleteDebt = (id: string) => {
    setData(prev => ({ ...prev, debts: prev.debts.filter(d => d.id !== id) }));
  };

  const handleMakePayment = (debtId: string, amount: number) => {
    const date = new Date().toISOString().split('T')[0];
    const debtName = data.debts.find(d => d.id === debtId)?.name || 'Deuda';
    
    setData(prev => {
      const updatedDebts = prev.debts.map(d => {
        if (d.id === debtId) {
          return { ...d, currentAmount: Math.max(0, d.currentAmount - amount) };
        }
        return d;
      });
      const newTotalDebt = updatedDebts.reduce((acc, d) => acc + d.currentAmount, 0);
      const newHistory = [...prev.history];
      const lastHist = newHistory[newHistory.length - 1];
      if (lastHist && lastHist.date === date.substring(0, 7)) {
          lastHist.totalDebt = newTotalDebt; 
      } else {
          newHistory.push({ date: date, totalDebt: newTotalDebt });
      }

      return {
        ...prev,
        debts: updatedDebts,
        payments: [...prev.payments, { id: generateId(), debtId, amount, date, recordedBy: currentUser }],
        history: newHistory
      };
    });

    sendSystemNotification('Pago Registrado', `${currentUser} pagó $${amount} a ${debtName}`);
  };

  // Budget Actions
  const handleAddIncome = (income: Omit<Income, 'id'>) => {
    setData(prev => ({ ...prev, incomes: [...prev.incomes, { ...income, id: generateId() }] }));
  };

  const handleRemoveIncome = (id: string) => {
    setData(prev => ({ ...prev, incomes: prev.incomes.filter(i => i.id !== id) }));
  };

  const handleAddExpense = (expense: Omit<Expense, 'id'>) => {
    setData(prev => ({ ...prev, expenses: [...prev.expenses, { ...expense, id: generateId() }] }));
  };

  const handleRemoveExpense = (id: string) => {
    setData(prev => ({ ...prev, expenses: prev.expenses.filter(e => e.id !== id) }));
  };

  const renderView = () => {
    switch(currentView) {
      case View.DASHBOARD: return <Dashboard data={data} notifications={notifications} />;
      case View.DEBTS: return <DebtManager data={data} onAddDebt={handleAddDebt} onUpdateDebt={handleUpdateDebt} onDeleteDebt={handleDeleteDebt} onMakePayment={handleMakePayment} />;
      case View.PROJECTION: return <ProjectionTable data={data} />;
      case View.BUDGET: return <BudgetManager data={data} onAddIncome={handleAddIncome} onRemoveIncome={handleRemoveIncome} onAddExpense={handleAddExpense} onRemoveExpense={handleRemoveExpense} />;
      case View.ADVISOR: return <AIAdvisor data={data} />;
      default: return <Dashboard data={data} notifications={notifications} />;
    }
  };

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} onSaveCloudConfig={handleCloudConfig} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col relative">
       {/* Background pattern for web feel */}
       <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
      
      <Navbar 
        currentView={currentView} 
        onChangeView={setCurrentView} 
        currentUser={currentUser}
        onUserChange={setCurrentUser}
        pushEnabled={cloudStatus === 'connected'}
        onLogout={handleLogout}
      />

      <div className="flex-grow max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
        {cloudStatus === 'error' && (
             <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 shadow-sm" role="alert">
                <strong className="font-bold">Error de Sincronización: </strong>
                <span className="block sm:inline">{syncMessage}</span>
             </div>
        )}
        <main className="animate-fadeIn">
          {renderView()}
        </main>
      </div>
      
      <footer className="bg-white border-t border-slate-200 mt-auto relative z-10">
        <div className="max-w-[1600px] mx-auto py-6 px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500">
           <p className="font-medium">© 2024 Universo Finanzas E&R. Todos los derechos reservados.</p>
           <div className="flex items-center space-x-4 mt-2 md:mt-0">
               <p>{cloudStatus === 'connected' ? '☁️ Sincronizado en Nube' : '💾 Modo Local'}</p>
               <p>v3.5 Desktop Edition</p>
           </div>
        </div>
      </footer>
    </div>
  );
};

export default App;