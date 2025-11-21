import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
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
  User
} from 'lucide-react';

// ============================================================
// ⚠️ ZONA DE CONFIGURACIÓN - ¡EDITA ESTO CON TUS DATOS! ⚠️
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyCz1pYtGW9nlxhSM446wDjz-RN2gvc5kMM",
  authDomain: "loyaltap-bd851.firebaseapp.com",
  projectId: "loyaltap-bd851",
  storageBucket: "loyaltap-bd851.firebasestorage.app",
  messagingSenderId: "288775756726",
  appId: "1:288775756726:web:85db003fac431dff08bf17"
};
// ============================================================

// Inicialización de Firebase
// Solo inicializamos si tenemos una configuración válida para evitar errores en blanco
let app, auth, db;
try {
    if (!firebaseConfig.apiKey.includes("PEGAR")) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
    }
} catch (e) {
    console.error("Error Firebase:", e);
}

const appId = 'coffee-star-v1'; // ID fijo para esta versión simple

// --- Componente Principal ---
export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [isBaristaMode, setIsBaristaMode] = useState(false);

  // 1. Autenticación
  useEffect(() => {
    if (!auth) {
        setLoading(false);
        return;
    }

    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Datos del Usuario
  useEffect(() => {
    if (!user || !db) return;

    const userRef = doc(db, 'loyalty_system', appId, 'users', user.uid);
    
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserData(docSnap.data());
      } else {
        // Crear perfil default
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
    });
    return () => unsubscribe();
  }, [user]);

  const handleRedeem = async (cost, rewardName) => {
    if (!userData || userData.points < cost) return;
    const userRef = doc(db, 'loyalty_system', appId, 'users', user.uid);
    await updateDoc(userRef, {
      points: increment(-cost),
      transactions: arrayUnion({
        id: Date.now(), title: `Canje: ${rewardName}`, points: -cost, type: 'spend', date: new Date().toISOString()
      })
    });
  };

  // Si no hay configuración, mostrar aviso
  if (!auth) {
      return (
        <div className="flex h-screen items-center justify-center bg-red-50 p-4 text-center">
            <div>
                <h1 className="text-xl font-bold text-red-600">Falta Configuración</h1>
                <p className="text-gray-600">Edita src/App.jsx y pon tus credenciales de Firebase.</p>
            </div>
        </div>
      );
  }

  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-900 text-white">Cargando Coffee Star...</div>;

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-800 font-sans overflow-hidden max-w-md mx-auto shadow-2xl relative">
      
      {/* Top Bar */}
      <div className="bg-gray-900 text-gray-400 p-2 px-4 flex justify-between items-center text-[10px] uppercase tracking-widest z-50">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">Coffee Star v1.0</span>
        </div>
        <button onClick={() => setIsBaristaMode(!isBaristaMode)} className="hover:text-white transition-colors flex gap-1 items-center">
          {isBaristaMode ? <><User size={12}/> Ver App Cliente</> : <><Store size={12}/> Ir a Caja</>}
        </button>
      </div>

      {isBaristaMode ? (
        <BaristaDashboard user={user} onExit={() => setIsBaristaMode(false)} />
      ) : (
        <ClientApp 
          userData={userData} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
          onRedeem={handleRedeem}
        />
      )}
    </div>
  );
}

// --- VISTAS DEL CLIENTE ---

function ClientApp({ userData, activeTab, setActiveTab, onRedeem }) {
  return (
    <>
      <header className="bg-white p-4 shadow-sm z-10 flex justify-between items-center">
        <div className="flex items-center gap-2 font-bold text-xl text-emerald-700">
          <Coffee />
          <span>Coffee Star</span>
        </div>
        <div className="text-xs px-2 py-1 rounded-full font-bold bg-emerald-100 text-emerald-700">
           {userData?.level || 'Bronce'}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20 scrollbar-hide">
        {activeTab === 'home' && <HomeView userData={userData} />}
        {activeTab === 'card' && <CardView userData={userData} />}
        {activeTab === 'rewards' && <RewardsView userData={userData} onRedeem={onRedeem} />}
        {activeTab === 'history' && <HistoryView transactions={userData?.transactions} />}
      </main>

      <nav className="bg-white border-t border-gray-200 absolute bottom-0 w-full h-16 flex justify-around items-center z-20 pb-safe">
        <NavButton icon={<Star />} label="Inicio" isActive={activeTab === 'home'} onClick={() => setActiveTab('home')} />
        <NavButton icon={<QrCode />} label="Tarjeta" isActive={activeTab === 'card'} onClick={() => setActiveTab('card')} />
        <NavButton icon={<Gift />} label="Premios" isActive={activeTab === 'rewards'} onClick={() => setActiveTab('rewards')} />
        <NavButton icon={<History />} label="Historial" isActive={activeTab === 'history'} onClick={() => setActiveTab('history')} />
      </nav>
    </>
  );
}

