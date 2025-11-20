import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { QrCode, LogIn, Star, Coffee, User, Lock, Send } from 'lucide-react';

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
 * @returns {{name: string, color: string, reward: string}}
 */
const getLevelInfo = (stars, configLevels) => {
    // Buscar el nivel más alto que el usuario ha alcanzado
    const sortedLevels = [...configLevels].sort((a, b) => b.stars - a.stars);
    
    for (const level of sortedLevels) {
        if (stars >= level.stars) {
            return {
                name: level.name,
                color: level.color,
                reward: level.reward,
                nextStars: 0 // No hay más niveles
            };
        }
    }
    
    // Si no tiene el primer nivel, buscamos cuántas faltan para el primero
    const firstLevelStars = configLevels.length > 0 ? configLevels[configLevels.length - 1].stars : 5;
    const remaining = firstLevelStars - stars;

    return {
        name: 'Novato',
        color: 'text-gray-500',
        reward: 'Sube de nivel para desbloquear grandes recompensas.',
        nextStars: remaining > 0 ? remaining : 0
    };
};

/**
 * Componente para mostrar mensajes de error/éxito
 */
const Alert = ({ message, type }) => {
    const baseClasses = "p-4 mb-4 text-sm rounded-lg";
    let typeClasses = "";

    if (type === 'error') {
        typeClasses = "bg-red-100 text-red-700";
    } else if (type === 'success') {
        typeClasses = "bg-green-100 text-green-700";
    } else {
        typeClasses = "bg-blue-100 text-blue-700";
    }

    return (
        <div className={`${baseClasses} ${typeClasses}`} role="alert">
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
const CustomerView = ({ userId, userData, businessId, businessConfig, updateStars }) => {
    const [currentTab, setCurrentTab] = useState('card'); // 'card', 'rewards', 'scan'
    const currentStars = userData.stars || 0;
    const levelInfo = getLevelInfo(currentStars, businessConfig.levels);
    const { name, color, reward, nextStars } = levelInfo;

    // Calculamos el progreso para la barra (para el siguiente nivel)
    const sortedLevels = [...businessConfig.levels].sort((a, b) => a.stars - b.stars);
    const nextLevel = sortedLevels.find(l => l.stars > currentStars);
    
    let progress = 0;
    let target = 0;
    
    if (nextLevel) {
        const previousLevel = sortedLevels.slice().reverse().find(l => l.stars <= currentStars) || { stars: 0 };
        target = nextLevel.stars;
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
        <div className="flex flex-col min-h-screen p-4 pb-20 bg-gray-50">
            {/* Encabezado */}
            <div className={`p-4 rounded-lg shadow-md mb-6 ${businessConfig.primaryColor} text-white`}>
                <div className="flex items-center space-x-3">
                    {businessConfig.icon}
                    <h1 className="text-2xl font-extrabold">{businessConfig.name}</h1>
                </div>
                <p className="mt-1 text-sm opacity-90">Tu tarjeta de lealtad digital.</p>
            </div>

            {/* Contenido Principal */}
            <div className="flex-grow">
                {currentTab === 'card' && (
                    <div className="p-6 bg-white rounded-xl shadow-2xl">
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
                            <p className="text-4xl font-extrabold text-gray-800">{currentStars}</p>
                            <p className="text-sm font-medium text-gray-500">
                                {businessConfig.levels.length > 0 ? businessConfig.icon.type.name : 'Puntos'} Acumulados
                            </p>
                        </div>

                        {/* Barra de Progreso */}
                        {nextLevel && (
                            <div className="mt-4">
                                <p className="text-sm font-medium text-gray-600 mb-1">
                                    Faltan {nextStars} {businessConfig.icon.type.name} para Nivel {nextLevel.name}
                                </p>
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div 
                                        className={`h-2.5 rounded-full ${businessConfig.primaryColor.split(' ')[0]}`} 
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
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
                            {businessConfig.levels.map((level, index) => (
                                <div 
                                    key={index}
                                    className={`p-4 rounded-lg border-l-4 ${currentStars >= level.stars ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-100'}`}
                                >
                                    <p className="font-bold text-lg text-gray-800">{level.name} ({level.stars} Puntos)</p>
                                    <p className="text-gray-600 mt-1">{level.reward}</p>
                                    {currentStars >= level.stars && (
                                        <span className="text-sm font-semibold text-green-600 mt-2 block">¡Desbloqueado!</span>
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
                        <div className="p-4 border-4 border-gray-200 rounded-lg bg-white shadow-inner">
                            <img src={qrImageURL} alt="Código QR de Lealtad" className="w-56 h-56" onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/250x250/AAAAAA/FFFFFF?text=QR+Error"; }}/>
                        </div>

                        <p className="mt-4 text-sm font-mono text-gray-500 break-all">ID Cliente: {userId.substring(0, 12)}...</p>
                    </div>
                )}
            </div>

            {/* Barra de Navegación Inferior */}
            <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 shadow-xl rounded-t-xl">
                <div className="flex justify-around items-center h-16">
                    <button 
                        className={`flex flex-col items-center p-2 rounded-lg ${currentTab === 'card' ? businessConfig.theme : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setCurrentTab('card')}
                    >
                        <User className="w-6 h-6" />
                        <span className="text-xs">Tarjeta</span>
                    </button>
                    <button 
                        className={`flex flex-col items-center p-2 rounded-lg ${currentTab === 'rewards' ? businessConfig.theme : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setCurrentTab('rewards')}
                    >
                        <Star className="w-6 h-6" />
                        <span className="text-xs">Premios</span>
                    </button>
                    <button 
                        className={`flex flex-col items-center p-2 rounded-lg ${currentTab === 'scan' ? businessConfig.theme : 'text-gray-500 hover:text-gray-700'}`}
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
const AdminView = ({ businessId, businessConfig, updateStars }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [pin, setPin] = useState('');
    const [scanData, setScanData] = useState(''); // Usaría un scanner de verdad aquí, pero simulamos la entrada
    const [customerStars, setCustomerStars] = useState(null);
    const [customerUserId, setCustomerUserId] = useState(null);
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);

    // --- LÓGICA DE FIREBASE PARA EL ADMIN ---

    /**
     * Busca la data del cliente por su ID y establece el listener.
     * @param {string} cId - ID del cliente.
     */
    const fetchCustomerData = useCallback((cId) => {
        if (!cId) return;

        // Referencia a la base de datos (Colección: customers dentro del negocio)
        const customerRef = doc(db, 'artifacts', appId, 'public', 'data', businessId, 'customers', cId);

        setLoading(true);
        setMessage(null);
        setCustomerUserId(cId);

        // Listener en tiempo real (onSnapshot)
        const unsubscribe = onSnapshot(customerRef, (docSnap) => {
            setLoading(false);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setCustomerStars(data.stars || 0);
                setMessage({ type: 'success', text: `Cliente ${cId.substring(0, 8)}... encontrado. Puntos actuales: ${data.stars || 0}.` });
            } else {
                setCustomerStars(0); // Cliente nuevo o no encontrado
                setMessage({ type: 'error', text: `Cliente ${cId.substring(0, 8)}... no encontrado en este negocio. Inicializando con 0 puntos.` });
            }
        }, (error) => {
            setLoading(false);
            setMessage({ type: 'error', text: `Error al conectar con la base de datos: ${error.message}` });
        });

        // Retornar la función de limpieza
        return unsubscribe;
    }, [businessId]);

    // Lógica para añadir un punto
    const handleAddStar = async (amount = 1) => {
        if (!customerUserId) {
            setMessage({ type: 'error', text: 'Primero escanea un ID de cliente válido.' });
            return;
        }

        setLoading(true);
        try {
            // Referencia a la base de datos
            const customerRef = doc(db, 'artifacts', appId, 'public', 'data', businessId, 'customers', customerUserId);
            
            // Calculamos las nuevas estrellas
            const newStars = (customerStars || 0) + amount;

            // Actualizamos el documento. Si no existe, lo crea (setDoc con merge: true)
            await setDoc(customerRef, {
                stars: newStars,
                lastVisit: new Date().toISOString(),
            }, { merge: true }); // Usamos merge: true para no borrar otros campos

            setMessage({ type: 'success', text: `¡Punto añadido! El cliente ahora tiene ${newStars} puntos.` });
            // onSnapshot se encargará de actualizar customerStars automáticamente
        } catch (error) {
            console.error("Error adding star:", error);
            setMessage({ type: 'error', text: `Error al añadir el punto: ${error.message}` });
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

    // Función para simular el escaneo del QR (en la vida real, se usaría un lector de códigos QR)
    const handleScanSubmit = () => {
        // En el QR del cliente el contenido es: businessId/userId
        const parts = scanData.split('/');
        
        if (parts.length === 2 && parts[0] === businessId) {
            const userIdFromQR = parts[1];
            // Si el ID del negocio coincide, buscamos al cliente
            fetchCustomerData(userIdFromQR);
        } else {
            setMessage({ type: 'error', text: 'El formato de QR es incorrecto o no pertenece a este negocio.' });
        }
    };

    // --- RENDERIZADO ---

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
                <div className="p-8 bg-white rounded-xl shadow-2xl w-full max-w-sm text-center">
                    <Lock className="w-8 h-8 mx-auto mb-4 text-red-500" />
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">Panel de Admin - {businessConfig.name}</h2>
                    <input
                        type="password"
                        placeholder="Ingresa PIN de 4 dígitos"
                        className="w-full p-3 mb-4 text-center text-xl tracking-widest border-2 border-gray-300 rounded-lg focus:border-red-500 outline-none"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                        maxLength={4}
                    />
                    <button
                        className="w-full p-3 font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 transition duration-150"
                        onClick={handlePinSubmit}
                    >
                        Ingresar
                    </button>
                    {message && <Alert message={message.text} type={message.type} />}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen p-4 bg-gray-50">
            {/* Encabezado Admin */}
            <div className="p-4 rounded-lg shadow-md mb-6 bg-red-600 text-white">
                <h1 className="text-2xl font-extrabold flex items-center">
                    <LogIn className="w-6 h-6 mr-2" /> {businessConfig.name} - Admin
                </h1>
                <p className="mt-1 text-sm opacity-90">Añade puntos o canjea recompensas.</p>
            </div>

            {/* Paso 1: Escanear ID */}
            <div className="p-6 bg-white rounded-xl shadow-2xl mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">1. Escanear Tarjeta (Simulación)</h2>
                <input
                    type="text"
                    placeholder={`Ej: ${businessId}/${Math.random().toString(36).substring(2, 10)}...`}
                    className="w-full p-3 mb-3 border border-gray-300 rounded-lg focus:border-red-500 outline-none"
                    value={scanData}
                    onChange={(e) => setScanData(e.target.value)}
                />
                <button
                    className="w-full p-3 font-semibold text-white bg-green-500 rounded-lg hover:bg-green-600 transition duration-150 flex items-center justify-center"
                    onClick={handleScanSubmit}
                    disabled={loading}
                >
                    <QrCode className="w-5 h-5 mr-2" /> Buscar Cliente
                </button>
                {message && message.type !== 'error' && message.type !== 'success' && <Alert message={message.text} type={message.type} />}
            </div>

            {/* Paso 2: Información y Puntos */}
            <div className="p-6 bg-white rounded-xl shadow-2xl flex-grow">
                <h2 className="text-xl font-bold text-gray-800 mb-4">2. Otorgar Puntos</h2>
                
                {message && (message.type === 'error' || message.type === 'success') && <Alert message={message.text} type={message.type} />}

                {customerUserId && (
                    <div className="mt-4 p-4 border rounded-lg bg-gray-50">
                        <p className="font-semibold text-gray-700">Cliente Activo:</p>
                        <p className="text-sm font-mono break-all text-gray-500">{customerUserId}</p>
                        <p className="text-3xl font-extrabold mt-2 flex items-center text-gray-800">
                            {customerStars}
                            <Star className="w-6 h-6 ml-2 text-yellow-500 fill-current" />
                        </p>
                        <p className="text-sm font-medium text-gray-500">Puntos actuales del cliente</p>
                    </div>
                )}
                
                <button
                    className={`mt-6 w-full p-4 font-extrabold text-white rounded-lg transition duration-150 flex items-center justify-center ${customerUserId ? businessConfig.primaryColor : 'bg-gray-400 cursor-not-allowed'}`}
                    onClick={() => handleAddStar(1)}
                    disabled={loading || !customerUserId}
                >
                    {loading ? 'Añadiendo...' : `Añadir 1 ${businessConfig.icon.type.name}`}
                </button>
                <p className="mt-2 text-xs text-center text-gray-500">
                    Solo presiona esto después de una compra exitosa.
                </p>
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
                setUserId(crypto.randomUUID()); // Si la autenticación falla, usamos un ID temporal
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
        if (!isAuthReady || isOwnerView) return; // No cargar datos si es vista de Admin

        let unsubscribeSnapshot = () => {};
        
        if (userId) {
            // La referencia al documento ahora incluye el ID del negocio
            const customerRef = doc(db, 'artifacts', appId, 'public', 'data', businessId, 'customers', userId);

            // Iniciar listener en tiempo real (onSnapshot)
            unsubscribeSnapshot = onSnapshot(customerRef, (docSnap) => {
                if (docSnap.exists()) {
                    setUserData(docSnap.data());
                } else {
                    // Inicializar datos para nuevos usuarios
                    setUserData({ stars: 0, level: 'Novato', businessId: businessId });
                    // No creamos el documento aquí, lo hará la función updateStars cuando gane un punto.
                }
            }, (err) => {
                console.error("Firestore Snapshot Error:", err);
                setError("Error al cargar datos del cliente.");
            });
        }
        
        return () => unsubscribeSnapshot();
    }, [isAuthReady, userId, businessId, isOwnerView]);

    // 4. Función para actualizar estrellas (Usada por ambos, pero el Admin la usa con el ID del cliente)
    const updateStars = useCallback(async (newStars, targetUserId = userId) => {
        if (!isAuthReady || !targetUserId) return;

        try {
            // La referencia al documento ahora incluye el ID del negocio
            const customerRef = doc(db, 'artifacts', appId, 'public', 'data', businessId, 'customers', targetUserId);
            
            // Usamos setDoc con merge: true para crear/actualizar
            await setDoc(customerRef, {
                stars: newStars,
                lastVisit: new Date().toISOString(),
                businessId: businessId // Aseguramos que el documento tenga el ID del negocio
            }, { merge: true });

        } catch (err) {
            console.error("Error updating stars:", err);
            setError("Error al actualizar los puntos. ¿Reglas de seguridad de Firestore correctas?");
        }
    }, [isAuthReady, userId, businessId]);


    // 5. Renderizado Principal

    if (loading || (!userData && !isOwnerView)) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-yellow-600"></div>
                <p className="ml-4 text-gray-600">Cargando LoyalTap...</p>
            </div>
        );
    }
    
    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-red-100 p-4">
                <div className="text-red-700 text-center">
                    <h1 className="text-xl font-bold">Error Crítico</h1>
                    <p className="mt-2">{error}</p>
                    <p className="mt-4 text-sm font-mono break-all">ID Negocio Solicitado: **{businessId}**</p>
                    <p className="text-xs mt-2">Revisa tu conexión a Internet o la configuración de Firebase.</p>
                </div>
            </div>
        );
    }

    // 6. Selección de Vista (Routing)

    if (isOwnerView) {
        return <AdminView businessId={businessId} businessConfig={businessConfig} updateStars={updateStars} />;
    }

    // Vista de Cliente
    return (
        <CustomerView 
            userId={userId} 
            userData={userData} 
            businessId={businessId} 
            businessConfig={businessConfig}
            updateStars={updateStars} 
        />
    );
}