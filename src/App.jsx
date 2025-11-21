import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    onSnapshot, 
    updateDoc, 
    setDoc, 
    collection, 
    query,
    getDoc 
} from 'firebase/firestore';
import { QrCode, LogIn, Star, Coffee, User, Lock, Send, AlertTriangle, Scan, Loader, X, Check, Key } from 'lucide-react';

// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCz1pYtGW9nlxhSM446wDjz-RN2gvc5kMM",
  authDomain: "loyaltap-bd851.firebaseapp.com",
  projectId: "loyaltap-bd851",
  storageBucket: "loyaltap-bd851.appspot.com",
  messagingSenderId: "288775756726",
  appId: "1:288775756726:web:85db003fac431dff08bf17"
};
// ============================================================

// Inicialización segura de Firebase (corregida)
let app, db, auth;
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
} catch (error) {
    console.error("Error inicializando Firebase:", error);
}

// ID del negocio por defecto
const DEFAULT_BUSINESS_ID = 'coffee-star';

// --- CONFIGURACIÓN DE NEGOCIOS (Personalizable) ---
const BUSINESS_CONFIG = {
    'coffee-star': {
        name: 'Coffee Star',
        theme: 'text-yellow-600 bg-yellow-50',
        primaryColor: 'bg-yellow-600 hover:bg-yellow-700',
        icon: <Coffee size={28} />,
        levels: [
            { stars: 20, name: 'Oro', color: 'text-yellow-500', reward: '¡Café GRANDE gratis cada semana!' },
            { stars: 10, name: 'Plata', color: 'text-gray-400', reward: '20% de descuento en todos los pasteles.' },
            { stars: 5, name: 'Bronce', color: 'text-amber-700', reward: 'Bebida pequeña de cortesía en tu próximo cumpleaños.' },
        ]
    },
    'barber-vip': {
        name: 'Barber VIP Style',
        theme: 'text-blue-700 bg-blue-50',
        primaryColor: 'bg-blue-700 hover:bg-blue-800',
        icon: <Send size={28} className='transform -scale-x-100' />,
        levels: [
            { stars: 8, name: 'Diamante', color: 'text-cyan-400', reward: 'Corte completo gratis.' },
            { stars: 4, name: 'Oro', color: 'text-yellow-500', reward: '50% descuento en barba.' },
        ]
    }
};

// --- UTILIDADES ---
const getLevelInfo = (stars, configLevels) => {
    const sortedLevels = [...configLevels].sort((a, b) => a.stars - b.stars);
    let currentLevel = { name: 'Novato', color: 'text-gray-500', reward: 'Sube de nivel para desbloquear recompensas.', stars: 0 };
    let nextLevel = null;
    
    for (const level of sortedLevels) {
        if (stars >= level.stars) {
            currentLevel = { ...level, color: level.color };
        } else if (!nextLevel) {
            nextLevel = level;
        }
    }
    return { ...currentLevel, nextStars: nextLevel ? nextLevel.stars - stars : 0, nextLevel };
};

// --- COMPONENTES ---

