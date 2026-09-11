/* =============================================================
   APP DE CONTROLE DE ESTOQUE — Paysage Corpal
   =============================================================
   Estrutura de dados no Firestore:

   obras/{id}
     nome              : string
     endereco          : string
     dataEntrega       : string (AAAA-MM-DD)
     prazoAssistencia  : string (AAAA-MM-DD) — prazo final da assistência técnica
     criadoEm          : timestamp

   materiais/{id}
     obra                : string  (nome da obra, escolhido da coleção "obras")
     especificacao       : string
     unidade             : string
     valorUnitario       : number
     quantidadeEstoque   : number  (total recebido, acumulado)
     quantidadeRetirada  : number  (total retirado, acumulado)
     criadoEm, atualizadoEm : timestamp

   movimentacoes/{id}
     materialId, obra, especificacao
     tipo        : 'entrada' | 'retirada'
     quantidade  : number
     responsavel : string
     data        : timestamp

   Saldo disponível  = quantidadeEstoque - quantidadeRetirada
   Valor em estoque  = saldo * valorUnitario
   ============================================================= */

const LOW_STOCK_RATIO = 0.15; // abaixo de 15% do total recebido = estoque baixo

let obras = [];           // cache local, sincronizado via onSnapshot
let materiais = [];       // cache local, sincronizado via onSnapshot
let movimentacoes = [];
let chartMateriais = null;

const fmtMoeda = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = (v) => (v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const fmtData = (iso) => {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
};
const assistenciaVigente = (iso) => {
  if (!iso) return null; // sem prazo definido
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const prazo = new Date(iso + 'T00:00:00');
  return prazo >= hoje;
};
const saldoDe = (m) => (Number(m.quantidadeEstoque) || 0) - (Number(m.quantidadeRetirada) || 0);
const valorDe = (m) => saldoDe(m) * (Number(m.valorUnitario) || 0);
const isBaixo = (m) => {
  const saldo = saldoDe(m);
  const total = Number(m.quantidadeEstoque) || 0;
  if (saldo <= 0) return true;
  if (total <= 0) return false;
  return (saldo / total) <= LOW_STOCK_RATIO;
};

/* ---------------------------- Navegação ---------------------------- */

document.querySelectorAll('.tabbar__btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tabbar__btn').forEach(b => b.classList.remove('tabbar__btn--active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('view--active'));
    btn.classList.add('tabbar__btn--active');
    document.getElementById('view-' + btn.dataset.view).classList.add('view--active');
  });
});

document.querySelectorAll('.ds-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ds-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.form').forEach(f => f.classList.remove('form--active'));
    btn.classList.add('active');
    const formId = btn.dataset.form === 'cadastro' ? 'formCadastro' : 'formRetirada';
    document.getElementById(formId).classList.add('form--active');
  });
});

/* ---------------------------- Tema claro/escuro ---------------------------- */

function aplicarTema(tema) {
  document.documentElement.setAttribute('data-theme', tema);
  document.getElementById('themeToggle').textContent = tema === 'dark' ? 'Claro' : 'Escuro';
  try { localStorage.setItem('paysage-estoque-tema', tema); } catch (e) { /* ignora se indisponível */ }
}
document.getElementById('themeToggle').addEventListener('click', () => {
  const atual = document.documentElement.getAttribute('data-theme');
  aplicarTema(atual === 'dark' ? 'light' : 'dark');
  renderGrafico();
});
(function iniciarTema() {
  let salvo = null;
  try { salvo = localStorage.getItem('paysage-estoque-tema'); } catch (e) { /* ignora */ }
  aplicarTema(salvo === 'light' ? 'light' : 'dark');
})();

/* ---------------------------- Firestore: leitura ---------------------------- */

function iniciarSincronizacao() {
  db.collection('obras').orderBy('nome').onSnapshot(
    (snap) => {
      obras = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderSelectObraCadastro();
      renderListaObrasCadastradas();
    },
    (err) => console.error(err)
  );

  db.collection('materiais').orderBy('atualizadoEm', 'desc').onSnapshot(
    (snap) => {
      materiais = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setStatus(true);
      renderTudo();
    },
    (err) => { console.error(err); setStatus(false); }
  );

  db.collection('movimentacoes').orderBy('data', 'desc').limit(30).onSnapshot(
    (snap) => {
      movimentacoes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderMovimentacoes();
    },
    (err) => console.error(err)
  );
}

function setStatus(online) {
  const el = document.getElementById('connStatus');
  el.classList.toggle('status--online', online);
  el.title = online ? 'Sincronizado' : 'Sem conexão com o banco de dados';
}

