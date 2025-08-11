import React, { useEffect, useMemo, useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  runTransaction,
  getDocs,
} from "firebase/firestore";

/**
 * FungiTour Webapp – MVP (React + Firebase)
 * ------------------------------------------------------------
 * Qué hace:
 * - Caja de nombre para "firmar" acciones.
 * - Botón "Ya hice la transferencia" → guarda tu firma en Firestore.
 * - Botón "Yo quiero ir en el micro rentado" → te anota en la lista del micro.
 * - Formulario "Yo tengo un vehículo y tengo X asientos" → crea un vehículo.
 * - Cada vehículo aparece como una tarjeta con asientos disponibles; otros pueden
 *   "apartar" asientos firmando con su nombre (con bloqueo transaccional).
 * - Todo se actualiza en tiempo real vía onSnapshot.
 *
 * Cómo usar:
 * 1) Crea un proyecto de Firebase y habilita Firestore.
 * 2) Reemplaza FIREBASE_CONFIG abajo con tus credenciales.
 * 3) Deploy en Vercel (o cualquier hosting estático) como una app de React.
 *
 * Estructura de datos (Firestore):
 * - tours/{tourId}
 *    ├─ payments/{autoId}              { name, createdAt }
 *    ├─ busSignups/{autoId}            { name, createdAt }
 *    └─ vehicles/{vehicleId}           { ownerName, seatsTotal, createdAt }
 *         └─ reservations/{autoId}     { name, createdAt }
 */

// 1) Configura tu Firebase (REEMPLAZA con tus valores reales)
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// 2) Inicializa Firebase (evita doble init en hot reload)
const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

// 3) ID del tour (puedes parametrizarlo por querystring)
const DEFAULT_TOUR_ID = "default";

// Utilidad: estado sincronizado con localStorage
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const raw = window.localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);
  return [value, setValue];
}

