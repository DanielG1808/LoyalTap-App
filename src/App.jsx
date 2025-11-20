import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { QrCode, LogIn, Star, Coffee, User, Lock, Send, AlertTriangle, Scan } from 'lucide-react';

// --- CONFIGURACIÓN GLOBAL (NO TOCAR) ---
// Las variables __app_id, __firebase_config y __initial_auth_token son proporcionadas por el entorno.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Inicialización de Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
// ----------------------------------------

// ===============================================
// 1. SUBCOMPONENTES (Placeholders Seguros)
// ===============================================

const AdminView = ({ businessId, businessConfig }) => (
    <div className="max-w-xl mx-auto p-8 bg-blue-100 shadow-2xl rounded-xl border border-blue-200 mt-8">
        <h2 className="text-3xl font-extrabold text-blue-700 flex items-center justify-center mb-4">
            <Lock className='w-6 h-6 mr-2'/> Vista de Administrador
        </h2>
        <p className="text-center text-gray-600">ID del Negocio: <span className="font-mono text-sm text-blue-500">{businessId}</span></p>
        <p className="text-center text-sm text-gray-500 mt-2">Bienvenido Dueño. Esta es la vista administrativa.</p>
    </div>
);

const CustomerView = ({ userId, userData, businessConfig }) => {
    const stars = userData?.stars || 0;
    const goal = businessConfig?.starsRequired || 10;
    const progress = Math.min(100, (stars / goal) * 100);

    return (
        <div className="max-w-xl mx-auto p-8 bg-white shadow-2xl rounded-xl border border-green-200 text-center mt-8">
            <h2 className="text-3xl font-extrabold text-green-700 flex items-center justify-center mb-6">
                <Coffee className='w-8 h-8 mr-2'/> LoyalTap Card
            </h2>
            <p className="text-gray-500 mb-4 text-xs">Tu ID: <span className="font-mono break-all text-gray-600">{userId}</span></p>
            
            <div className="my-6">
                <QrCode size={180} className="mx-auto text-green-500 border-4 border-green-500 p-2 rounded-xl" />
                <p className="mt-4 text-xl font-semibold text-gray-700">¡Escanea para puntos!</p>
            </div>

            <div className="mt-8">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-2xl font-bold text-gray-800 flex items-center">Puntos: {stars} <Star className="ml-2 w-6 h-6 text-yellow-500"/></span>
                    <span className="text-lg text-gray-600">Meta: {goal}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                        className="bg-green-500 h-3 rounded-full transition-all duration-500" 
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
                <p className="text-sm mt-2 text-green-600 font-medium">Faltan {goal - stars} puntos para tu recompensa.</p>
            </div>
        </div>
    );
};


// ===============================================
// 2. COMPONENTE PRINCIPAL APP
// ===============================================

