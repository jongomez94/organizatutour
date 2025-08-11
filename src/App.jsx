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

  // Colecciones en tiempo real
  const [vehiculos, setVehiculos] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [microbus, setMicrobus] = useState(null);
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

  // Traer microbus en tiempo real (vehículos tipo "renta")
  useEffect(() => {
    const q = query(
      collection(db, "vehiculos"), 
      where("tipoVehiculo", "==", "renta"),
      orderBy("createdAt", "asc")
    );
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        if (snapshot.docs.length > 0) {
          const microbusData = {
            id: snapshot.docs[0].id,
            ...snapshot.docs[0].data()
          };
          setMicrobus(microbusData);
        } else {
          setMicrobus(null);
        }
      },
      (error) => {
        console.error("❌ Error en listener de microbus:", error);
        setMicrobus(null);
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
  const handleOfrecerVehiculo = async (e) => {
    e.preventDefault();
    if (!requireName()) return;
    if (!puntoEncuentro) {
      alert("Por favor, selecciona un punto de encuentro.");
      return;
    }

    setIsLoading(true);
    try {
      const docRef = await addDoc(collection(db, "vehiculos"), {
        propietario: nombreUsuario.trim(),
        asientosDisponibles: Number(asientosDisponibles),
        puntoEncuentro: puntoEncuentro,
        tipoVehiculo: tipoVehiculo,
        createdAt: serverTimestamp(),
      });
      
      console.log("✅ Vehículo agregado exitosamente:", docRef.id);
      setActiveModule(null);
      setAsientosDisponibles(4);
      setPuntoEncuentro("");
      setTipoVehiculo("propio");
    } catch (error) {
      console.error("❌ Error al agregar vehículo:", error);
      alert("Error al agregar vehículo. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  // Acciones para Módulo 2: Reservar asiento
  const handleReservarAsiento = async (vehiculoId, propietario) => {
    if (!requireName()) return;
    
    // Verificar si ya tiene una reserva en este vehículo
    const reservaExistente = reservas.find(r => 
      r.vehiculoId === vehiculoId && r.pasajero.toLowerCase() === nombreUsuario.trim().toLowerCase()
    );
    
    if (reservaExistente) {
      alert("Ya tienes una reserva en este vehículo.");
      return;
    }

    setIsLoading(true);
    try {
      await addDoc(collection(db, "reservas"), {
        vehiculoId: vehiculoId,
        pasajero: nombreUsuario.trim(),
        propietario: propietario,
        createdAt: serverTimestamp(),
      });
      
      console.log("✅ Asiento reservado exitosamente");
      setActiveModule(null);
    } catch (error) {
      console.error("❌ Error al reservar asiento:", error);
      alert("Error al reservar asiento. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  // Acciones para Módulo 3: Reservar microbus
  const handleReservarMicrobus = async () => {
    if (!requireName()) return;
    
    if (!microbus) {
      alert("No hay microbus disponible en este momento.");
      return;
    }

    // Verificar si ya tiene una reserva en el microbus
    const reservaExistente = reservasMicrobus.find(r => 
      r.pasajero.toLowerCase() === nombreUsuario.trim().toLowerCase()
    );
    
    if (reservaExistente) {
      alert("Ya tienes una reserva en el microbus.");
      return;
    }

    const asientosOcupados = reservasMicrobus.length;
    if (asientosOcupados >= microbus.asientosDisponibles) {
      alert("El microbus está lleno.");
      return;
    }

    setIsLoading(true);
    try {
      await addDoc(collection(db, "reservasMicrobus"), {
        vehiculoId: microbus.id,
        pasajero: nombreUsuario.trim(),
        propietario: microbus.propietario,
        createdAt: serverTimestamp(),
      });
      
      console.log("✅ Asiento en microbus reservado exitosamente");
      setActiveModule(null);
    } catch (error) {
      console.error("❌ Error al reservar asiento en microbus:", error);
      alert("Error al reservar asiento. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
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
                          onClick={() => handleReservarAsiento(vehiculo.id, vehiculo.propietario)}
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

            {!microbus ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🚌</div>
                <p className="text-gray-500 text-lg">No hay microbus disponible</p>
                <p className="text-gray-400 text-sm mt-2">El microbus aún no ha sido configurado</p>
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

                 <div className="border border-gray-200 rounded-2xl p-6">
                   <div className="flex items-start justify-between mb-4">
                     <div>
                       <h3 className="font-semibold text-gray-800">Microbus Rentado</h3>
                       <p className="text-sm text-gray-600">Organizado por: {microbus.propietario}</p>
                       <p className="text-sm text-gray-600">Punto de encuentro: {microbus.puntoEncuentro}</p>
                     </div>
                     <div className="text-right">
                       <div className="text-lg font-semibold text-emerald-600">
                         {microbus.asientosDisponibles - reservasMicrobus.length}/{microbus.asientosDisponibles}
                       </div>
                       <div className="text-xs text-gray-500">asientos libres</div>
                     </div>
                   </div>

                  {reservasMicrobus.length < microbus.asientosDisponibles ? (
                    <button
                      onClick={handleReservarMicrobus}
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

                  {reservasMicrobus.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-600 mb-2">Pasajeros confirmados:</p>
                      <div className="space-y-1">
                        {reservasMicrobus.map((reserva) => (
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
              </div>
            )}
          </section>
        )}

        {/* Pie de página */}
        <footer className="mt-8 text-center text-sm text-gray-500">
          <p>✨ Actualizaciones en tiempo real con Firebase</p>
        </footer>
      </div>
    </div>
  );
}
