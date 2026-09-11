/* =============================================================
   CONFIGURAÇÃO DO FIREBASE
   =============================================================
   Substitua os valores abaixo pelos dados do SEU projeto Firebase.
   Passo a passo completo está no README.md ("Como configurar o banco
   de dados").

   1. Acesse https://console.firebase.google.com
   2. Crie um projeto novo (gratuito)
   3. Ative o "Firestore Database" (modo de produção)
   4. Vá em Configurações do projeto > Geral > Seus apps > Web (</>) 
   5. Copie o objeto "firebaseConfig" gerado e cole abaixo
   ============================================================= */

const firebaseConfig = {
  apiKey: "COLE_AQUI_SUA_API_KEY",
  authDomain: "SEU-PROJETO.firebaseapp.com",
  projectId: "SEU-PROJETO",
  storageBucket: "SEU-PROJETO.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxxxxxxxx"
};

// Não é necessário editar nada abaixo desta linha.
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
