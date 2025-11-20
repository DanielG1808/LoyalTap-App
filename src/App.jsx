import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { QrCode, LogIn, Star, Coffee, User, Lock, Send, AlertTriangle } from 'lucide-react';

// --- CONFIGURACIÓN GLOBAL (NO TOCAR) ---
// Variables globales proporcionadas por el entorno (Canvas)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Inicialización de Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
// ----------------------------------------

// --- CONFIGURACIÓN DE SEGURIDAD Y NEGOCIOS ---
// PIN de Administración global (¡CAMBIAR POR UN MÉTODO MÁS SEGURO EN PRODUCCIÓN!)
const ADMIN_PIN_CODE = '1234';

// Configuración de Múltiples Negocios (PERSONALIZAR ESTO)
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
    'barber-vip': { // Ejemplo de un segundo negocio (Peluquería VIP)
        name: 'Barber VIP Style',
        theme: 'text-blue-700 bg-blue-50',
        primaryColor: 'bg-blue-700 hover:bg-blue-800',
        icon: <Send size={28} className='transform -scale-x-100' />, // Usamos Send como tijeras de ejemplo
        levels: [
            { stars: 8, name: 'Diamante', color: 'text-cyan-400', reward: 'Corte de pelo gratis y un afeitado de lujo.' },
            { stars: 4, name: 'Oro', color: 'text-yellow-500', reward: '50% de descuento en tratamientos de barba.' },
        ]
    }
};

// --- UTILIDADES ---

/**
 * Determina el nivel y la recompensa del usuario.
 * @param {number} stars - El número actual de puntos/estrellas del usuario.
 * @param {Array} configLevels - La configuración de niveles del negocio.
 * @returns {{name: string, color: string, reward: string, nextStars: number, nextLevel: object | null}}
 */
const getLevelInfo = (stars, configLevels) => {
    // Ordenar los niveles de menor a mayor para el cálculo de progreso
    const sortedLevels = [...configLevels].sort((a, b) => a.stars - b.stars);
    
    // Buscar el nivel actual y el siguiente
    let currentLevel = { name: 'Novato', color: 'text-gray-500', reward: 'Sube de nivel para desbloquear grandes recompensas.', stars: 0 };
    let nextLevel = null;
    
    for (const level of sortedLevels) {
        if (stars >= level.stars) {
            currentLevel = { ...level, color: level.color }; // Usuario ha alcanzado este nivel
        } else if (!nextLevel) {
            nextLevel = level; // Este es el próximo nivel a alcanzar
        }
    }

    if (nextLevel) {
        const remaining = nextLevel.stars - stars;
        return {
            ...currentLevel,
            nextStars: remaining,
            nextLevel: nextLevel
        };
    }

    // Si no hay más niveles
    return {
        ...currentLevel,
        nextStars: 0, // No hay más niveles
        nextLevel: null
    };
};

/**
 * Componente para mostrar mensajes de error/éxito
 */
const Alert = ({ message, type }) => {
    const baseClasses = "p-4 mb-4 text-sm rounded-lg flex items-center";
    let typeClasses = "";
    let icon = null;

    if (type === 'error') {
        typeClasses = "bg-red-100 text-red-700";
        icon = <AlertTriangle className="w-4 h-4 mr-2" />;
    } else if (type === 'success') {
        typeClasses = "bg-green-100 text-green-700";
        icon = <Star className="w-4 h-4 mr-2" />;
    } else {
        typeClasses = "bg-blue-100 text-blue-700";
        icon = <User className="w-4 h-4 mr-2" />;
    }

    return (
        <div className={`${baseClasses} ${typeClasses}`} role="alert">
            {icon}
            {message}
        </div>
    );
};

// -----------------------------------------------------
// VISTAS PRINCIPALES (Cliente, Admin)
// -----------------------------------------------------

/**
 * Vista de la Tarjeta de Lealtad del Cliente
 */