/* ---------------------------- Render: visão geral ---------------------------- */

function renderTudo() {
  renderResumo();
  renderGrafico();
  renderRankings();
  renderTabela();
  renderSelectMateriais();
  renderListaObrasCadastradas();
}

function renderResumo() {
  const valorTotal = materiais.reduce((s, m) => s + valorDe(m), 0);
  const obras = new Set(materiais.map(m => m.obra)).size;
  const baixo = materiais.filter(isBaixo).length;

  document.getElementById('sumValorTotal').textContent = fmtMoeda(valorTotal);
  document.getElementById('sumMateriais').textContent = materiais.length;
  document.getElementById('sumObras').textContent = obras;
  document.getElementById('sumBaixo').textContent = baixo;
}

function renderGrafico() {
  const top = [...materiais].sort((a, b) => valorDe(b) - valorDe(a)).slice(0, 8);
  const labels = top.map(m => `${m.especificacao}`.length > 22 ? m.especificacao.slice(0, 20) + '…' : m.especificacao);
  const valores = top.map(m => Number(valorDe(m).toFixed(2)));

  const ctx = document.getElementById('chartMateriais').getContext('2d');
  if (chartMateriais) chartMateriais.destroy();

  if (top.length === 0) return;

  const corTexto = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#888';

  chartMateriais = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Valor em estoque (R$)',
        data: valores,
        backgroundColor: '#A76F47',
        borderRadius: 4,
        maxBarThickness: 34
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false },
        tooltip: { callbacks: { label: (c) => fmtMoeda(c.parsed.x) } } },
      scales: {
        x: { ticks: { callback: (v) => fmtMoeda(v), color: corTexto }, grid: { color: 'rgba(128,128,128,.15)' } },
        y: { ticks: { color: corTexto }, grid: { display: false } }
      }
    }
  });
}