export default function App() {
    // 2.1. ESTADOS
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [userId, setUserId] = useState(null);
    const [userData, setUserData] = useState(null);
    const [businessConfig, setBusinessConfig] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false); // Bandera para esperar la autenticación

    // Obtener el businessId de la URL (Asumido)
    const businessId = useMemo(() => {
        const params = new URLSearchParams(window.location.search);
        // Usa un ID de negocio de ejemplo si no hay uno en la URL
        const id = params.get('businessId') || 'default-coffee-shop'; 
        console.log(`[App.jsx] Business ID detectado: ${id}`);
        return id;
    }, []);
    
    // 2.2. HOOK DE AUTENTICACIÓN
    useEffect(() => {
        console.log("[App.jsx] Iniciando proceso de autenticación...");
        
        // Función para manejar el inicio de sesión
        const signIn = async () => {
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (err) {
                console.error("Firebase Auth Error:", err);
                setError(`Fallo de autenticación: ${err.message}`);
            }
        };

        // Listener para el estado de autenticación (se activa después del signIn)
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserId(user.uid);
                console.log(`[App.jsx] Auth: Usuario autenticado. UID: ${user.uid}`);
            } else {
                 setUserId(null); 
                 console.log("[App.jsx] Auth: Sesión anónima o fallida.");
            }
            setIsAuthReady(true); // ¡La autenticación ha finalizado su chequeo!
        });
        
        signIn(); // Iniciar la sesión
        return () => unsubscribe(); // Limpieza del listener
    }, []);

    // 2.3. HOOK DE CARGA DE DATOS (Se ejecuta SOLO si la autenticación está lista)
    useEffect(() => {
        // Bloquear si la autenticación no ha terminado o si faltan IDs
        if (!isAuthReady || !userId || !businessId) {
            console.log(`[App.jsx] Data Load: Esperando (Ready: ${isAuthReady}, UID: ${!!userId}, BID: ${!!businessId})`);
            return;
        }

        console.log(`[App.jsx] Data Load: Autenticación lista. UID: ${userId}. Iniciando listeners de Firestore.`);
        let configUnsubscribed = false;
        let userUnsubscribed = false;

        // Listener 1: Configuración del Negocio (Ruta pública)
        const businessDocRef = doc(db, `artifacts/${appId}/public/data/businesses`, businessId);
        const unsubscribeConfig = onSnapshot(businessDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setBusinessConfig(docSnap.data());
                console.log("[App.jsx] Config: OK.");
            } else {
                // Esto es un error crítico si el negocio debe existir
                setError(`Configuración no encontrada en Firestore para el negocio: ${businessId}.`);
                console.error("[App.jsx] Config: ERROR - Documento no existe.");
            }
        }, (err) => {
            console.error("Error al cargar config de negocio:", err);
            setError(`Error Firestore config: ${err.message}`);
        });

        // Listener 2: Datos del Usuario (Ruta privada)
        const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/data`, businessId);
        const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
            if (!docSnap.exists()) {
                const initialData = { stars: 0, created: new Date().toISOString() };
                setUserData(initialData);
                // Crea el documento inicial para evitar errores de referencia futuros
                setDoc(userDocRef, initialData, { merge: true }).catch(console.error);
                console.log("[App.jsx] User Data: Inicializado con 0 estrellas.");
            } else {
                setUserData(docSnap.data());
                console.log("[App.jsx] User Data: OK.");
            }
            setLoading(false); // ¡Los datos se cargaron o inicializaron! Parar loading.
        }, (err) => {
            console.error("Error al cargar datos de usuario:", err);
            setError(`Error Firestore usuario: ${err.message}`);
            setLoading(false);
        });

        // Limpieza de listeners
        return () => {
            unsubscribeConfig();
            unsubscribeUser();
            console.log("[App.jsx] Limpiando Listeners de Firestore.");
        };

    }, [isAuthReady, userId, businessId]); // Se ejecuta cuando la autenticación está lista

    // 2.4. Lógica de Vista (Propietario vs. Cliente)
    const isOwner = userId === businessId;


    // ===============================================
    // 3. RENDERIZADO CONDICIONAL
    // ===============================================

    // Pantalla de Carga
    if (loading || !businessConfig) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 font-inter">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-yellow-600"></div>
                <p className="ml-4 text-gray-600 mt-4 font-semibold">Cargando LoyalTap...</p>
                {/* Muestra el estado de las variables para depuración si no se detecta la carga */}
                <p className="text-xs mt-4 text-gray-400">Auth Ready: {isAuthReady ? 'Sí' : 'No'} | Config Loaded: {!!businessConfig ? 'Sí' : 'No'}</p>
            </div>
        );
    }
    
    // Pantalla de Error
    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-red-100 p-4 font-inter">
                <div className="text-red-700 text-center p-6 bg-white rounded-xl shadow-lg border border-red-300">
                    <h1 className="text-xl font-bold flex items-center justify-center"><AlertTriangle className='w-5 h-5 mr-2'/> Error Crítico</h1>
                    <p className="mt-2">{error}</p>
                    <p className="mt-4 text-sm font-mono break-all text-gray-600">App ID: **{appId}**</p>
                    <p className="mt-1 text-sm font-mono break-all text-gray-600">Business ID: **{businessId}**</p>
                    <p className="text-xs mt-4 text-gray-500">Asegúrate de que la configuración de Firebase exista en la ruta pública correcta.</p>
                </div>
            </div>
        );
    }

    // 4. SELECCIÓN DE VISTA
    return (
        <div className="min-h-screen bg-gray-50 p-4 flex items-start justify-center">
            {isOwner ? (
                <AdminView 
                    businessId={businessId} 
                    businessConfig={businessConfig} 
                />
            ) : (
                <CustomerView 
                    userId={userId} 
                    userData={userData} 
                    businessConfig={businessConfig}
                />
            )}
        </div>
    );
}