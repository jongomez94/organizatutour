import React, { useEffect, useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Organización de Transporte – React + Firebase
 * ------------------------------------------------------------
 * Qué hace:
 * - Módulo 1: "Yo tengo un vehículo" - Ofrecer vehículo con asientos disponibles
 * - Módulo 2: "Quiero pedir ride" - Reservar asiento en vehículos disponibles
 * - Módulo 3: "Yo quiero ir en el microbus" - Reservar asiento en microbus rentado
 * - Todo se actualiza en tiempo real vía onSnapshot.
 *
 * Estructura de datos (Firestore):
 * - vehiculos/{autoId}                 { propietario, asientosDisponibles, puntoEncuentro, tipoVehiculo, createdAt }
 * - reservas/{autoId}                  { vehiculoId, pasajero, createdAt }
 * - microbus/{autoId}                  { propietario, asientosDisponibles, createdAt }
 * - reservasMicrobus/{autoId}          { pasajero, createdAt }
 */

// 1) Configuración de Firebase desde variables de entorno
const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Debug: Verificar que las variables de entorno se cargan correctamente
console.log("Firebase Config:", {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ? "✅ Cargada" : "❌ No encontrada",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? "✅ Cargada" : "❌ No encontrada",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ? "✅ Cargada" : "❌ No encontrada",
});

// 2) Inicializa Firebase (evita doble init en hot reload)
const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

// Componente principal
export default function App() {
  // Estados para módulos
  const [activeModule, setActiveModule] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(true);

  // Estados para formularios
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [asientosDisponibles, setAsientosDisponibles] = useState(4);
  const [puntoEncuentro, setPuntoEncuentro] = useState("");
  const [tipoVehiculo, setTipoVehiculo] = useState("propio");

  // Estados para confirmaciones
  const [showConfirmacion, setShowConfirmacion] = useState(false);
  const [confirmacionData, setConfirmacionData] = useState({});
  const [showExito, setShowExito] = useState(false);
  const [exitoData, setExitoData] = useState({});

  // Colecciones en tiempo real
  const [vehiculos, setVehiculos] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [microbuses, setMicrobus] = useState([]);
  const [reservasMicrobus, setReservasMicrobus] = useState([]);

  // Traer vehículos en tiempo real
  useEffect(() => {
    console.log("🔄 Iniciando listener de vehículos...");
    setIsLoadingList(true);
    
    const q = query(collection(db, "vehiculos"), orderBy("createdAt", "asc"));
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        console.log("📊 Vehículos recibidos:", snapshot.docs.length, "documentos");
        const vehiculosData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log("🚗 Vehículos procesados:", vehiculosData);
        setVehiculos(vehiculosData);
        setIsLoadingList(false);
      },
      (error) => {
        console.error("❌ Error en listener de vehículos:", error);
        setIsLoadingList(false);
      }
    );

    return unsubscribe;
  }, []);

  // Traer reservas en tiempo real
  useEffect(() => {
    const q = query(collection(db, "reservas"), orderBy("createdAt", "asc"));
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const reservasData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));
        setReservas(reservasData);
      },
      (error) => {
        console.error("❌ Error en listener de reservas:", error);
      }
    );

    return unsubscribe;
  }, []);

  // Traer microbuses en tiempo real (vehículos tipo "renta")
  useEffect(() => {
    const q = query(
      collection(db, "vehiculos"), 
      where("tipoVehiculo", "==", "renta"),
      orderBy("createdAt", "asc")
    );
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        if (snapshot.docs.length > 0) {
          const microbusesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setMicrobus(microbusesData);
        } else {
          setMicrobus([]);
        }
      },
      (error) => {
        console.error("❌ Error en listener de microbus:", error);
        setMicrobus([]);
      }
    );

    return unsubscribe;
  }, []);

  // Traer reservas de microbus en tiempo real
  useEffect(() => {
    const q = query(collection(db, "reservasMicrobus"), orderBy("createdAt", "asc"));
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const reservasData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));
        setReservasMicrobus(reservasData);
      },
      (error) => {
        console.error("❌ Error en listener de reservas microbus:", error);
      }
    );

    return unsubscribe;
  }, []);

  // Funciones auxiliares
  const requireName = () => {
    if (!nombreUsuario.trim()) {
      alert("Por favor, ingresa tu nombre y apellido.");
      return false;
    }
    return true;
  };

  // Acciones para Módulo 1: Ofrecer vehículo
  const handleOfrecerVehiculo = (e) => {
    e.preventDefault();
    if (!requireName()) return;
    if (!puntoEncuentro) {
      alert("Por favor, selecciona un punto de encuentro.");
      return;
    }

    // Mostrar resumen antes de confirmar
    const accion = tipoVehiculo === 'propio' ? 'ofrecer tu vehículo' : 'ofrecer tu microbus para renta';
    const resumen = tipoVehiculo === 'propio' 
      ? `ofrecer tu vehículo con ${asientosDisponibles} asientos disponibles desde ${puntoEncuentro}`
      : `ofrecer tu microbus para renta con ${asientosDisponibles} asientos disponibles desde ${puntoEncuentro}`;

    setConfirmacionData({
      titulo: `Confirmar ${tipoVehiculo === 'propio' ? 'Vehículo' : 'Microbus'}`,
      mensaje: `¿Estás seguro de que quieres ${resumen}?`,
      accion: 'ofrecerVehiculo',
      datos: {
        propietario: nombreUsuario.trim(),
        asientosDisponibles: Number(asientosDisponibles),
        puntoEncuentro: puntoEncuentro,
        tipoVehiculo: tipoVehiculo
      }
    });
    setShowConfirmacion(true);
  };

  const confirmarOfrecerVehiculo = async () => {
    setIsLoading(true);
    try {
      const docRef = await addDoc(collection(db, "vehiculos"), {
        ...confirmacionData.datos,
        createdAt: serverTimestamp(),
      });
      
      console.log("✅ Vehículo agregado exitosamente:", docRef.id);
      
      // Mostrar mensaje de éxito
      const mensajeExito = confirmacionData.datos.tipoVehiculo === 'propio'
        ? "Muchas gracias por poner tu vehículo a disposición. Ahora aparecerá en la sección de \"Quiero Pedir Ride\". Si deseas eliminarlo o editar el número de asientos habla con Jonathan, por favor."
        : "Muchas gracias por ofrecer tu microbus para la renta. Una vez que tengamos llenos los asientos te avisaremos para organizar los pagos.";

      setExitoData({
        titulo: "¡Vehículo registrado exitosamente!",
        mensaje: mensajeExito
      });
      setShowExito(true);
      
      setActiveModule(null);
      setAsientosDisponibles(4);
      setPuntoEncuentro("");
      setTipoVehiculo("propio");
    } catch (error) {
      console.error("❌ Error al agregar vehículo:", error);
      alert("Error al agregar vehículo. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
      setShowConfirmacion(false);
    }
  };

  // Acciones para Módulo 2: Reservar asiento
  const handleReservarAsiento = (vehiculoId, propietario, puntoEncuentro) => {
    if (!requireName()) return;
    
    // Verificar si ya tiene una reserva en este vehículo
    const reservaExistente = reservas.find(r => 
      r.vehiculoId === vehiculoId && r.pasajero.toLowerCase() === nombreUsuario.trim().toLowerCase()
    );
    
    if (reservaExistente) {
      alert("Ya tienes una reserva en este vehículo.");
      return;
    }

    // Mostrar resumen antes de confirmar
    setConfirmacionData({
      titulo: "Confirmar Reserva",
      mensaje: `Vas a reservar un espacio en el vehículo de "${propietario}", bajo el nombre de "${nombreUsuario.trim()}". Si necesitas cancelarlo o cambias de opinión, déjale saber a Jonathan.`,
      accion: 'reservarAsiento',
      datos: {
        vehiculoId: vehiculoId,
        pasajero: nombreUsuario.trim(),
        propietario: propietario,
        puntoEncuentro: puntoEncuentro
      }
    });
    setShowConfirmacion(true);
  };

  const confirmarReservarAsiento = async () => {
    setIsLoading(true);
    try {
      await addDoc(collection(db, "reservas"), {
        ...confirmacionData.datos,
        createdAt: serverTimestamp(),
      });
      
      console.log("✅ Asiento reservado exitosamente");
      
      setExitoData({
        titulo: "¡Reserva confirmada!",
        mensaje: `Has reservado exitosamente un asiento en el vehículo de ${confirmacionData.datos.propietario}. Te esperamos en ${confirmacionData.datos.puntoEncuentro}.`
      });
      setShowExito(true);
      
      setActiveModule(null);
    } catch (error) {
      console.error("❌ Error al reservar asiento:", error);
      alert("Error al reservar asiento. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
      setShowConfirmacion(false);
    }
  };

  // Acciones para Módulo 3: Reservar microbus
  const handleReservarMicrobus = (microbusId, propietario, asientosDisponibles, puntoEncuentro) => {
    if (!requireName()) return;
    
    if (!microbuses || microbuses.length === 0) {
      alert("No hay microbus disponible en este momento.");
      return;
    }

    // Verificar si ya tiene una reserva en este microbus específico
    const reservaExistente = reservasMicrobus.find(r => 
      r.vehiculoId === microbusId && r.pasajero.toLowerCase() === nombreUsuario.trim().toLowerCase()
    );
    
    if (reservaExistente) {
      alert("Ya tienes una reserva en este microbus.");
      return;
    }

    // Contar asientos ocupados en este microbus específico
    const asientosOcupados = reservasMicrobus.filter(r => r.vehiculoId === microbusId).length;
    if (asientosOcupados >= asientosDisponibles) {
      alert("Este microbus está lleno.");
      return;
    }

    // Mostrar resumen antes de confirmar
    setConfirmacionData({
      titulo: "Confirmar Reserva en Microbus",
      mensaje: `Vas a reservar un asiento en el microbus de "${propietario}" bajo el nombre de "${nombreUsuario.trim()}". Recuerda que el costo es de $15-$20 y solamente se confirmará si se llenan todos los asientos. Si necesitas cancelarlo o cambias de opinión, déjale saber a Jonathan.`,
      accion: 'reservarMicrobus',
      datos: {
        vehiculoId: microbusId,
        pasajero: nombreUsuario.trim(),
        propietario: propietario,
        asientosDisponibles: asientosDisponibles,
        puntoEncuentro: puntoEncuentro
      }
    });
    setShowConfirmacion(true);
  };

  const confirmarReservarMicrobus = async () => {
    setIsLoading(true);
    try {
      await addDoc(collection(db, "reservasMicrobus"), {
        vehiculoId: confirmacionData.datos.vehiculoId,
        pasajero: confirmacionData.datos.pasajero,
        propietario: confirmacionData.datos.propietario,
        createdAt: serverTimestamp(),
      });
      
      console.log("✅ Asiento en microbus reservado exitosamente");
      
      setExitoData({
        titulo: "¡Reserva en Microbus confirmada!",
        mensaje: `Has reservado exitosamente un asiento en el microbus de ${confirmacionData.datos.propietario}. Te esperamos en ${confirmacionData.datos.puntoEncuentro}. Recuerda que el costo es de $15-$20.`
      });
      setShowExito(true);
      
      setActiveModule(null);
    } catch (error) {
      console.error("❌ Error al reservar asiento en microbus:", error);
      alert("Error al reservar asiento. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
      setShowConfirmacion(false);
    }
  };

  // Función para obtener asientos ocupados de un vehículo
  const getAsientosOcupados = (vehiculoId) => {
    return reservas.filter(r => r.vehiculoId === vehiculoId).length;
  };

  // Función para cancelar reserva
  const handleCancelarReserva = async (reservaId, pasajero) => {
    if (pasajero.toLowerCase() !== nombreUsuario.trim().toLowerCase()) {
      alert("Solo puedes cancelar tu propia reserva.");
      return;
    }

    if (confirm("¿Estás seguro de que quieres cancelar tu reserva?")) {
      try {
        await deleteDoc(doc(db, "reservas", reservaId));
      } catch (error) {
        console.error("Error al cancelar reserva:", error);
        alert("Error al cancelar reserva. Intenta de nuevo.");
      }
    }
  };

  // Función para cancelar reserva de microbus
  const handleCancelarReservaMicrobus = async (reservaId, pasajero) => {
    if (pasajero.toLowerCase() !== nombreUsuario.trim().toLowerCase()) {
      alert("Solo puedes cancelar tu propia reserva.");
      return;
    }

    if (confirm("¿Estás seguro de que quieres cancelar tu reserva en el microbus?")) {
      try {
        await deleteDoc(doc(db, "reservasMicrobus", reservaId));
      } catch (error) {
        console.error("Error al cancelar reserva de microbus:", error);
        alert("Error al cancelar reserva. Intenta de nuevo.");
      }
    }
  };

  // Funciones para manejar confirmaciones
  const handleConfirmar = () => {
    switch (confirmacionData.accion) {
      case 'ofrecerVehiculo':
        confirmarOfrecerVehiculo();
        break;
      case 'reservarAsiento':
        confirmarReservarAsiento();
        break;
      case 'reservarMicrobus':
        confirmarReservarMicrobus();
        break;
      default:
        break;
    }
  };

  const handleCancelar = () => {
    setShowConfirmacion(false);
    setConfirmacionData({});
  };

  const handleCerrarExito = () => {
    setShowExito(false);
    setExitoData({});
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 text-gray-900">
      <div className="mx-auto max-w-6xl p-6">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-800 mb-2">
            🍄 Organización de Transporte 🍄
          </h1>
          <p className="text-lg text-gray-600">Organicemos el transporte</p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isLoadingList ? 'bg-yellow-400' : 'bg-green-400'}`}></div>
            <span className="text-xs text-gray-500">
              {isLoadingList ? 'Conectando...' : 'Conectado a Firebase'}
            </span>
          </div>
        </header>

        {/* Campo de nombre */}
        <section className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Tu Información</h2>
          
          {/* Instrucciones importantes */}
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl text-red-500">⚠️</div>
              <div>
                <h4 className="font-semibold text-red-800 mb-1">Importante</h4>
                <p className="text-sm text-red-700 leading-relaxed">
                  <strong>Usa siempre el mismo nombre y apellido de ahora en adelante.</strong> 
                  Esto es necesario para que puedas cancelar tus reservas y para que el sistema 
                  te reconozca correctamente.
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={nombreUsuario}
              onChange={(e) => setNombreUsuario(e.target.value)}
              placeholder="Tu nombre y apellido"
              className="flex-1 rounded-2xl border border-gray-300 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
            />
            <span className="text-xs text-gray-500 self-center">Se guarda localmente</span>
          </div>
        </section>

        {/* Módulos principales */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Módulo 1: Yo tengo un vehículo */}
          <button
            onClick={() => setActiveModule('ofrecer')}
            className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all text-left"
          >
            <div className="text-4xl mb-4">🚗</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Yo tengo un vehículo</h3>
            <p className="text-sm text-gray-600">Ofrece tu vehículo y especifica cuántos asientos tienes disponibles</p>
          </button>

          {/* Módulo 2: Quiero pedir ride */}
          <button
            onClick={() => setActiveModule('reservar')}
            className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all text-left"
          >
            <div className="text-4xl mb-4">🎫</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Quiero pedir ride</h3>
            <p className="text-sm text-gray-600">Reserva un asiento en los vehículos disponibles</p>
          </button>

          {/* Módulo 3: Yo quiero ir en el microbus */}
          <button
            onClick={() => setActiveModule('microbus')}
            className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all text-left"
          >
            <div className="text-4xl mb-4">🚌</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Yo quiero ir en el microbus</h3>
            <p className="text-sm text-gray-600">Reserva un asiento en el microbus rentado ($15-$20)</p>
          </button>
        </div>

        {/* Contenido dinámico según módulo activo */}
        {activeModule === 'ofrecer' && (
          <section className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Ofrecer Vehículo</h2>
              <button
                onClick={() => setActiveModule(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleOfrecerVehiculo} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de vehículo
                  </label>
                  <select
                    value={tipoVehiculo}
                    onChange={(e) => setTipoVehiculo(e.target.value)}
                    className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="propio">Mi propio vehículo</option>
                    <option value="renta">Renta de Microbus</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Asientos disponibles
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={asientosDisponibles}
                    onChange={(e) => setAsientosDisponibles(e.target.value)}
                    className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Punto de encuentro
                </label>
                <select
                  value={puntoEncuentro}
                  onChange={(e) => setPuntoEncuentro(e.target.value)}
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  <option value="">Selecciona un punto de encuentro</option>
                  <option value="Centro histórico">Centro histórico</option>
                  <option value="Salvador del Mundo">Salvador del Mundo</option>
                  <option value="Santa Tecla">Santa Tecla</option>
                  <option value="Metrocentro">Metrocentro</option>
                  <option value="Multiplaza">Multiplaza</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isLoading || !nombreUsuario.trim() || !puntoEncuentro}
                className={`w-full rounded-2xl px-6 py-3 text-base font-semibold text-white shadow transition-colors ${
                  isLoading || !nombreUsuario.trim() || !puntoEncuentro
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {isLoading ? "Agregando..." : "Ofrecer Vehículo"}
              </button>
            </form>
          </section>
        )}

        {activeModule === 'reservar' && (
          <section className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Vehículos Disponibles</h2>
              <button
                onClick={() => setActiveModule(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {(() => {
              const vehiculosPropios = vehiculos.filter(v => v.tipoVehiculo === 'propio');
              return vehiculosPropios.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🚗</div>
                  <p className="text-gray-500 text-lg">No hay vehículos propios disponibles</p>
                  <p className="text-gray-400 text-sm mt-2">Sé el primero en ofrecer tu vehículo</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {vehiculosPropios.map((vehiculo) => {
                  const asientosOcupados = getAsientosOcupados(vehiculo.id);
                  const asientosLibres = vehiculo.asientosDisponibles - asientosOcupados;
                  const reservasVehiculo = reservas.filter(r => r.vehiculoId === vehiculo.id);
                  
                  return (
                    <div key={vehiculo.id} className="border border-gray-200 rounded-2xl p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-800">{vehiculo.propietario}</h3>
                          <p className="text-sm text-gray-600">{vehiculo.puntoEncuentro}</p>
                          <p className="text-xs text-gray-500">
                            {vehiculo.tipoVehiculo === 'propio' ? 'Vehículo propio' : 'Microbus rentado'}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-emerald-600">
                            {asientosLibres}/{vehiculo.asientosDisponibles}
                          </div>
                          <div className="text-xs text-gray-500">asientos libres</div>
                        </div>
                      </div>

                      {asientosLibres > 0 ? (
                        <button
                          onClick={() => handleReservarAsiento(vehiculo.id, vehiculo.propietario, vehiculo.puntoEncuentro)}
                          disabled={isLoading || !nombreUsuario.trim()}
                          className={`w-full rounded-2xl px-4 py-2 text-sm font-semibold text-white shadow transition-colors ${
                            isLoading || !nombreUsuario.trim()
                              ? "bg-gray-300 cursor-not-allowed"
                              : "bg-emerald-600 hover:bg-emerald-700"
                          }`}
                        >
                          {isLoading ? "Reservando..." : "Reservar Asiento"}
                        </button>
                      ) : (
                        <div className="text-center text-sm text-gray-500 bg-gray-100 rounded-2xl px-4 py-2">
                          Vehículo lleno
                        </div>
                      )}

                      {reservasVehiculo.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm text-gray-600 mb-2">Pasajeros:</p>
                          <div className="space-y-1">
                            {reservasVehiculo.map((reserva) => (
                              <div key={reserva.id} className="flex items-center justify-between text-sm">
                                <span>{reserva.pasajero}</span>
                                {reserva.pasajero.toLowerCase() === nombreUsuario.trim().toLowerCase() && (
                                  <button
                                    onClick={() => handleCancelarReserva(reserva.id, reserva.pasajero)}
                                    className="text-red-500 hover:text-red-700 text-xs"
                                  >
                                    Cancelar
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )})()}
          </section>
        )}

        {activeModule === 'microbus' && (
          <section className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Microbus Rentado</h2>
              <button
                onClick={() => setActiveModule(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {microbuses.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🚌</div>
                <p className="text-gray-500 text-lg">No hay microbuses disponibles</p>
                <p className="text-gray-400 text-sm mt-2">Los microbuses aún no han sido configurados</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">⚠️</div>
                    <div>
                      <h4 className="font-semibold text-yellow-800 mb-1">Importante</h4>
                      <p className="text-sm text-yellow-700">
                        Solo reserva un asiento si estás dispuesto a pagar entre $15-$20 por tu lugar en el microbus.
                      </p>
                    </div>
                  </div>
                </div>

                {microbuses.map((microbus) => {
                  const reservasMicrobusEspecifico = reservasMicrobus.filter(r => r.vehiculoId === microbus.id);
                  const asientosOcupados = reservasMicrobusEspecifico.length;
                  const asientosLibres = microbus.asientosDisponibles - asientosOcupados;
                  
                  return (
                    <div key={microbus.id} className="border border-gray-200 rounded-2xl p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-800">Microbus Rentado</h3>
                          <p className="text-sm text-gray-600">Organizado por: {microbus.propietario}</p>
                          <p className="text-sm text-gray-600">Punto de encuentro: {microbus.puntoEncuentro}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-emerald-600">
                            {asientosLibres}/{microbus.asientosDisponibles}
                          </div>
                          <div className="text-xs text-gray-500">asientos libres</div>
                        </div>
                      </div>

                      {asientosLibres > 0 ? (
                        <button
                          onClick={() => handleReservarMicrobus(microbus.id, microbus.propietario, microbus.asientosDisponibles, microbus.puntoEncuentro)}
                          disabled={isLoading || !nombreUsuario.trim()}
                          className={`w-full rounded-2xl px-4 py-2 text-sm font-semibold text-white shadow transition-colors ${
                            isLoading || !nombreUsuario.trim()
                              ? "bg-gray-300 cursor-not-allowed"
                              : "bg-emerald-600 hover:bg-emerald-700"
                          }`}
                        >
                          {isLoading ? "Reservando..." : "Reservar Asiento en Microbus"}
                        </button>
                      ) : (
                        <div className="text-center text-sm text-gray-500 bg-gray-100 rounded-2xl px-4 py-2">
                          Microbus lleno
                        </div>
                      )}

                      {reservasMicrobusEspecifico.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm text-gray-600 mb-2">Pasajeros confirmados:</p>
                          <div className="space-y-1">
                            {reservasMicrobusEspecifico.map((reserva) => (
                              <div key={reserva.id} className="flex items-center justify-between text-sm">
                                <span>{reserva.pasajero}</span>
                                {reserva.pasajero.toLowerCase() === nombreUsuario.trim().toLowerCase() && (
                                  <button
                                    onClick={() => handleCancelarReservaMicrobus(reserva.id, reserva.pasajero)}
                                    className="text-red-500 hover:text-red-700 text-xs"
                                  >
                                    Cancelar
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Pie de página */}
        <footer className="mt-8 text-center text-sm text-gray-500">
          <p>✨ Actualizaciones en tiempo real con Firebase</p>
        </footer>

        {/* Modal de Confirmación */}
        {showConfirmacion && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl">
              <div className="text-center">
                <div className="text-4xl mb-4">🤔</div>
                <h3 className="text-xl font-semibold text-gray-800 mb-4">{confirmacionData.titulo}</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">{confirmacionData.mensaje}</p>
                
                <div className="flex gap-3">
                  <button
                    onClick={handleCancelar}
                    className="flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmar}
                    disabled={isLoading}
                    className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow transition-colors ${
                      isLoading ? "bg-gray-300 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                  >
                    {isLoading ? "Procesando..." : "Confirmar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Éxito */}
        {showExito && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl">
              <div className="text-center">
                <div className="text-4xl mb-4">✅</div>
                <h3 className="text-xl font-semibold text-gray-800 mb-4">{exitoData.titulo}</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">{exitoData.mensaje}</p>
                
                <button
                  onClick={handleCerrarExito}
                  className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow transition-colors"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