function HomeView({ userData }) {
  const points = userData?.points || 0;
  const nextReward = 150;
  const progress = Math.min((points / nextReward) * 100, 100);

  return (
    <div className="p-6 space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-light text-emerald-900">Hola, {userData?.name?.split(' ')[0]}</h2>
        <p className="text-sm text-emerald-600 opacity-80">¡Gracias por tu visita!</p>
      </div>

      <div className="relative w-64 h-64 mx-auto">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="128" cy="128" r="110" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-gray-200" />
          <circle 
            cx="128" cy="128" r="110" 
            stroke="currentColor" strokeWidth="12" fill="transparent" 
            strokeDasharray={691} strokeDashoffset={691 - (691 * progress) / 100} 
            className="text-emerald-500 transition-all duration-1000 ease-out" 
            strokeLinecap="round" 
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-6xl font-bold text-emerald-800">{points}</span>
          <span className="text-sm font-medium uppercase tracking-wider mt-1 text-emerald-600">Estrellas</span>
        </div>
      </div>

      <div className="bg-emerald-50 p-4 rounded-xl flex gap-3 items-start border border-emerald-100">
         <Sparkles className="text-emerald-600" size={20} />
         <p className="text-sm text-emerald-800">
           Usa tu tarjeta digital en cada visita para subir de nivel y desbloquear mejores recompensas.
         </p>
      </div>
    </div>
  );
}