const AdminView = ({ businessId, businessConfig, updateStars }) => {
    const [tapId, setTapId] = useState('');
    const [starsToAdd, setStarsToAdd] = useState(1);
    const [message, setMessage] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    const handleApplyStars = async () => {
        if (!tapId) return setMessage('Ingresa un ID de Cliente.');
        setIsUpdating(true);
        setMessage('');
        try {
            await updateStars(tapId, starsToAdd);
            setMessage(`¡Éxito! ${starsToAdd} puntos aplicados.`);
            setTapId('');
        } catch (e) {
            setMessage(`Error: ${e.message}`);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="p-4 max-w-md mx-auto">
            <div className="bg-white shadow-xl rounded-2xl p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                    <Lock className="w-6 h-6 mr-2 text-indigo-600"/> Panel Admin: {businessConfig.name}
                </h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">ID del Cliente</label>
                        <input type="text" value={tapId} onChange={(e) => setTapId(e.target.value)} className="w-full p-3 border rounded-lg mt-1" placeholder="Pega el ID aquí" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Puntos a dar</label>
                        <input type="number" value={starsToAdd} onChange={(e) => setStarsToAdd(Number(e.target.value))} className="w-full p-3 border rounded-lg mt-1" />
                    </div>
                    <button onClick={handleApplyStars} disabled={isUpdating} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition">
                        {isUpdating ? 'Procesando...' : 'Aplicar Puntos'}
                    </button>
                    {message && <p className="text-center font-medium text-sm mt-2">{message}</p>}
                </div>
            </div>
        </div>
    );
};

const CustomerView = ({ userId, userData, businessId, businessConfig }) => {
    const stars = userData?.stars || 0;
    const levelInfo = getLevelInfo(stars, businessConfig.levels);
    
    // QR Code simple
    const qrData = `${businessId}/${userId}`;
    const qrImageURL = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;

    return (
        <div className="min-h-screen bg-gray-50 p-4 flex flex-col items-center pb-20">
            <div className={`w-full max-w-md p-6 rounded-2xl shadow-lg text-white mb-6 ${businessConfig.primaryColor}`}>
                <div className="flex items-center gap-3 mb-2">
                    {businessConfig.icon}
                    <h1 className="text-2xl font-bold">{businessConfig.name}</h1>
                </div>
                <p className="opacity-90">Nivel Actual: <span className="font-bold">{levelInfo.name}</span></p>
            </div>

            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 text-center mb-6">
                <p className="text-gray-500 text-sm uppercase tracking-wide">Tus Puntos</p>
                <div className="text-6xl font-black text-gray-800 my-2 flex justify-center items-center">
                    {stars} <Star className="w-8 h-8 text-yellow-400 fill-current ml-2" />
                </div>
                {levelInfo.nextLevel ? (
                    <p className="text-sm text-gray-600">Faltan {levelInfo.nextStars} para {levelInfo.nextLevel.name}</p>
                ) : (
                    <p className="text-green-600 font-bold">¡Nivel Máximo Alcanzado!</p>
                )}
            </div>

            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 flex flex-col items-center">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center"><QrCode className="w-5 h-5 mr-2"/> Tu Código</h3>
                <div className="p-2 border-2 border-dashed border-gray-300 rounded-lg">
                    <img src={qrImageURL} alt="QR" className="w-48 h-48" />
                </div>
                <p className="mt-4 text-xs text-gray-400 font-mono break-all">{userId}</p>
            </div>
        </div>
    );
};

// ==========================================
// APP PRINCIPAL
// ==========================================
export default function App() {
    const [userId, setUserId] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isOwnerView, setIsOwnerView] = useState(false);

    // Routing simple
    const path = window.location.pathname;
    const parts = path.split('/').filter(p => p);
    const businessId = parts[0] || DEFAULT_BUSINESS_ID;
    const isAdminRoute = parts[1] === 'admin';
    const businessConfig = BUSINESS_CONFIG[businessId] || BUSINESS_CONFIG[DEFAULT_BUSINESS_ID];

    useEffect(() => {
        // Si las credenciales no están puestas, no intentamos nada
        if (!auth || firebaseConfig.apiKey.includes("PEGAR")) {
            setLoading(false);
            return;
        }

        // 1. Autenticar
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            let currentUid = user?.uid;
            if (!user) {
                try {
                    const cred = await signInAnonymously(auth);
                    currentUid = cred.user.uid;
                } catch (e) {
                    console.error("Error auth:", e);
                }
            }
            setUserId(currentUid);
            if (isAdminRoute) setIsOwnerView(true); // Simple check para demo
        });

        return () => unsubscribeAuth();
    }, []);

    // 2. Cargar datos (solo si no es admin y tenemos usuario)
    useEffect(() => {
        if (!userId || isOwnerView || !db) {
            if (userId) setLoading(false);
            return;
        }

        // Ruta segura en Firestore
        const userRef = doc(db, 'businesses', businessId, 'customers', userId);
        
        const unsubscribe = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                setUserData(docSnap.data());
            } else {
                // Iniciar usuario
                setUserData({ stars: 0 });
                // Importante: Crear el documento inicial
                setDoc(userRef, { stars: 0, joined: new Date().toISOString() }, { merge: true });
            }
            setLoading(false);
        }, (error) => {
            console.error("Error Firestore:", error);
            // Si falla por permisos (reglas), mostramos 0
            setUserData({ stars: 0 }); 
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId, businessId, isOwnerView]);

    // Función para admin
    const updateStars = useCallback(async (targetId, amount) => {
        if (!db) return;
        const ref = doc(db, 'businesses', businessId, 'customers', targetId);
        const snap = await getDoc(ref);
        const current = snap.exists() ? snap.data().stars : 0;
        await setDoc(ref, { stars: Math.max(0, current + amount) }, { merge: true });
    }, [businessId]);

    // Mensaje si faltan las credenciales
    if (firebaseConfig.apiKey && firebaseConfig.apiKey.includes("PEGAR")) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-red-50 text-red-800 text-center font-sans">
                <div className="bg-white p-6 rounded-xl shadow-xl max-w-md border-l-4 border-red-600">
                    <h1 className="text-2xl font-bold mb-4 flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 mr-2 text-red-600"/>
                        Configuración Incompleta
                    </h1>
                    <p className="mb-4">
                        Tu aplicación ya está desplegada, pero <strong>necesita conectarse a Firebase</strong>.
                    </p>
                    <p className="text-sm bg-red-100 p-3 rounded text-left font-mono">
                        Abre src/App.jsx y reemplaza las líneas que dicen "PEGAR_AQUI..." con los datos reales de tu consola de Firebase.
                    </p>
                </div>
            </div>
        );
    }

    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
            <Loader className="w-10 h-10 text-indigo-600 animate-spin mb-4"/>
            <p className="text-gray-500 font-medium">Iniciando LoyalTap...</p>
        </div>
    );

    if (isOwnerView) {
        return <AdminView businessId={businessId} businessConfig={businessConfig} updateStars={updateStars} />;
    }

    return <CustomerView userId={userId} userData={userData} businessId={businessId} businessConfig={businessConfig} />;
}