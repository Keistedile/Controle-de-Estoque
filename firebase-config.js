/* =============================================================
   CONFIGURAÇÃO DO FIREBASE
   ============================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyBR68j3l7DtSU1jWBdlc0SaX2m40lV164U",
  authDomain: "estoque-paysagecorpal.firebaseapp.com",
  projectId: "estoque-paysagecorpal",
  storageBucket: "estoque-paysagecorpal.firebasestorage.app",
  messagingSenderId: "116609127998",
  appId: "1:116609127998:web:00031188c0b9a25276236f"
};

// Não é necessário editar nada abaixo desta linha.
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