function RewardsView({ userData, onRedeem }) {
  const rewards = [
      { id: 1, name: 'Extra Shot', cost: 25, desc: 'Potenciador' },
      { id: 2, name: 'Panqué', cost: 50, desc: 'Repostería' },
      { id: 3, name: 'Bebida Gratis', cost: 100, desc: 'Cualquier tamaño' },
  ];

  return (
    <div className="p-4 pb-24">
      <div className="mb-6 sticky top-0 bg-gray-50/95 backdrop-blur-sm py-2 z-10">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Recompensas</h2>
        <p className="text-sm text-gray-500">Saldo disponible: <span className="font-bold text-emerald-600">{userData?.points || 0} Estrellas</span></p>
      </div>
      <div className="space-y-3">
        {rewards.map((reward) => {
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
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${canAfford ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-gray-200 text-gray-400'}`}
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

function CardView({ userData }) {
  return (
    <div className="p-6 flex flex-col items-center justify-center h-full space-y-8 bg-emerald-50">
      <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm aspect-[3/4] flex flex-col relative overflow-hidden border border-gray-100">
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-10 blur-3xl bg-emerald-500"></div>
        <div className="flex justify-between items-start mb-8">
          <div className="text-emerald-600"><Coffee /></div>
          <span className="font-bold text-lg tracking-wider text-emerald-800 uppercase">Coffee Star</span>
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

function HistoryView({ transactions }) {
  const sortedTx = [...(transactions || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-gray-800 mb-6">Historial</h2>
      <div className="space-y-4 border-l-2 border-gray-200 ml-3 pl-6">
        {sortedTx.map((tx) => (
          <div key={tx.id} className="relative">
             <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white ${tx.type === 'earn' ? 'bg-emerald-600' : 'bg-gray-400'}`}></div>
             <div className="flex justify-between">
               <div>
                 <p className="font-bold text-sm text-gray-800">{tx.title}</p>
                 <p className="text-xs text-gray-400">{new Date(tx.date).toLocaleDateString()}</p>
               </div>
               <span className={`font-bold text-sm ${tx.type === 'earn' ? 'text-emerald-600' : 'text-gray-500'}`}>
                 {tx.type === 'earn' ? '+' : ''}{tx.points}
               </span>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NavButton({ icon, label, isActive, onClick }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-full h-full transition-colors ${isActive ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-500'}`}>
      {React.cloneElement(icon, { size: 24, strokeWidth: isActive ? 2.5 : 2 })}
      <span className="text-[10px] mt-1 font-medium">{label}</span>
    </button>
  );
}

// --- MODO BARISTA / ADMIN ---

function BaristaDashboard({ user, onExit }) {
  const [scanMode, setScanMode] = useState(true);
  const [scannedUser, setScannedUser] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const simulateScan = () => {
    setProcessing(true);
    // Simulación: Encontramos al usuario actual
    setTimeout(async () => {
        try {
            const { getDoc, doc } = await import('firebase/firestore');
            const ref = doc(db, 'loyalty_system', appId, 'users', user.uid);
            const snap = await getDoc(ref);
            if (snap.exists()) setScannedUser({ uid: user.uid, ...snap.data() });
        } catch (e) {
            console.error(e);
        }
        setProcessing(false);
    }, 1000);
  };

  const addPoints = async (amount, item) => {
    if (!scannedUser) return;
    setProcessing(true);
    const userRef = doc(db, 'loyalty_system', appId, 'users', scannedUser.uid);
    await updateDoc(userRef, {
      points: increment(amount),
      transactions: arrayUnion({
        id: Date.now(), title: `Compra: ${item}`, points: amount, type: 'earn', date: new Date().toISOString()
      })
    });
    setProcessing(false);
    setSuccessMsg(`+${amount} Estrellas`);
    setTimeout(() => { setSuccessMsg(''); setScannedUser(null); }, 2000);
  };

  return (
    <div className="flex flex-col h-full bg-gray-100">
      <header className="bg-emerald-700 text-white p-4 shadow-md">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <Store size={20} /> Coffee Star POS
        </h1>
        <p className="text-white/70 text-xs">Modo Operador</p>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        {!scannedUser ? (
          <div className="space-y-6 max-w-sm mx-auto mt-8">
            <div className="bg-white p-1 rounded-lg flex shadow-sm">
               <button onClick={() => setScanMode(true)} className={`flex-1 py-2 text-sm font-bold rounded ${scanMode ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500'}`}>Cámara</button>
               <button onClick={() => setScanMode(false)} className={`flex-1 py-2 text-sm font-bold rounded ${!scanMode ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500'}`}>Manual</button>
            </div>

            {scanMode ? (
              <div className="bg-black rounded-2xl aspect-[3/4] relative flex flex-col items-center justify-center overflow-hidden shadow-lg">
                 {processing ? (
                   <div className="text-white animate-pulse flex flex-col items-center"><Scan size={48} className="mb-4"/><p>Procesando...</p></div>
                 ) : (
                   <>
                     <div className="absolute inset-0 bg-gray-800 opacity-40"></div>
                     <div className="z-10 w-64 h-64 border-2 rounded-lg flex items-center justify-center relative border-white/50">
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
                 <input type="text" placeholder="ID Cliente" className="w-full text-2xl font-mono p-3 border rounded text-center outline-none focus:ring-2" />
                 <button className="bg-emerald-600 text-white w-full py-3 rounded font-bold">Buscar</button>
              </div>
            )}
          </div>
        ) : (
          <div className="animate-in slide-in-from-bottom">
             {successMsg ? (
               <div className="bg-emerald-100 text-emerald-700 p-8 rounded-xl flex flex-col items-center text-center mb-6">
                 <Check size={48} className="mb-2"/>
                 <h3 className="text-xl font-bold">{successMsg}</h3>
               </div>
             ) : (
               <>
                 <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex justify-between items-center">
                    <div>
                       <h2 className="font-bold text-lg">{scannedUser.name}</h2>
                       <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-1 rounded font-bold uppercase">{scannedUser.level}</span>
                    </div>
                    <div className="text-right">
                       <p className="text-3xl font-bold text-emerald-600">{scannedUser.points}</p>
                       <p className="text-[10px] text-gray-400 uppercase">Estrellas</p>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    {[10, 20, 50, 100].map(amt => (
                      <button key={amt} onClick={() => addPoints(amt, 'Consumo General')} className="bg-white border hover:bg-gray-50 p-4 rounded-xl flex flex-col items-center gap-1 shadow-sm active:scale-95 transition-transform">
                        <span className="text-xl font-bold text-emerald-600">+{amt}</span>
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