// Componente principal
export default function App() {
  const [tourId] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_TOUR_ID;
    const qs = new URLSearchParams(window.location.search);
    return qs.get("tour") || DEFAULT_TOUR_ID;
  });

  const tourRef = useMemo(() => doc(collection(db, "tours"), tourId), [tourId]);

  // Nombre del usuario (firma)
  const [name, setName] = useLocalStorage("fungitour:name", "");

  // Colecciones en tiempo real
  const [payments, setPayments] = useState([]); // [{id, name, createdAt}]
  const [busSignups, setBusSignups] = useState([]); // [{id, name, createdAt}]
  const [vehicles, setVehicles] = useState([]); // [{id, ownerName, seatsTotal, createdAt, reservations: []}]

  // Traer payments
  useEffect(() => {
    const q = query(collection(tourRef, "payments"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      setPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [tourRef]);

  // Traer bus signups
  useEffect(() => {
    const q = query(collection(tourRef, "busSignups"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      setBusSignups(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [tourRef]);

  // Traer vehicles + reservas
  useEffect(() => {
    const q = query(collection(tourRef, "vehicles"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, async (snap) => {
      const base = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Para cada vehículo, escucha sus reservas
      const withReservations = await Promise.all(
        base.map(async (v) => {
          const resSnap = await getDocs(query(collection(doc(tourRef, "vehicles", v.id), "reservations"), orderBy("createdAt", "asc")));
          const reservations = resSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
          return { ...v, reservations };
        })
      );
      setVehicles(withReservations);
    });
    return unsub;
  }, [tourRef]);

  // Acciones
  const requireName = () => {
    if (!name.trim()) {
      alert("Por favor, escribe tu nombre y apellido para firmar.");
      return false;
    }
    return true;
  };

  const handlePayment = async () => {
    if (!requireName()) return;
    await addDoc(collection(tourRef, "payments"), {
      name: name.trim(),
      createdAt: serverTimestamp(),
    });
  };

  const handleJoinBus = async () => {
    if (!requireName()) return;
    await addDoc(collection(tourRef, "busSignups"), {
      name: name.trim(),
      createdAt: serverTimestamp(),
    });
  };

  const [seatsTotal, setSeatsTotal] = useState(4);

  const handleCreateVehicle = async (e) => {
    e.preventDefault();
    if (!requireName()) return;
    const total = Number(seatsTotal);
    if (!Number.isInteger(total) || total < 1 || total > 50) {
      alert("Ingresa un número de asientos válido (1-50).");
      return;
    }
    await addDoc(collection(tourRef, "vehicles"), {
      ownerName: name.trim(),
      seatsTotal: total,
      createdAt: serverTimestamp(),
    });
    setSeatsTotal(4);
  };

  const reserveSeat = async (vehicleId) => {
    if (!requireName()) return;
    const vehicleDoc = doc(tourRef, "vehicles", vehicleId);
    await runTransaction(db, async (tx) => {
      const vSnap = await tx.get(vehicleDoc);
      if (!vSnap.exists()) throw new Error("El vehículo ya no existe.");
      const v = vSnap.data();
      const resCol = collection(vehicleDoc, "reservations");
      const resSnap = await getDocs(resCol);
      const current = resSnap.size;
      if (current >= (v.seatsTotal || 0)) {
        throw new Error("No hay asientos disponibles en este vehículo.");
      }
      // Evita duplicar la misma persona
      const already = resSnap.docs.some((d) => (d.data().name || "").toLowerCase() === name.trim().toLowerCase());
      if (already) throw new Error("Ya reservaste un asiento en este vehículo.");
      // Reserva
      tx.set(doc(resCol), {
        name: name.trim(),
        createdAt: serverTimestamp(),
      });
    });
  };

  const cancelMySeat = async (vehicleId, reservationId, reservationName) => {
    if (!name.trim()) return alert("Escribe tu nombre para cancelar tu asiento.");
    if (reservationName?.toLowerCase() !== name.trim().toLowerCase()) {
      return alert("Solo puedes cancelar tu propio asiento.");
    }
    await deleteDoc(doc(tourRef, "vehicles", vehicleId, "reservations", reservationId));
  };

  const deleteMyVehicle = async (vehicleId, ownerName) => {
    if (ownerName?.toLowerCase() !== name.trim().toLowerCase()) {
      return alert("Solo el dueño puede eliminar su vehículo.");
    }
    // Borra reservas y luego vehículo
    const vehicleDoc = doc(tourRef, "vehicles", vehicleId);
    const resCol = collection(vehicleDoc, "reservations");
    const resSnap = await getDocs(resCol);
    await Promise.all(resSnap.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(vehicleDoc);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-5xl p-6">
        {/* Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">FungiTour – Organización Rápida</h1>
            <p className="text-sm text-gray-500">Tour ID: <span className="font-mono">{tourId}</span></p>
          </div>
          <div className="flex items-center gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre y apellido (para firmar)"
              className="w-72 rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <span className="text-xs text-gray-500">Se guarda localmente</span>
          </div>
        </header>

        {/* Grid */}
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Transferencia */}
          <section className="rounded-3xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Pagos / Transferencias</h2>
              <button
                onClick={handlePayment}
                className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700"
              >
                Ya hice la transferencia
              </button>
            </div>
            <ul className="mt-4 space-y-2 max-h-56 overflow-auto pr-1">
              {payments.length === 0 && (
                <li className="text-sm text-gray-400">Aún no hay registros.</li>
              )}
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span>{p.name}</span>
                  <span className="font-mono text-xs text-gray-400">{p.createdAt?.toDate?.().toLocaleString?.() || ""}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Microbús */}
          <section className="rounded-3xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Microbús rentado</h2>
              <button
                onClick={handleJoinBus}
                className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700"
              >
                Yo quiero ir en el micro rentado
              </button>
            </div>
            <div className="mt-3 text-xs text-gray-500">Registros: {busSignups.length}</div>
            <ul className="mt-2 space-y-2 max-h-56 overflow-auto pr-1">
              {busSignups.length === 0 && (
                <li className="text-sm text-gray-400">Nadie se ha anotado aún.</li>
              )}
              {busSignups.map((b) => (
                <li key={b.id} className="flex items-center justify-between text-sm">
                  <span>{b.name}</span>
                  <span className="font-mono text-xs text-gray-400">{b.createdAt?.toDate?.().toLocaleString?.() || ""}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Ofrecer vehículo */}
          <section className="rounded-3xl border border-gray-200 p-5 shadow-sm sm:col-span-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="text-lg font-medium">Vehículos de participantes</h2>
              <form onSubmit={handleCreateVehicle} className="flex items-end gap-3">
                <label className="text-sm">
                  Asientos disponibles
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={seatsTotal}
                    onChange={(e) => setSeatsTotal(e.target.value)}
                    className="ml-2 w-24 rounded-2xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-sky-700"
                >
                  Yo tengo un vehículo
                </button>
              </form>
            </div>

            {/* Lista de vehículos */}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {vehicles.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400 sm:col-span-2 md:col-span-3">
                  Aún no hay vehículos ofrecidos.
                </div>
              )}

              {vehicles.map((v) => {
                const taken = v.reservations?.length || 0;
                const total = v.seatsTotal || 0;
                const free = Math.max(total - taken, 0);
                const isOwner = name.trim() && v.ownerName?.toLowerCase() === name.trim().toLowerCase();
                return (
                  <div key={v.id} className="rounded-3xl border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm text-gray-500">Dueño</div>
                        <div className="font-medium">{v.ownerName}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">Asientos</div>
                        <div className="font-semibold">
                          {taken}/{total} <span className="text-xs text-gray-400">(ocupados)</span>
                        </div>
                        <div className={`text-xs ${free > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {free > 0 ? `${free} libres` : "Lleno"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2">
                      <button
                        disabled={free === 0}
                        onClick={() => reserveSeat(v.id)}
                        className={`rounded-2xl px-3 py-2 text-sm font-semibold text-white shadow ${free === 0 ? "bg-gray-300 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"}`}
                      >
                        Apartar asiento
                      </button>
                      {isOwner && (
                        <button
                          onClick={() =>
                            confirm("Esto eliminará el vehículo y sus reservas. ¿Continuar?") &&
                            deleteMyVehicle(v.id, v.ownerName)
                          }
                          className="rounded-2xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-rose-700"
                        >
                          Eliminar vehículo
                        </button>
                      )}
                    </div>

                    {/* Lista de pasajeros */}
                    <div className="mt-4">
                      <div className="text-sm text-gray-500 mb-1">Pasajeros</div>
                      <ul className="space-y-1 max-h-40 overflow-auto pr-1">
                        {(!v.reservations || v.reservations.length === 0) && (
                          <li className="text-sm text-gray-400">Aún no hay pasajeros.</li>
                        )}
                        {v.reservations?.map((r) => (
                          <li key={r.id} className="flex items-center justify-between text-sm">
                            <span>{r.name}</span>
                            {name.trim() && r.name?.toLowerCase() === name.trim().toLowerCase() && (
                              <button
                                onClick={() => cancelMySeat(v.id, r.id, r.name)}
                                className="rounded-xl border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                              >
                                Cancelar
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Pie de página con tips */}
        <footer className="mt-8 rounded-3xl border border-gray-200 bg-gray-50 p-5 text-xs text-gray-600">
          <p className="mb-2 font-medium">Notas rápidas</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Para separar varios tours, añade <code>?tour=miTourId</code> al URL. Todos verán/editarán ese tour.
            </li>
            <li>
              En Firebase → Reglas de seguridad: para MVP podrías dejar lectura/escritura abierta solo mientras pruebas.
              Luego añade Auth (por ejemplo, "Sign in with Google") y reglas que limiten escritura por usuario.
            </li>
            <li>
              Si quieres aprobar manualmente pagos, cambia la colección <code>payments</code> a un esquema con estado (p.ej. <code>{`{ name, amount, status }`}</code>).
            </li>
          </ul>
        </footer>
      </div>
    </div>
  );
}