function renderRankings() {
  const porObra = {};
  materiais.forEach(m => {
    porObra[m.obra] = (porObra[m.obra] || 0) + valorDe(m);
  });
  const entradas = Object.entries(porObra).sort((a, b) => b[1] - a[1]);

  const maior = entradas.slice(0, 5);
  const menor = entradas.slice(-5).reverse();

  const montar = (lista, elId) => {
    const el = document.getElementById(elId);
    el.innerHTML = '';
    if (lista.length === 0) {
      el.innerHTML = '<li class="ds-empty-state" style="width:100%;"><div class="icn">▢</div><p>Nenhuma obra cadastrada ainda.</p></li>';
      return;
    }
    lista.forEach(([obra, valor]) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${obra}</span><span>${fmtMoeda(valor)}</span>`;
      el.appendChild(li);
    });
  };
  montar(maior, 'rankMaior');
  montar(menor, 'rankMenor');
}

function renderTabela(filtro = '') {
  const tbody = document.querySelector('#tabelaMateriais tbody');
  tbody.innerHTML = '';
  const f = filtro.trim().toLowerCase();

  const lista = materiais.filter(m =>
    !f || m.obra.toLowerCase().includes(f) || m.especificacao.toLowerCase().includes(f)
  );

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:var(--text-muted); font-style:italic;">Nenhum material encontrado.</td></tr>`;
    return;
  }

  lista.forEach(m => {
    const saldo = saldoDe(m);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${m.obra}</td>
      <td>${m.especificacao}</td>
      <td>${m.unidade}</td>
      <td class="${isBaixo(m) ? 'low' : ''}">${fmtNum(saldo)}</td>
      <td>${fmtNum(m.quantidadeRetirada)}</td>
      <td>${fmtMoeda(valorDe(m))}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById('filtroTabela').addEventListener('input', (e) => renderTabela(e.target.value));

/* ---------------------------- Render: entrada de dados ---------------------------- */

function renderSelectObraCadastro() {
  const sel = document.getElementById('inputObra');
  const aviso = document.getElementById('avisoSemObra');
  const atual = sel.value;
  sel.innerHTML = '<option value="" disabled selected>Selecione a obra</option>' +
    obras.map(o => `<option value="${o.nome}">${o.nome}</option>`).join('');
  if (atual) sel.value = atual;

  const semObras = obras.length === 0;
  sel.disabled = semObras;
  aviso.style.display = semObras ? 'block' : 'none';
}

function renderSelectMateriais() {
  const sel = document.getElementById('inputMaterialRetirada');
  const atual = sel.value;
  sel.innerHTML = '<option value="" disabled selected>Selecione o material</option>' +
    materiais.map(m => `<option value="${m.id}">${m.obra} — ${m.especificacao} (saldo: ${fmtNum(saldoDe(m))} ${m.unidade})</option>`).join('');
  if (atual) sel.value = atual;
  atualizarSaldoPreview();
}

document.getElementById('inputMaterialRetirada').addEventListener('change', atualizarSaldoPreview);

function atualizarSaldoPreview() {
  const id = document.getElementById('inputMaterialRetirada').value;
  const preview = document.getElementById('saldoPreview');
  const m = materiais.find(x => x.id === id);
  if (!m) {
    preview.innerHTML = 'Selecione um material para ver o saldo disponível.';
    return;
  }
  preview.innerHTML = `Saldo disponível: <strong>${fmtNum(saldoDe(m))} ${m.unidade}</strong> · Valor unitário: <strong>${fmtMoeda(m.valorUnitario)}</strong>`;
}

function renderMovimentacoes() {
  const el = document.getElementById('listaMovimentacoes');
  el.innerHTML = '';
  if (movimentacoes.length === 0) {
    el.innerHTML = '<li class="ds-empty-state" style="width:100%;"><div class="icn">▢</div><p>Nenhuma movimentação registrada ainda.</p></li>';
    return;
  }
  movimentacoes.forEach(mv => {
    const li = document.createElement('li');
    const badgeClass = mv.tipo === 'entrada' ? 'olive' : 'terracotta';
    li.innerHTML = `
      <span class="ds-badge ${badgeClass}">${mv.tipo}</span>
      <span style="flex:1">${mv.obra} — ${mv.especificacao}${mv.responsavel ? ' · ' + mv.responsavel : ''}</span>
      <span style="font-variant-numeric:tabular-nums">${fmtNum(mv.quantidade)}</span>
    `;
    el.appendChild(li);
  });
}

/* ---------------------------- Formulário: cadastrar material ---------------------------- */

document.getElementById('formCadastro').addEventListener('submit', async (e) => {
  e.preventDefault();
  const feedback = document.getElementById('feedbackCadastro');
  feedback.textContent = ''; feedback.className = 'form__feedback';

  const obra = document.getElementById('inputObra').value.trim();
  const especificacao = document.getElementById('inputEspecificacao').value.trim();
  const unidade = document.getElementById('inputUnidade').value;
  const valorUnitario = parseFloat(document.getElementById('inputValorUnitario').value);
  const quantidadeEstoque = parseFloat(document.getElementById('inputQuantidadeEstoque').value);

  try {
    const docRef = await db.collection('materiais').add({
      obra, especificacao, unidade, valorUnitario,
      quantidadeEstoque,
      quantidadeRetirada: 0,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('movimentacoes').add({
      materialId: docRef.id, obra, especificacao,
      tipo: 'entrada', quantidade: quantidadeEstoque, responsavel: '',
      data: firebase.firestore.FieldValue.serverTimestamp()
    });
    feedback.textContent = 'Material salvo com sucesso.';
    feedback.classList.add('ok');
    e.target.reset();
  } catch (err) {
    console.error(err);
    feedback.textContent = 'Não foi possível salvar. Verifique sua conexão e a configuração do Firebase.';
    feedback.classList.add('err');
  }
});

/* ---------------------------- Formulário: registrar retirada ---------------------------- */

document.getElementById('formRetirada').addEventListener('submit', async (e) => {
  e.preventDefault();
  const feedback = document.getElementById('feedbackRetirada');
  feedback.textContent = ''; feedback.className = 'form__feedback';

  const materialId = document.getElementById('inputMaterialRetirada').value;
  const quantidade = parseFloat(document.getElementById('inputQuantidadeRetirada').value);
  const responsavel = document.getElementById('inputResponsavel').value.trim();

  const material = materiais.find(m => m.id === materialId);
  if (!material) { feedback.textContent = 'Selecione um material válido.'; feedback.classList.add('err'); return; }

  const saldo = saldoDe(material);
  if (quantidade > saldo) {
    feedback.textContent = `Quantidade maior que o saldo disponível (${fmtNum(saldo)} ${material.unidade}).`;
    feedback.classList.add('err');
    return;
  }

  try {
    await db.collection('materiais').doc(materialId).update({
      quantidadeRetirada: firebase.firestore.FieldValue.increment(quantidade),
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('movimentacoes').add({
      materialId, obra: material.obra, especificacao: material.especificacao,
      tipo: 'retirada', quantidade, responsavel,
      data: firebase.firestore.FieldValue.serverTimestamp()
    });
    feedback.textContent = 'Retirada registrada com sucesso.';
    feedback.classList.add('ok');
    e.target.reset();
    atualizarSaldoPreview();
  } catch (err) {
    console.error(err);
    feedback.textContent = 'Não foi possível registrar a retirada. Verifique sua conexão.';
    feedback.classList.add('err');
  }
});

/* ---------------------------- Aba: Obras ---------------------------- */

function renderListaObrasCadastradas() {
  const el = document.getElementById('listaObrasCadastradas');
  el.innerHTML = '';

  if (obras.length === 0) {
    el.innerHTML = '<li class="ds-empty-state" style="width:100%;"><div class="icn">▢</div><p>Nenhuma obra cadastrada ainda.</p></li>';
    return;
  }

  obras.forEach(o => {
    const materiaisDaObra = materiais.filter(m => m.obra === o.nome);
    const valorTotal = materiaisDaObra.reduce((s, m) => s + valorDe(m), 0);
    const vigente = assistenciaVigente(o.prazoAssistencia);

    const metaLinhas = [];
    if (o.endereco) metaLinhas.push(o.endereco);
    const datas = [];
    if (o.dataEntrega) datas.push(`Entrega: ${fmtData(o.dataEntrega)}`);
    if (o.prazoAssistencia) datas.push(`Assistência até: ${fmtData(o.prazoAssistencia)}`);
    if (datas.length) metaLinhas.push(datas.join(' · '));

    const li = document.createElement('li');
    li.style.alignItems = 'flex-start';
    li.innerHTML = `
      <span style="flex:1">
        <span class="obra-meta__row">
          <strong style="color:var(--text-primary)">${o.nome}</strong>
          ${vigente === null ? '' : `<span class="ds-badge ${vigente ? 'success' : 'critical'}">${vigente ? 'Assistência vigente' : 'Assistência expirada'}</span>`}
        </span>
        <span class="obra-meta">
          ${metaLinhas.map(l => `<span>${l}</span>`).join('')}
          <span>${materiaisDaObra.length} material(is) · ${fmtMoeda(valorTotal)}</span>
        </span>
      </span>
      <button type="button" class="ds-btn ds-btn-danger btn-excluir" data-obra-id="${o.id}" data-obra-nome="${o.nome}">Excluir</button>
    `;
    el.appendChild(li);
  });

  el.querySelectorAll('.btn-excluir').forEach(btn => {
    btn.addEventListener('click', () => excluirObra(btn.dataset.obraId, btn.dataset.obraNome));
  });
}

async function excluirObra(id, nome) {
  const feedback = document.getElementById('feedbackObra');
  feedback.textContent = ''; feedback.className = 'form__feedback';

  const temMateriais = materiais.some(m => m.obra === nome);
  if (temMateriais) {
    feedback.textContent = `Não é possível excluir "${nome}": ainda há materiais cadastrados nessa obra.`;
    feedback.classList.add('err');
    return;
  }

  if (!confirm(`Excluir a obra "${nome}"? Essa ação não pode ser desfeita.`)) return;

  try {
    await db.collection('obras').doc(id).delete();
    feedback.textContent = `Obra "${nome}" excluída.`;
    feedback.classList.add('ok');
  } catch (err) {
    console.error(err);
    feedback.textContent = 'Não foi possível excluir. Verifique sua conexão.';
    feedback.classList.add('err');
  }
}

document.getElementById('formObra').addEventListener('submit', async (e) => {
  e.preventDefault();
  const feedback = document.getElementById('feedbackObra');
  feedback.textContent = ''; feedback.className = 'form__feedback';

  const nome = document.getElementById('inputNomeObra').value.trim();
  const endereco = document.getElementById('inputEnderecoObra').value.trim();
  const dataEntrega = document.getElementById('inputDataEntrega').value;
  const prazoAssistencia = document.getElementById('inputPrazoAssistencia').value;

  const jaExiste = obras.some(o => o.nome.toLowerCase() === nome.toLowerCase());
  if (jaExiste) {
    feedback.textContent = 'Já existe uma obra cadastrada com esse nome.';
    feedback.classList.add('err');
    return;
  }

  try {
    await db.collection('obras').add({
      nome, endereco, dataEntrega, prazoAssistencia,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    feedback.textContent = 'Obra adicionada com sucesso.';
    feedback.classList.add('ok');
    e.target.reset();
  } catch (err) {
    console.error(err);
    feedback.textContent = 'Não foi possível salvar. Verifique sua conexão e a configuração do Firebase.';
    feedback.classList.add('err');
  }
});

/* ---------------------------- Início ---------------------------- */

iniciarSincronizacao();
