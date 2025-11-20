import React, { useState, useEffect, useMemo } from 'react';
import { 
  initializeApp 
} from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc, 
  increment, 
  arrayUnion
} from 'firebase/firestore';
import { 
  Coffee, 
  Star, 
  QrCode, 
  History, 
  Gift, 
  Sparkles,
  Scan,
  Store,
  User,
  CheckCircle,
  Scissors,
  Utensils,
  Car,
  Settings
} from 'lucide-react';

// --- Firebase Configuration ---
// Configuración local de emergencia (REEMPLAZAR EN PRODUCCIÓN)
const localFirebaseConfig = {
  apiKey: "TU_API_KEY_AQUI", 
  authDomain: "tu-proyecto.firebaseapp.com", 
  projectId: "tu-proyecto", 
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : localFirebaseConfig;

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// FIX 1: Crear un ID de aplicación seguro para Firestore reemplazando '/' con '-'.
// Esto resuelve el error "Invalid document reference" al garantizar un conteo de segmentos par.
const safeAppId = rawAppId.replace(/\//g, '-');


// ** FIX: Inicialización Estática de Firebase fuera del Componente **
// Esto previene errores de ciclo de vida/módulo que causan 'reading default'
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);


// --- CONFIGURACIÓN DE TEMAS (NICHOS) ---
const THEMES = {
  cafe: {
    id: 'cafe',
    name: 'Cafetería',
    appName: 'Coffee Star',
    currency: 'Estrellas',
    colors: {
      primary: 'bg-emerald-600',
      primaryHover: 'hover:bg-emerald-700',
      text: 'text-emerald-600',
      textDark: 'text-emerald-800',
      bgLight: 'bg-emerald-50',
      border: 'border-emerald-100',
      badge: 'bg-emerald-100 text-emerald-700'
    },
    icon: <Coffee />,
    rewards: [
      { id: 1, name: 'Extra Shot', cost: 25, desc: 'Potenciador' },
      { id: 2, name: 'Panqué', cost: 50, desc: 'Repostería' },
      { id: 3, name: 'Bebida Gratis', cost: 100, desc: 'Cualquier tamaño' },
    ]
  },
  barber: {
    id: 'barber',
    name: 'Barbería',
    appName: 'Gentleman Cut',
    currency: 'Sellos',
    colors: {
      primary: 'bg-slate-900',
      primaryHover: 'hover:bg-slate-800',
      text: 'text-slate-900',
      textDark: 'text-slate-950',
      bgLight: 'bg-slate-100',
      border: 'border-slate-200',
      badge: 'bg-slate-200 text-slate-800'
    },
    icon: <Scissors />,
    rewards: [
      { id: 1, name: 'Cera Gratis', cost: 30, desc: 'Peinado' },
      { id: 2, name: 'Descuento 50%', cost: 60, desc: 'En corte' },
      { id: 3, name: 'Corte Gratis', cost: 100, desc: 'Servicio completo' },
    ]
  },
  restaurant: {
    id: 'restaurant',
    name: 'Restaurante',
    appName: 'Tasty Bites',
    currency: 'Puntos',
    colors: {
      primary: 'bg-orange-500',
      primaryHover: 'hover:bg-orange-600',
      text: 'text-orange-500',
      textDark: 'text-orange-800',
      bgLight: 'bg-orange-50',
      border: 'border-orange-100',
      badge: 'bg-orange-100 text-orange-700'
    },
    icon: <Utensils />,
    rewards: [
      { id: 1, name: 'Bebida Gratis', cost: 40, desc: 'Refresco/Agua' },
      { id: 2, name: 'Postre', cost: 80, desc: 'Cualquiera del menú' },
      { id: 3, name: 'Plato Fuerte', cost: 200, desc: 'Hasta $150' },
    ]
  },
  carwash: {
    id: 'carwash',
    name: 'Autolavado',
    appName: 'Speedy Wash',
    currency: 'Gotas',
    colors: {
      primary: 'bg-blue-600',
      primaryHover: 'hover:bg-blue-700',
      text: 'text-blue-600',
      textDark: 'text-blue-800',
      bgLight: 'bg-blue-50',
      border: 'border-blue-100',
      badge: 'bg-blue-100 text-blue-700'
    },
    icon: <Car />,
    rewards: [
      { id: 1, name: 'Cera Líquida', cost: 50, desc: 'Aplicación' },
      { id: 2, name: 'Aromatizante', cost: 80, desc: 'Pino/Vainilla' },
      { id: 3, name: 'Lavado Gratis', cost: 150, desc: 'Paquete Básico' },
    ]
  }
};

// --- Componente Principal ---
export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Estado global de la App
  const [activeTab, setActiveTab] = useState('home');
  const [isBaristaMode, setIsBaristaMode] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(THEMES.cafe); 
  const [showThemeSelector, setShowThemeSelector] = useState(false); 

  // 1. Autenticación
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Usa el token de Canvas si está disponible, sino, inicia sesión anónima
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();

    // ** FIX: Se removió 'auth' de la dependencia ya que es una constante externa.
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });
    return () => unsubscribe();
  }, []); 

  // 2. Datos del Usuario
  useEffect(() => {
    if (!user) return;
    
    // Ruta de Firestore: /artifacts/{safeAppId}/users/{userId}/loyalty_data/profile
    // Usamos safeAppId para garantizar un conteo de segmentos par.
    const userRef = doc(db, 'artifacts', safeAppId, 'users', user.uid, 'loyalty_data', 'profile');
    
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserData(docSnap.data());
      } else {
        // Crear perfil default si no existe
        const shortId = Math.floor(100000 + Math.random() * 900000).toString();
        setDoc(userRef, {
          name: 'Cliente Nuevo',
          points: 50,
          level: 'Bronce',
          memberId: shortId, 
          joinedDate: new Date().toISOString(),
          transactions: [{ id: 1, title: 'Regalo de Bienvenida', points: 50, type: 'earn', date: new Date().toISOString() }]
        });
      }
      setLoading(false);
    }, (error) => {
        console.error("Error fetching user data:", error);
        setLoading(false);
    });
    // ** FIX: Se removió 'db' de la dependencia ya que es una constante externa.
    return () => unsubscribe();
  }, [user]); 

  const handleRedeem = async (cost, rewardName) => {
    if (!userData || userData.points < cost || !user) return;
    // Usamos safeAppId para garantizar un conteo de segmentos par.
    const userRef = doc(db, 'artifacts', safeAppId, 'users', user.uid, 'loyalty_data', 'profile');
    try {
      await updateDoc(userRef, {
        points: increment(-cost),
        transactions: arrayUnion({
          id: Date.now(), title: `Canje: ${rewardName}`, points: -cost, type: 'spend', date: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error("Error redeeming reward:", error);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-900 text-white">Cargando LoyalTap...</div>;

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-800 font-sans overflow-hidden max-w-md mx-auto shadow-2xl relative">
      
      {/* Top Bar Admin / Config */}
      <div className="bg-gray-900 text-gray-400 p-2 px-4 flex justify-between items-center text-[10px] uppercase tracking-widest z-50">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">LoyalTap v1.0</span>
          <button onClick={() => setShowThemeSelector(!showThemeSelector)} className="bg-gray-800 p-1 rounded hover:text-white">
             <Settings size={12} />
          </button>
        </div>
        <button onClick={() => setIsBaristaMode(!isBaristaMode)} className="hover:text-white transition-colors flex gap-1 items-center">
          {isBaristaMode ? <><User size={12}/> Ver App Cliente</> : <><Store size={12}/> Ir a Caja</>}
        </button>
      </div>

      {/* Selector de Temas (Solo visible si se activa) */}
      {showThemeSelector && (
        <div className="absolute top-10 left-0 right-0 bg-gray-800 text-white p-4 z-50 shadow-xl border-b border-gray-700 animate-in slide-in-from-top">
          <p className="text-xs text-gray-400 mb-3 font-bold">SELECCIONA NICHO (DEMO MODE)</p>
          <div className="grid grid-cols-4 gap-2">
            {Object.values(THEMES).map(t => (
              <button 
                key={t.id} 
                onClick={() => { setCurrentTheme(t); setShowThemeSelector(false); }}
                className={`flex flex-col items-center p-2 rounded-lg border transition-all ${currentTheme.id === t.id ? 'bg-gray-700 border-white' : 'border-transparent hover:bg-gray-700'}`}
              >
                <div className={`${t.colors.text} mb-1`}>{t.icon}</div>
                <span className="text-[9px]">{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {isBaristaMode ? (
        <BaristaDashboard 
          user={user} 
          theme={currentTheme}
          onExit={() => setIsBaristaMode(false)}
          db={db}
          appId={safeAppId} // Pasamos safeAppId al dashboard
        />
      ) : (
        <ClientApp 
          userData={userData} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
          onRedeem={handleRedeem}
          theme={currentTheme}
        />
      )}
    </div>
  );
}

// --- VISTAS DEL CLIENTE ---

function ClientApp({ userData, activeTab, setActiveTab, onRedeem, theme }) {
  return (
    <>
      <header className="bg-white p-4 shadow-sm z-10 flex justify-between items-center">
        <div className={`flex items-center gap-2 font-bold text-xl ${theme.colors.text}`}>
          {theme.icon}
          <span>{theme.appName}</span>
        </div>
        <div className={`text-xs px-2 py-1 rounded-full font-bold ${theme.colors.badge}`}>
           {userData?.level || 'Bronce'}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20 scrollbar-hide">
        {activeTab === 'home' && <HomeView userData={userData} theme={theme} />}
        {activeTab === 'card' && <CardView userData={userData} theme={theme} />}
        {activeTab === 'rewards' && <RewardsView userData={userData} onRedeem={onRedeem} theme={theme} />}
        {activeTab === 'history' && <HistoryView transactions={userData?.transactions} theme={theme} />}
      </main>

      <nav className="bg-white border-t border-gray-200 absolute bottom-0 w-full h-16 flex justify-around items-center z-20 pb-safe">
        <NavButton icon={<Star />} label="Inicio" isActive={activeTab === 'home'} onClick={() => setActiveTab('home')} theme={theme} />
        <NavButton icon={<QrCode />} label="Tarjeta" isActive={activeTab === 'card'} onClick={() => setActiveTab('card')} theme={theme} />
        <NavButton icon={<Gift />} label="Premios" isActive={activeTab === 'rewards'} onClick={() => setActiveTab('rewards')} theme={theme} />
        <NavButton icon={<History />} label="Historial" isActive={activeTab === 'history'} onClick={() => setActiveTab('history')} theme={theme} />
      </nav>
    </>
  );
}

function HomeView({ userData, theme }) {
  const points = userData?.points || 0;
  const nextReward = 150;
  const progress = Math.min((points / nextReward) * 100, 100);

  return (
    <div className="p-6 space-y-6">
      <div className="text-center space-y-1">
        <h2 className={`text-2xl font-light ${theme.colors.textDark}`}>Hola, {userData?.name?.split(' ')[0]}</h2>
        <p className={`text-sm ${theme.colors.text} opacity-80`}>¡Gracias por tu visita!</p>
      </div>

      <div className="relative w-64 h-64 mx-auto">
        {/* Progress Circle */}
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="128" cy="128" r="110" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-gray-200" />
          <circle 
            cx="128" cy="128" r="110" 
            stroke="currentColor" strokeWidth="12" fill="transparent" 
            strokeDasharray={691} strokeDashoffset={691 - (691 * progress) / 100} 
            className={`${theme.colors.text} transition-all duration-1000 ease-out`} 
            strokeLinecap="round" 
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-6xl font-bold ${theme.colors.textDark}`}>{points}</span>
          <span className={`text-sm font-medium uppercase tracking-wider mt-1 ${theme.colors.text}`}>{theme.currency}</span>
        </div>
      </div>

      <div className={`${theme.colors.bgLight} p-4 rounded-xl flex gap-3 items-start border ${theme.colors.border}`}>
         <Sparkles className={theme.colors.text} size={20} />
         <p className={`text-sm ${theme.colors.textDark}`}>
           Usa tu tarjeta digital en cada visita para subir de nivel y desbloquear mejores recompensas.
         </p>
      </div>
    </div>
  );
}

function RewardsView({ userData, onRedeem, theme }) {
  return (
    <div className="p-4 pb-24">
      <div className="mb-6 sticky top-0 bg-gray-50/95 backdrop-blur-sm py-2 z-10">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Recompensas</h2>
        <p className="text-sm text-gray-500">Saldo disponible: <span className={`font-bold ${theme.colors.text}`}>{userData?.points || 0} {theme.currency}</span></p>
      </div>
      <div className="space-y-3">
        {theme.rewards.map((reward) => {
          const canAfford = (userData?.points || 0) >= reward.cost;
          return (
            <div key={reward.id} className={`bg-white p-4 rounded-xl border flex justify-between items-center ${!canAfford && 'opacity-60 grayscale'}`}>
              <div>
                <h3 className="font-bold text-gray-800">{reward.name}</h3>
                <p className="text-xs text-gray-500">{reward.desc}</p>
              </div>
              <button 
                disabled={!canAfford}
                onClick={() => onRedeem(reward.cost, reward.name)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${canAfford ? `${theme.colors.primary} text-white ${theme.colors.primaryHover}` : 'bg-gray-200 text-gray-400'}`}
              >
                {reward.cost}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CardView({ userData, theme }) {
  return (
    <div className={`p-6 flex flex-col items-center justify-center h-full space-y-8 ${theme.colors.bgLight}`}>
      <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm aspect-[3/4] flex flex-col relative overflow-hidden border border-gray-100">
        <div className={`absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-10 blur-3xl ${theme.colors.primary}`}></div>
        <div className="flex justify-between items-start mb-8">
          <div className={theme.colors.text}>{theme.icon}</div>
          <span className={`font-bold text-lg tracking-wider ${theme.colors.textDark} uppercase`}>{theme.appName}</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
           <div className="bg-gray-900 p-4 rounded-xl shadow-inner">
              <QrCode className="text-white w-48 h-48" /> 
           </div>
        </div>
        <div className="mt-8 text-center space-y-2">
          <p className="text-gray-400 text-xs uppercase tracking-[0.2em]">ID DE MIEMBRO</p>
          <p className="text-2xl font-mono text-gray-800 font-bold tracking-widest">{userData?.memberId || '---'}</p>
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="text-xs text-gray-400 uppercase tracking-widest">Powered by</p>
        <p className="font-bold text-gray-800">LoyalTap</p>
      </div>
    </div>
  );
}

function HistoryView({ transactions, theme }) {
  const txArray = Array.isArray(transactions) ? transactions : [];
  const sortedTx = [...txArray].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-gray-800 mb-6">Historial</h2>
      <div className="space-y-4 border-l-2 border-gray-200 ml-3 pl-6">
        {sortedTx.map((tx) => (
          <div key={tx.id} className="relative">
             <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white ${tx.type === 'earn' ? theme.colors.primary : 'bg-gray-400'}`}></div>
             <div className="flex justify-between">
               <div>
                 <p className="font-bold text-sm text-gray-800">{tx.title}</p>
                 <p className="text-xs text-gray-400">{new Date(tx.date).toLocaleDateString()}</p>
               </div>
               <span className={`font-bold text-sm ${tx.type === 'earn' ? theme.colors.text : 'text-gray-500'}`}>
                 {tx.type === 'earn' ? '+' : ''}{tx.points}
               </span>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NavButton({ icon, label, isActive, onClick, theme }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-full h-full transition-colors ${isActive ? theme.colors.text : 'text-gray-400 hover:text-gray-500'}`}>
      {React.cloneElement(icon, { size: 24, strokeWidth: isActive ? 2.5 : 2 })}
      <span className="text-[10px] mt-1 font-medium">{label}</span>
    </button>
  );
}

// --- MODO BARISTA / ADMIN ---

function BaristaDashboard({ user, theme, db, appId }) { // Ahora recibe el appId seguro
  const [scanMode, setScanMode] = useState(true);
  const [manualId, setManualId] = useState('');
  const [scannedUser, setScannedUser] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const simulateScan = () => {
    // Simula que la cámara escanea el QR del usuario actual
    if (!user) return;
    setProcessing(true);
    
    // Usamos el appId que se pasó y que ya está sanitizado
    const userRef = doc(db, 'artifacts', appId, 'users', user.uid, 'loyalty_data', 'profile');
    
    // Simulación de delay y fetch
    setTimeout(async () => {
        try {
          // Importación dinámica necesaria para el entorno
          const { getDoc } = await import('firebase/firestore'); 
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            setScannedUser({ uid: user.uid, ...snap.data() });
          } else {
            console.error("User not found in Firestore.");
          }
        } catch (error) {
          console.error("Error simulating scan/fetch:", error);
        }
        setProcessing(false);
    }, 1000);
  };

  const addPoints = async (amount, item) => {
    if (!scannedUser || !scannedUser.uid) return;
    setProcessing(true);
    // Usamos el appId que se pasó y que ya está sanitizado
    const userRef = doc(db, 'artifacts', appId, 'users', scannedUser.uid, 'loyalty_data', 'profile');
    try {
      await updateDoc(userRef, {
        points: increment(amount),
        transactions: arrayUnion({
          id: Date.now(), title: `Compra: ${item}`, points: amount, type: 'earn', date: new Date().toISOString()
        })
      });
      setSuccessMsg(`+${amount} ${theme.currency}`);
      setTimeout(() => { setSuccessMsg(''); setScannedUser(null); }, 2000);
    } catch (error) {
      console.error("Error adding points:", error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-100">
      <header className={`${theme.colors.primary} text-white p-4 shadow-md`}>
        <h1 className="text-lg font-bold flex items-center gap-2">
          <Store size={20} /> {theme.appName} POS
        </h1>
        <p className="text-white/70 text-xs">Modo Operador</p>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        {!scannedUser ? (
          <div className="space-y-6 max-w-sm mx-auto mt-8">
            <div className="bg-white p-1 rounded-lg flex shadow-sm">
               <button onClick={() => setScanMode(true)} className={`flex-1 py-2 text-sm font-bold rounded ${scanMode ? `${theme.colors.badge}` : 'text-gray-500'}`}>Cámara</button>
               <button onClick={() => setScanMode(false)} className={`flex-1 py-2 text-sm font-bold rounded ${!scanMode ? `${theme.colors.badge}` : 'text-gray-500'}`}>Manual</button>
            </div>

            {scanMode ? (
              <div className="bg-black rounded-2xl aspect-[3/4] relative flex flex-col items-center justify-center overflow-hidden shadow-lg">
                 {processing ? (
                   <div className="text-white animate-pulse flex flex-col items-center"><Scan size={48} className="mb-4"/><p>Procesando...</p></div>
                 ) : (
                   <>
                     {/* Imagen de fondo simulada para la cámara */}
                     <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?auto=format&fit=crop&w=800&q=80')] opacity-40 bg-cover grayscale"></div>
                     <div className={`z-10 w-64 h-64 border-2 rounded-lg flex items-center justify-center relative border-white/50`}>
                        <div className="w-60 h-0.5 bg-red-500 absolute top-1/2 animate-ping"></div>
                     </div>
                     <button onClick={simulateScan} className="absolute bottom-8 bg-white text-black px-6 py-3 rounded-full font-bold text-sm shadow-lg z-20 hover:scale-105 transition-transform">
                       [ SIMULAR LECTURA DE TARJETA ]
                     </button>
                   </>
                 )}
              </div>
            ) : (
              <div className="bg-white p-6 rounded-xl shadow space-y-4">
                 <input 
                    type="text" 
                    placeholder="ID Cliente" 
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    className="w-full text-2xl font-mono p-3 border rounded text-center outline-none focus:ring-2" 
                 />
                 <button className={`${theme.colors.primary} text-white w-full py-3 rounded font-bold`} disabled={true}>Buscar (Desactivado)</button>
              </div>
            )}
          </div>
        ) : (
          <div className="animate-in slide-in-from-bottom">
             {successMsg ? (
               <div className={`${theme.colors.badge} p-8 rounded-xl flex flex-col items-center text-center mb-6`}>
                 <CheckCircle size={48} className="mb-2"/>
                 <h3 className="text-xl font-bold">{successMsg}</h3>
               </div>
             ) : (
               <>
                 <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex justify-between items-center">
                    <div>
                       <h2 className="font-bold text-lg">{scannedUser.name}</h2>
                       <span className={`${theme.colors.badge} text-[10px] px-2 py-1 rounded font-bold uppercase`}>{scannedUser.level}</span>
                    </div>
                    <div className="text-right">
                       <p className={`text-3xl font-bold ${theme.colors.text}`}>{scannedUser.points}</p>
                       <p className="text-[10px] text-gray-400 uppercase">{theme.currency}</p>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    {[10, 20, 50, 100].map(amt => (
                      <button key={amt} onClick={() => addPoints(amt, 'Consumo General')} className="bg-white border hover:bg-gray-50 p-4 rounded-xl flex flex-col items-center gap-1 shadow-sm active:scale-95 transition-transform">
                        <span className={`text-xl font-bold ${theme.colors.text}`}>+{amt}</span>
                        <span className="text-xs text-gray-400">Agregar</span>
                      </button>
                    ))}
                 </div>
                 <button onClick={() => setScannedUser(null)} className="w-full mt-6 py-3 text-gray-400 text-sm font-bold">Cancelar Operación</button>
               </>
             )}
          </div>
        )}
      </main>
    </div>
  );
}