const CustomerView = ({ userId, userData, businessId, businessConfig }) => {
    const [currentTab, setCurrentTab] = useState('card'); // 'card', 'rewards', 'scan'
    const currentStars = userData.stars || 0;
    const levelInfo = getLevelInfo(currentStars, businessConfig.levels);
    const { name, color, nextStars, nextLevel } = levelInfo;

    // Calculamos el progreso para la barra (para el siguiente nivel)
    let progress = 0;
    
    if (nextLevel) {
        const sortedLevels = [...businessConfig.levels].sort((a, b) => a.stars - b.stars);
        const previousLevel = sortedLevels.slice().reverse().find(l => l.stars <= currentStars && l.stars !== nextLevel.stars) || { stars: 0 };
        const target = nextLevel.stars;
        const progressRange = target - previousLevel.stars;
        const currentProgress = currentStars - previousLevel.stars;
        progress = progressRange > 0 ? (currentProgress / progressRange) * 100 : 100;
    } else {
        progress = 100; // Nivel máximo alcanzado
    }

    // Generar el contenido del QR (ejemplo simple: businessId/userId)
    const qrData = `${businessId}/${userId}`;
    const qrImageURL = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}`;

    return (
        <div className="flex flex-col min-h-screen p-4 pb-20 bg-gray-50 font-inter">
            {/* Encabezado */}
            <div className={`p-4 rounded-xl shadow-lg mb-6 ${businessConfig.primaryColor} text-white`}>
                <div className="flex items-center space-x-3">
                    {React.cloneElement(businessConfig.icon, { size: 32 })}
                    <h1 className="text-3xl font-extrabold">{businessConfig.name}</h1>
                </div>
                <p className="mt-1 text-sm opacity-90">Tu tarjeta de lealtad digital.</p>
            </div>

            {/* Contenido Principal */}
            <div className="flex-grow">
                {currentTab === 'card' && (
                    <div className="p-6 bg-white rounded-xl shadow-2xl transition duration-300 transform hover:scale-[1.01]">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-gray-700 flex items-center">
                                <User className="w-5 h-5 mr-2" /> Mi Cuenta
                            </h2>
                            <span className={`px-3 py-1 text-sm font-bold rounded-full ${color} bg-opacity-20`}>
                                {name}
                            </span>
                        </div>

                        {/* Contenedor de Estrellas */}
                        <div className="flex flex-col items-center justify-center p-6 mb-4 rounded-lg bg-gray-50 border border-gray-200">
                            <Star className={`w-12 h-12 mb-2 ${color} fill-current`} />
                            <p className="text-5xl font-extrabold text-gray-800">{currentStars}</p>
                            <p className="text-sm font-medium text-gray-500">
                                {businessConfig.icon.type.name === 'Coffee' ? 'Cafés' : 'Puntos'} Acumulados
                            </p>
                        </div>

                        {/* Barra de Progreso */}
                        {nextLevel && (
                            <div className="mt-4">
                                <p className="text-sm font-medium text-gray-600 mb-1 flex justify-between">
                                    <span>Faltan **{nextStars}** {businessConfig.icon.type.name === 'Coffee' ? 'cafés' : 'puntos'} para Nivel **{nextLevel.name}**</span>
                                    <span className='font-bold'>{Math.round(progress)}%</span>
                                </p>
                                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                                    <div 
                                        className={`h-2.5 rounded-full ${businessConfig.primaryColor.split(' ')[0]} transition-all duration-500`} 
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}
                        
                        {!nextLevel && (
                             <div className="mt-4 p-3 bg-green-100 text-green-700 rounded-lg text-center font-semibold">
                                 ¡Felicidades! Has alcanzado el nivel máximo ({name}).
                             </div>
                        )}
                    </div>
                )}

                {currentTab === 'rewards' && (
                    <div className="p-6 bg-white rounded-xl shadow-2xl">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                            <Star className="w-6 h-6 mr-2 text-yellow-500" /> Mis Recompensas
                        </h2>
                        <div className="space-y-4">
                            {[...businessConfig.levels].sort((a, b) => a.stars - b.stars).map((level, index) => (
                                <div 
                                    key={index}
                                    className={`p-4 rounded-lg border-l-4 transition duration-200 ${currentStars >= level.stars ? 'border-green-500 bg-green-50 shadow-md' : 'border-gray-300 bg-gray-100'}`}
                                >
                                    <p className="font-extrabold text-lg text-gray-800">{level.name} ({level.stars} Puntos)</p>
                                    <p className="text-gray-600 mt-1 italic">{level.reward}</p>
                                    {currentStars >= level.stars ? (
                                        <span className="text-sm font-semibold text-green-600 mt-2 block flex items-center">
                                            <Star className='w-4 h-4 mr-1 fill-current'/> ¡RECOMPENSA ACTIVA!
                                        </span>
                                    ) : (
                                        <span className="text-sm font-semibold text-gray-500 mt-2 block">
                                            Necesitas {level.stars - currentStars} puntos más.
                                        </span>
                                    )}
                                </div>
                            ))}
                            
                        </div>
                    </div>
                )}

                {currentTab === 'scan' && (
                    <div className="p-6 bg-white rounded-xl shadow-2xl flex flex-col items-center text-center">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                            <QrCode className="w-6 h-6 mr-2" /> Muestra tu Tarjeta
                        </h2>
                        <p className="text-gray-600 mb-6">Muestra este código al empleado para acumular puntos o canjear recompensas.</p>
                        
                        {/* Generación del QR */}
                        <div className="p-4 border-4 border-gray-200 rounded-xl bg-white shadow-inner">
                            <img src={qrImageURL} alt="Código QR de Lealtad" className="w-60 h-60" onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/250x250/AAAAAA/FFFFFF?text=Error+al+cargar+QR"; }}/>
                        </div>

                        <p className="mt-4 text-sm font-mono text-gray-500 break-all">ID Cliente: {userId}</p>
                    </div>
                )}
            </div>

            {/* Barra de Navegación Inferior */}
            <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t-2 border-gray-100 shadow-2xl rounded-t-xl z-10">
                <div className="flex justify-around items-center h-16">
                    <button 
                        className={`flex flex-col items-center p-2 transition duration-200 ${currentTab === 'card' ? `${businessConfig.theme} font-bold` : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setCurrentTab('card')}
                    >
                        <User className="w-6 h-6" />
                        <span className="text-xs">Tarjeta</span>
                    </button>
                    <button 
                        className={`flex flex-col items-center p-2 transition duration-200 ${currentTab === 'rewards' ? `${businessConfig.theme} font-bold` : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setCurrentTab('rewards')}
                    >
                        <Star className="w-6 h-6" />
                        <span className="text-xs">Premios</span>
                    </button>
                    <button 
                        className={`flex flex-col items-center p-2 transition duration-200 ${currentTab === 'scan' ? `${businessConfig.theme} font-bold` : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setCurrentTab('scan')}
                    >
                        <QrCode className="w-6 h-6" />
                        <span className="text-xs">Mi QR</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * Vista de Administración (Para Empleados/Dueños)
 */
const AdminView = ({ businessId, businessConfig }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [pin, setPin] = useState('');
    const [scanData, setScanData] = useState(''); // Contenido simulado del QR
    const [customerStars, setCustomerStars] = useState(null);
    const [customerUserId, setCustomerUserId] = useState(null);
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);

    // --- LÓGICA DE FIREBASE PARA EL ADMIN ---

    /**
     * EFECTO: Suscribe/Cancela la escucha de Firestore cuando customerUserId cambia.
     */
    useEffect(() => {
        if (!customerUserId) {
            // No hay cliente seleccionado, no hay listener.
            setCustomerStars(null);
            return;
        }

        // 1. Mostrar estado de búsqueda
        setLoading(true);
        setMessage(null);

        // 2. Referencia a la base de datos (Colección: customers dentro del negocio)
        const customerRef = doc(db, 'artifacts', appId, 'public', 'data', businessId, 'customers', customerUserId);

        // 3. Establecer Listener en tiempo real (onSnapshot)
        const unsubscribe = onSnapshot(customerRef, (docSnap) => {
            setLoading(false);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setCustomerStars(data.stars || 0);
                setMessage({ type: 'success', text: `Cliente ${customerUserId.substring(0, 8)}... encontrado. Puntos actuales: ${data.stars || 0}.` });
            } else {
                // Cliente nuevo o no encontrado
                setCustomerStars(0); 
                setMessage({ type: 'info', text: `Cliente ${customerUserId.substring(0, 8)}... no tiene registro en este negocio. Inicializando con 0 puntos.` });
            }
        }, (error) => {
            setLoading(false);
            console.error("Firestore Snapshot Error:", error);
            setMessage({ type: 'error', text: `Error al conectar con la base de datos: ${error.message}` });
        });

        // 4. FUNCIÓN DE LIMPIEZA: Cancela el listener cuando el componente se desmonta o customerUserId cambia.
        return () => {
            unsubscribe();
            // console.log(`Listener cancelado para: ${customerUserId}`);
        };
    }, [customerUserId, businessId]); // Depende del ID del cliente y del negocio

    // Lógica para añadir/restar puntos
    const handleUpdateStar = async (amount) => {
        if (!customerUserId) {
            setMessage({ type: 'error', text: 'Primero escanea un ID de cliente válido.' });
            return;
        }

        setLoading(true);
        try {
            // Referencia a la base de datos
            const customerRef = doc(db, 'artifacts', appId, 'public', 'data', businessId, 'customers', customerUserId);
            
            // Calculamos las nuevas estrellas. Nos aseguramos de que no sean negativas.
            const current = customerStars !== null ? customerStars : 0;
            const newStars = Math.max(0, current + amount);

            // Actualizamos el documento. Si no existe, lo crea (setDoc con merge: true)
            await setDoc(customerRef, {
                stars: newStars,
                lastVisit: new Date().toISOString(),
                businessId: businessId // Aseguramos que el documento tenga el ID del negocio
            }, { merge: true });

            // El onSnapshot se encarga de actualizar el estado de las estrellas automáticamente
            setMessage({ type: 'success', text: `¡${amount > 0 ? 'Punto(s) añadido(s)' : 'Punto(s) restado(s)'}! El cliente ahora tiene ${newStars} puntos.` });
        } catch (error) {
            console.error("Error updating stars:", error);
            setMessage({ type: 'error', text: `Error al actualizar los puntos: ${error.message}` });
        } finally {
            setLoading(false);
        }
    };


    // --- LÓGICA DE UI Y AUTENTICACIÓN ---

    const handlePinSubmit = () => {
        if (pin === ADMIN_PIN_CODE) {
            setIsAuthenticated(true);
        } else {
            setMessage({ type: 'error', text: 'PIN incorrecto. Intenta de nuevo.' });
            setPin('');
        }
    };

    // Función para simular el escaneo del QR (ahora solo extrae y establece el ID del cliente)
    const handleScanSubmit = () => {
        // Formato esperado: businessId/userId
        const parts = scanData.split('/');
        
        // Limpiar el estado del cliente anterior
        setCustomerUserId(null); 
        setCustomerStars(null);

        if (parts.length === 2 && parts[0] === businessId) {
            const userIdFromQR = parts[1];
            // Al establecer customerUserId, el useEffect se activa y establece el listener.
            setCustomerUserId(userIdFromQR); 
        } else {
            setMessage({ type: 'error', text: 'El formato de QR es incorrecto o no pertenece a este negocio.' });
        }
    };

    // --- RENDERIZADO ---

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-100 font-inter">
                <div className="p-8 bg-white rounded-xl shadow-2xl w-full max-w-sm text-center">
                    <Lock className="w-10 h-10 mx-auto mb-4 text-red-600" />
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">Panel de Admin - {businessConfig.name}</h2>
                    <input
                        type="password"
                        placeholder="Ingresa PIN de 4 dígitos"
                        className="w-full p-3 mb-4 text-center text-xl tracking-widest border-2 border-gray-300 rounded-lg focus:border-red-500 outline-none transition duration-150"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                        maxLength={4}
                    />
                    <button
                        className="w-full p-3 font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition duration-150 shadow-md"
                        onClick={handlePinSubmit}
                    >
                        Ingresar
                    </button>
                    {message && <div className="mt-4"><Alert message={message.text} type={message.type} /></div>}
                </div>
            </div>
        );
    }

    const levelInfo = getLevelInfo(customerStars || 0, businessConfig.levels);

    return (
        <div className="flex flex-col min-h-screen p-4 bg-gray-100 font-inter">
            {/* Encabezado Admin */}
            <div className="p-4 rounded-xl shadow-lg mb-6 bg-red-600 text-white">
                <h1 className="text-2xl font-extrabold flex items-center">
                    <LogIn className="w-6 h-6 mr-2" /> {businessConfig.name} - Admin
                </h1>
                <p className="mt-1 text-sm opacity-90">Añade o resta puntos de lealtad.</p>
            </div>

            {/* Paso 1: Escanear ID */}
            <div className="p-6 bg-white rounded-xl shadow-2xl mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">1. Escanear Tarjeta (Simulación)</h2>
                <input
                    type="text"
                    placeholder={`Ej: ${businessId}/${crypto.randomUUID().substring(0, 8)}...`}
                    className="w-full p-3 mb-3 border border-gray-300 rounded-lg focus:border-red-500 outline-none transition duration-150"
                    value={scanData}
                    onChange={(e) => setScanData(e.target.value)}
                />
                <button
                    className="w-full p-3 font-semibold text-white bg-green-500 rounded-lg hover:bg-green-600 transition duration-150 shadow-md flex items-center justify-center"
                    onClick={handleScanSubmit}
                    disabled={loading}
                >
                    <QrCode className="w-5 h-5 mr-2" /> Buscar Cliente
                </button>
            </div>

            {/* Paso 2: Información y Puntos */}
            <div className="p-6 bg-white rounded-xl shadow-2xl flex-grow">
                <h2 className="text-xl font-bold text-gray-800 mb-4">2. Otorgar o Restar Puntos</h2>
                
                {message && <Alert message={message.text} type={message.type} />}

                {customerUserId && customerStars !== null && (
                    <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50 text-center">
                        <p className="font-semibold text-gray-700">Cliente Activo:</p>
                        <p className="text-xs font-mono break-all text-gray-500 mb-2">ID: {customerUserId}</p>
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${levelInfo.color} bg-opacity-20`}>
                            Nivel {levelInfo.name}
                        </span>
                        
                        <p className="text-4xl font-extrabold mt-3 flex items-center justify-center text-gray-800">
                            {customerStars}
                            <Star className="w-6 h-6 ml-2 text-yellow-500 fill-current" />
                        </p>
                        <p className="text-sm font-medium text-gray-500">Puntos actuales</p>

                        <div className='flex space-x-2 mt-4'>
                             <button
                                className={`flex-1 p-3 font-extrabold text-white rounded-lg transition duration-150 shadow-md flex items-center justify-center ${businessConfig.primaryColor}`}
                                onClick={() => handleUpdateStar(1)}
                                disabled={loading}
                            >
                                +1 {businessConfig.icon.type.name === 'Coffee' ? 'Café' : 'Punto'}
                            </button>
                            <button
                                className='w-1/4 p-3 font-extrabold text-gray-700 bg-red-200 rounded-lg hover:bg-red-300 transition duration-150 shadow-md flex items-center justify-center'
                                onClick={() => handleUpdateStar(-1)}
                                disabled={loading || customerStars === 0}
                            >
                                -1
                            </button>
                        </div>
                       
                        <p className="mt-3 text-xs text-center text-gray-500">
                            Usa **+1** para una compra, **-1** para canjear un punto.
                        </p>
                    </div>
                )}
                
                {customerUserId && customerStars === null && (
                     <div className='text-center p-8 bg-gray-50 rounded-lg'>
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-600 mx-auto"></div>
                        <p className="mt-3 text-gray-600">Buscando datos del cliente...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// -----------------------------------------------------
// COMPONENTE PRINCIPAL DE LA APP (Routing y Auth)
// -----------------------------------------------------

export default function App() {
    const [userId, setUserId] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    // 1. Lógica de Routing: Extraer el ID del Negocio y la Vista
    const path = window.location.pathname; // ej: /coffee-star/admin
    const pathParts = path.split('/').filter(p => p); // ej: ['coffee-star', 'admin']
    
    // El ID del negocio es la primera parte de la URL
    const businessId = pathParts[0] || 'coffee-star'; // Default a 'coffee-star'
    const isOwnerView = pathParts.length > 1 && pathParts[1] === 'admin';

    // Obtener la configuración del negocio o un fallback
    const businessConfig = BUSINESS_CONFIG[businessId] || BUSINESS_CONFIG['coffee-star'];

    // 2. Lógica de Autenticación y Carga de Datos
    useEffect(() => {
        // Inicializar Auth con el token de Canvas o anónimamente
        const initializeAuth = async () => {
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (err) {
                console.error("Firebase Auth Error:", err);
                setError("Error de autenticación. Verifica las reglas de seguridad.");
            }
        };

        initializeAuth();

        // Escucha el cambio de estado de autenticación
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserId(user.uid);
            } else {
                // Si la autenticación falla, usamos un ID temporal (aunque Firestore requerirá Auth)
                setUserId(crypto.randomUUID()); 
            }
            setIsAuthReady(true);
            setLoading(false);
        });

        return () => {
            unsubscribeAuth();
        };
    }, []);

    // 3. Lógica de Carga de Datos del Cliente (Solo si NO es la vista de Admin)
    useEffect(() => {
        if (!isAuthReady || isOwnerView || !userId) return; // No cargar datos si es vista de Admin o no hay userId

        let unsubscribeSnapshot = () => {};
        
        // La referencia al documento ahora incluye el ID del negocio.
        // La colección de clientes es pública, pero por seguridad se anida bajo el businessId
        const customerRef = doc(db, 'artifacts', appId, 'public', 'data', businessId, 'customers', userId);

        // Iniciar listener en tiempo real (onSnapshot)
        unsubscribeSnapshot = onSnapshot(customerRef, (docSnap) => {
            if (docSnap.exists()) {
                setUserData(docSnap.data());
            } else {
                // Inicializar datos para nuevos usuarios
                setUserData({ stars: 0, level: 'Novato', businessId: businessId });
                // El documento se creará en Firestore cuando el admin añada el primer punto.
            }
        }, (err) => {
            console.error("Firestore Snapshot Error:", err);
            setError("Error al cargar datos del cliente.");
        });
        
        return () => unsubscribeSnapshot();
    }, [isAuthReady, userId, businessId, isOwnerView]);


    // 4. Renderizado Principal

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 font-inter">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-yellow-600"></div>
                <p className="ml-4 text-gray-600 mt-4 font-semibold">Cargando LoyalTap...</p>
            </div>
        );
    }
    
    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-red-100 p-4 font-inter">
                <div className="text-red-700 text-center p-6 bg-white rounded-xl shadow-lg border border-red-300">
                    <h1 className="text-xl font-bold flex items-center justify-center"><AlertTriangle className='w-5 h-5 mr-2'/> Error Crítico</h1>
                    <p className="mt-2">{error}</p>
                    <p className="mt-4 text-sm font-mono break-all text-gray-600">Negocio Solicitado: **{businessId}**</p>
                    <p className="text-xs mt-2 text-gray-500">Revisa tu conexión a Internet o la configuración de Firebase.</p>
                </div>
            </div>
        );
    }

    // 5. Selección de Vista (Routing)

    if (isOwnerView) {
        // En AdminView, la actualización de puntos se maneja internamente usando handleUpdateStar
        return <AdminView businessId={businessId} businessConfig={businessConfig} />;
    }

    // Vista de Cliente
    return (
        <CustomerView 
            userId={userId} 
            userData={userData} 
            businessId={businessId} 
            businessConfig={businessConfig}
        />
    );
}