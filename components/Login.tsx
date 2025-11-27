import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Lock, ArrowRight, Settings, Save, CheckCircle, HelpCircle, ExternalLink, AlertTriangle } from 'lucide-react';
import { FirebaseConfig } from '../services/firebase';

interface LoginProps {
  onLogin: (user: UserProfile) => void;
  onSaveCloudConfig?: (config: FirebaseConfig) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin, onSaveCloudConfig }) => {
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  
  // Config state
  const [firebaseConfig, setFirebaseConfig] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (pin === '2024') {
      onLogin(selectedUser);
    } else {
      setError('PIN Incorrecto');
      setPin('');
    }
  };

  const handleSaveConfig = () => {
      try {
          // Attempt to clean up the input if user pasted JS code instead of JSON
          let cleanInput = firebaseConfig.trim();
          
          // Remove "const firebaseConfig =" or similar js syntax if present
          if (cleanInput.includes('=')) {
            cleanInput = cleanInput.split('=')[1].trim();
          }
          // Remove trailing semicolon
          if (cleanInput.endsWith(';')) {
            cleanInput = cleanInput.slice(0, -1);
          }

          // Try to parse using loose JSON rules (fixing unquoted keys is hard in pure JS without eval, 
          // so we rely on the user pasting valid JSON or close to it).
          // If they pasted the object from firebase console, keys are usually unquoted in JS.
          // We will try to format it to JSON if JSON.parse fails initially.
          
          let config: any;
          try {
            config = JSON.parse(cleanInput);
          } catch (e) {
            // Very basic attempt to fix unquoted keys: { apiKey: "..." } -> { "apiKey": "..." }
            // This is risky but helps with direct copy-paste from console
            const jsonLike = cleanInput.replace(/(\w+):/g, '"$1":');
            config = JSON.parse(jsonLike);
          }

          if (!config.apiKey || !config.projectId) {
            throw new Error("Faltan campos requeridos (apiKey, projectId)");
          }

          if (onSaveCloudConfig) {
              onSaveCloudConfig(config);
              setShowConfig(false);
              alert("Configuración guardada. La app intentará conectarse.");
          }
      } catch (e) {
          setError("Formato inválido. Asegúrate de copiar solo el objeto { ... } y que sea JSON válido.");
      }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-[#0f172a] to-[#0f172a]"></div>
      <div className="absolute top-20 left-20 w-1 h-1 bg-white rounded-full animate-pulse"></div>
      <div className="absolute bottom-40 right-40 w-2 h-2 bg-pink-400 rounded-full animate-pulse delay-700"></div>
      <div className="absolute top-1/2 left-1/3 w-1 h-1 bg-purple-400 rounded-full animate-pulse delay-300"></div>
      
      {/* Config Modal */}
      {showConfig && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="text-white text-lg font-bold flex items-center">
                        <Settings className="w-5 h-5 mr-2 text-brand-500" />
                        Sincronización en Nube (Firebase)
                    </h3>
                    <button onClick={() => setShowConfig(false)} className="text-slate-500 hover:text-white"><Settings className="w-5 h-5" /></button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="space-y-4 text-sm text-slate-400">
                            <p className="font-bold text-white flex items-center">
                                <HelpCircle className="w-4 h-4 mr-2 text-blue-400" />
                                ¿Cómo obtener esto?
                            </p>
                            <ol className="list-decimal list-inside space-y-2 marker:text-brand-500">
                                <li>Ve a <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline inline-flex items-center">console.firebase.google.com <ExternalLink className="w-3 h-3 ml-1"/></a></li>
                                <li>Crea un proyecto nuevo (Gratis).</li>
                                <li>Agrega una app Web (ícono <code className="bg-slate-800 px-1 rounded">&lt;/&gt;</code>).</li>
                                <li>Copia el objeto <code className="text-orange-300">firebaseConfig</code>.</li>
                            </ol>
                            
                            <div className="bg-orange-900/20 border border-orange-900/50 p-3 rounded text-orange-200 text-xs flex items-start mt-2">
                                <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                                <span>Importante: En Firebase, ve a <strong>Firestore Database</strong> y crea una base de datos en <strong>Modo de Prueba</strong>.</span>
                            </div>
                        </div>

                        <div>
                             <label className="block text-slate-300 text-xs font-bold mb-2">Pega tu configuración aquí:</label>
                             <textarea 
                                className="w-full h-48 bg-slate-950 border border-slate-800 rounded p-3 text-xs text-green-400 font-mono focus:outline-none focus:border-brand-500 resize-none"
                                placeholder={`{
  "apiKey": "AIzaSy...",
  "authDomain": "tu-proyecto.firebaseapp.com",
  "projectId": "tu-proyecto",
  "storageBucket": "tu-proyecto.appspot.com",
  "messagingSenderId": "...",
  "appId": "..."
}`}
                                value={firebaseConfig}
                                onChange={(e) => setFirebaseConfig(e.target.value)}
                            />
                            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
                        </div>
                    </div>
                  </div>

                  <div className="p-6 border-t border-slate-800 flex justify-end space-x-3 bg-slate-900 rounded-b-xl">
                      <button onClick={() => setShowConfig(false)} className="text-slate-400 hover:text-white text-sm px-4 py-2">Cancelar</button>
                      <button onClick={handleSaveConfig} className="bg-brand-600 text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-brand-700 transition-colors shadow-lg shadow-brand-900/20">
                          <Save className="w-4 h-4 mr-2" /> Guardar y Conectar
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="relative z-10 w-full max-w-md">
        <button 
            onClick={() => setShowConfig(true)}
            className="absolute top-0 right-0 p-2 text-slate-600 hover:text-slate-300 transition-colors"
            title="Configurar Sincronización"
        >
            <Settings className="w-5 h-5" />
        </button>

        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-900 border border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.3)] mb-6 group relative">
             <div className="absolute inset-0 rounded-full border border-white/10 animate-[spin_10s_linear_infinite]"></div>
             <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-pink-500 drop-shadow-[0_0_10px_rgba(236,72,153,0.8)]">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
             </svg>
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight mb-2">Universo Financiero</h1>
          <p className="text-slate-400 text-sm tracking-widest uppercase">Edna & Ronaldo</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          {!selectedUser ? (
            <div className="space-y-4">
              <h2 className="text-xl font-medium text-white text-center mb-6">¿Quién eres?</h2>
              <button 
                onClick={() => setSelectedUser('Edna')}
                className="w-full p-4 rounded-xl bg-gradient-to-r from-pink-900/50 to-purple-900/50 border border-pink-500/20 hover:border-pink-500/50 transition-all group flex items-center justify-between"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-pink-500 flex items-center justify-center text-white font-bold text-lg shadow-lg mr-4">E</div>
                  <span className="text-white font-medium text-lg">Edna</span>
                </div>
                <ArrowRight className="w-5 h-5 text-pink-400 opacity-0 group-hover:opacity-100 transform -translate-x-2 group-hover:translate-x-0 transition-all" />
              </button>

              <button 
                onClick={() => setSelectedUser('Ronaldo')}
                className="w-full p-4 rounded-xl bg-gradient-to-r from-blue-900/50 to-indigo-900/50 border border-blue-500/20 hover:border-blue-500/50 transition-all group flex items-center justify-between"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-lg shadow-lg mr-4">R</div>
                  <span className="text-white font-medium text-lg">Ronaldo</span>
                </div>
                <ArrowRight className="w-5 h-5 text-blue-400 opacity-0 group-hover:opacity-100 transform -translate-x-2 group-hover:translate-x-0 transition-all" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-6 animate-fadeIn">
              <div className="text-center">
                <button 
                   type="button" 
                   onClick={() => { setSelectedUser(null); setError(''); setPin(''); }}
                   className="text-slate-400 text-xs hover:text-white mb-4 flex items-center justify-center"
                >
                  ← Cambiar usuario
                </button>
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 mx-auto flex items-center justify-center text-2xl font-bold text-white mb-3">
                  {selectedUser[0]}
                </div>
                <h3 className="text-white font-medium">Hola, {selectedUser}</h3>
              </div>

              <div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="password"
                    inputMode="numeric"
                    className="block w-full pl-10 pr-3 py-3 border border-slate-700 rounded-lg leading-5 bg-slate-800 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all"
                    placeholder="Ingresa tu PIN (2024)"
                    value={pin}
                    onChange={(e) => { setPin(e.target.value); setError(''); }}
                    autoFocus
                  />
                </div>
                {error && <p className="mt-2 text-sm text-red-400 text-center">{error}</p>}
              </div>

              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform hover:scale-[1.02]"
              >
                Entrar al Sistema
              </button>
            </form>
          )}
        </div>
        <p className="text-center text-slate-600 text-xs mt-6">PIN por defecto: 2024</p>
      </div>
    </div>
  );
};
