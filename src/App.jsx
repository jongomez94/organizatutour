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
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

/**
 * FungiTour Webapp – Gestión de Participantes (React + Firebase)
 * ------------------------------------------------------------
 * Qué hace:
 * - Formulario para agregar participantes a la colección "participantes"
 * - Lista en tiempo real de todos los participantes
 * - Interfaz simple y moderna para gestionar la lista de participantes
 * - Todo se actualiza en tiempo real vía onSnapshot.
 *
 * Cómo usar:
 * 1) Crea un proyecto de Firebase y habilita Firestore.
 * 2) Configura las variables de entorno en .env.local
 * 3) Deploy en Vercel (o cualquier hosting estático) como una app de React.
 *
 * Estructura de datos (Firestore):
 * - participantes/{autoId}             { nombre, createdAt }
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

// 2) Inicializa Firebase (evita doble init en hot reload)
const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

// Componente principal
export default function App() {
  // Estado para el formulario
  const [nuevoParticipante, setNuevoParticipante] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Colección de participantes en tiempo real
  const [participantes, setParticipantes] = useState([]); // [{id, nombre, createdAt}]

  // Traer participantes en tiempo real
  useEffect(() => {
    const q = query(collection(db, "participantes"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      setParticipantes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  // Acciones
  const handleAgregarParticipante = async (e) => {
    e.preventDefault();
    if (!nuevoParticipante.trim()) {
      alert("Por favor, ingresa el nombre del participante.");
      return;
    }

    setIsLoading(true);
    try {
      await addDoc(collection(db, "participantes"), {
        nombre: nuevoParticipante.trim(),
        createdAt: serverTimestamp(),
      });
      setNuevoParticipante(""); // Limpiar el formulario
    } catch (error) {
      console.error("Error al agregar participante:", error);
      alert("Error al agregar participante. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEliminarParticipante = async (participanteId) => {
    if (confirm("¿Estás seguro de que quieres eliminar este participante?")) {
      try {
        await deleteDoc(doc(db, "participantes", participanteId));
      } catch (error) {
        console.error("Error al eliminar participante:", error);
        alert("Error al eliminar participante. Intenta de nuevo.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 text-gray-900">
      <div className="mx-auto max-w-4xl p-6">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-800 mb-2">
            🍄 FungiTour
          </h1>
          <p className="text-lg text-gray-600">Gestión de Participantes</p>
        </header>

        {/* Formulario para agregar participantes */}
        <section className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Agregar Participante</h2>
          <form onSubmit={handleAgregarParticipante} className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={nuevoParticipante}
              onChange={(e) => setNuevoParticipante(e.target.value)}
              placeholder="Nombre del participante"
              className="flex-1 rounded-2xl border border-gray-300 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !nuevoParticipante.trim()}
              className={`rounded-2xl px-6 py-3 text-base font-semibold text-white shadow transition-colors ${
                isLoading || !nuevoParticipante.trim()
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {isLoading ? "Agregando..." : "Agregar"}
            </button>
          </form>
        </section>

        {/* Lista de participantes */}
        <section className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Lista de Participantes</h2>
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {participantes.length} participante{participantes.length !== 1 ? 's' : ''}
            </span>
          </div>

          {participantes.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">👥</div>
              <p className="text-gray-500 text-lg">Aún no hay participantes registrados</p>
              <p className="text-gray-400 text-sm mt-2">Agrega el primer participante usando el formulario de arriba</p>
            </div>
          ) : (
            <div className="space-y-3">
              {participantes.map((participante, index) => (
                <div
                  key={participante.id}
                  className="flex items-center justify-between p-4 rounded-2xl border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{participante.nombre}</p>
                      <p className="text-xs text-gray-500">
                        Agregado: {participante.createdAt?.toDate?.().toLocaleString?.() || "Recientemente"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleEliminarParticipante(participante.id)}
                    className="text-red-500 hover:text-red-700 p-2 rounded-xl hover:bg-red-50 transition-colors"
                    title="Eliminar participante"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pie de página */}
        <footer className="mt-8 text-center text-sm text-gray-500">
          <p>✨ Actualizaciones en tiempo real con Firebase</p>
        </footer>
      </div>
    </div>
  );
}
