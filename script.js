const API_URL = 'https://script.google.com/macros/s/AKfycbwowZOp5zrgL7pqtrKkCQJDX7k8EkEoqdjfni-6v8gTV2ZIyL4NXA8O7jSz7PdgKNmc/exec'; 

window.onload = function() {
    initTheme();
    carregarVersiculo();
    if (localStorage.getItem('churchAdminPass')) {
        verificarSessaoAdmin();
    } else {
        verificarAcessoMembro();
    }
    carregarDados();
};

function initTheme() {
    const isDark = localStorage.getItem('id_theme_dark') === 'true';
    if (isDark) {
        document.body.classList.add('dark-mode');
        document.getElementById('themeIcon').innerText = 'light_mode';
    }
}

function toggleDarkMode() {
    const body = document.body;
    body.classList.toggle('dark-mode');
    const isDark = body.classList.contains('dark-mode');
    localStorage.setItem('id_theme_dark', isDark);
    document.getElementById('themeIcon').innerText = isDark ? 'light_mode' : 'dark_mode';
}

function switchTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    if(btnElement) btnElement.classList.add('active');

    if(tabId === 'tabAgenda') {
        if(document.getElementById('badgeAgenda')) document.getElementById('badgeAgenda').classList.add('hidden');
        localStorage.setItem('id_notify_agenda', strDadosAgenda);
        setTimeout(rolarParaHoje, 100);
    }
    if(tabId === 'tabMural') {
        if(document.getElementById('badgeMural')) document.getElementById('badgeMural').classList.add('hidden');
        localStorage.setItem('id_notify_mural', strDadosMural);
    }
}

function iniciarDitadoIA() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Navegador incompatível.");
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    const statusText = document.getElementById('statusIA');
    statusText.innerText = "Escutando...";
    recognition.start();

    recognition.onresult = async function(event) {
        const texto = event.results[0][0].transcript;
        statusText.innerText = "IA Processando...";
        const res = await fetchData('processarTextoGemini', { texto: texto });
        if(res && res.success) {
            document.getElementById('dataEscala').value = res.dados.data || '';
            document.getElementById('horaEscala').value = res.dados.hora || '';
            document.getElementById('eventoEscala').value = res.dados.evento || '';
            document.getElementById('dirigentesEscala').value = res.dados.dirigentes || '';
            document.getElementById('porteirosEscala').value = res.dados.porteiros || '';
            statusText.innerText = "Pronto!";
        } else {
            statusText.innerText = "Erro na IA";
        }
        setTimeout(() => statusText.innerText = '', 3000);
    };
}

async function fetchData(action, params = {}) {
    if (['getEscalas', 'getAvisos', 'getAniversariantesDia'].includes(action)) {
        try {
            const r = await fetch(`${API_URL}?action=${action}`);
            return await r.json();
        } catch (e) { 
            console.error(`Erro GET ${action}:`, e);
            return []; 
        }
    } else {
        const p = { action: action, ...params };
        try {
            const r = await fetch(API_URL, { method: 'POST', body: JSON.stringify(p) });
            const textoResposta = await r.text();
            try {
                return JSON.parse(textoResposta);
            } catch (jsonErr) {
                console.error("O Apps Script retornou um erro interno (HTML) em vez de JSON:", textoResposta);
                return { erro: true, msg: "Falha interna no backend. Veja o console." };
            }
        } catch (e) { 
            console.error(`Erro na requisição POST ${action}:`, e);
            return { erro: true, msg: e.message }; 
        }
    }
}

let strDadosMural = "[]";
let strDadosAgenda = "[]";

async function carregarDados() {
    const avisos = await fetchData('getAvisos');
    renderizarAvisos('avisosContainer', avisos);
    strDadosMural = JSON.stringify(avisos); 
    
    const escalas = await fetchData('getEscalas');
    let filtradas = filtrarSemanaAtual(escalas);
    
    filtradas.sort((a, b) => {
        let dataA = parseDataSegura(a.data);
        let [hA, mA] = (formatarHoraGoogle(a.hora) || "00:00").split(':').map(Number);
        dataA.setHours(hA, mA, 0);

        let dataB = parseDataSegura(b.data);
        let [hB, mB] = (formatarHoraGoogle(b.hora) || "00:00").split(':').map(Number);
        dataB.setHours(hB, mB, 0);

        return dataA.getTime() - dataB.getTime();
    });

    renderizarEscalaCards('tabelaEscalasBody', filtradas);
    renderizarEscalaAdmin('tabelaEscalasAdminBody', filtradas);
    strDadosAgenda = JSON.stringify(filtradas); 
    
    const aniversariantes = await fetchData('getAniversariantesDia');
    renderizarAniversariantes(aniversariantes);

    if (typeof verificarNotificacoes === 'function') {
        verificarNotificacoes();
    }
}

function renderizarAniversariantes(lista) {
    const box = document.getElementById('boxAniversariantes');
    const container = document.getElementById('listaAniversariantes');
    
    if(!lista || lista.length === 0) {
        box.style.display = 'none';
        return;
    }
    
    box.style.display = 'block';
    container.innerHTML = '';
    
    const isAdmin = localStorage.getItem('churchAdminPass') !== null;
    
    lista.forEach(p => {
        let btnZap = '';
        if(isAdmin && p.telefone) {
            let msgText = encodeURIComponent(`A Paz do Senhor, ${p.nome}! A liderança da Igreja deseja um Feliz Aniversário! Que Deus te abençoe grandemente.`);
            btnZap = `<a href="https://wa.me/55${p.telefone}?text=${msgText}" target="_blank" class="btn-tiny" style="background:#25d366; text-decoration:none; display:inline-flex; align-items:center; gap:5px; color:white; padding: 6px 12px; border-radius: 20px;"><span class="material-icons-round" style="font-size:16px">chat</span> Enviar Zap</a>`;
        }
        
        container.innerHTML += `
            <div class="app-card" style="padding:15px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong style="font-size:1.1rem; color:var(--text-main);">${p.nome}</strong>
                    <p class="text-sm text-muted">Ficando mais experiente hoje! 🎉</p>
                </div>
                ${btnZap}
            </div>
        `;
    });
}

function renderizarEscalaAdmin(id, dados) {
    const tbody = document.getElementById(id);
    if (!tbody) return; tbody.innerHTML = "";
    dados.forEach(e => {
        let h = formatarHoraGoogle(e.hora);
        tbody.innerHTML += `
            <tr>
                <td>${parseDataSegura(e.data).toLocaleDateString('pt-BR')}<br>${h}</td>
                <td>${e.evento}</td>
                <td style="font-size:0.8rem">D: ${e.dirigentes}<br>P: ${e.porteiros}</td>
                <td style="white-space:nowrap">
                    <button onclick="abrirModalEdit('${e.linha}','${e.data}','${h}','${e.evento}','${e.dirigentes}','${e.porteiros}')" class="btn-tiny" style="color:var(--primary); background: none; border: none; cursor: pointer;"><span class="material-icons-round" style="font-size:20px">edit</span></button>
                    <button onclick="confirmarExcluir('${e.linha}')" class="btn-tiny" style="color:#ef4444; background: none; border: none; cursor: pointer;"><span class="material-icons-round" style="font-size:20px">delete</span></button>
                </td>
            </tr>`;
    });
}

async function confirmarExcluir(linha) {
    if(confirm("Deseja realmente excluir este evento?")) {
        showToast("Excluindo...");
        const res = await fetchData('excluirEscala', { senha: localStorage.getItem('churchAdminPass'), linha: linha });
        if(res.success) { showToast("Excluído!"); carregarDados(); }
    }
}

function abrirModalEdit(id, data, hora, evento, dirigentes, porteiros) {
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-data').value = data.includes('/') ? data.split('/').reverse().join('-') : data.substring(0,10);
    document.getElementById('edit-hora').value = hora;
    document.getElementById('edit-evento').value = evento;
    document.getElementById('edit-dirigentes').value = dirigentes;
    document.getElementById('edit-porteiros').value = porteiros;
    document.getElementById('modalEditEscala').classList.remove('hidden');
}
function fecharModalEdit() { document.getElementById('modalEditEscala').classList.add('hidden'); }

async function salvarEdicaoEscala(event) {
    event.preventDefault();
    const res = await fetchData('editarEscala', {
        senha: localStorage.getItem('churchAdminPass'),
        linha: document.getElementById('edit-id').value,
        data: document.getElementById('edit-data').value,
        hora: document.getElementById('edit-hora').value,
        evento: document.getElementById('edit-evento').value,
        dirigentes: document.getElementById('edit-dirigentes').value,
        porteiros: document.getElementById('edit-porteiros').value
    });
    if(res.success) { fecharModalEdit(); showToast("Atualizado!"); carregarDados(); }
}

function carregarVersiculo() {
    const versiculos = [
        { texto: "Tudo posso naquele que me fortalece.", ref: "Filipenses 4:13" },
        { texto: "O Senhor é o meu pastor, nada me faltará.", ref: "Salmos 23:1" },
        { texto: "Mil cairão ao teu lado, e dez mil à tua direita, mas tu não serás atingido.", ref: "Salmos 91:7" }
    ];
    const d = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const v = versiculos[d % versiculos.length];
    document.getElementById('textoVersiculo').innerText = `"${v.texto}"`;
    document.getElementById('refVersiculo').innerText = v.ref;
}

function renderizarAvisos(id, d) {
    const c = document.getElementById(id); c.innerHTML = d.length ? "" : "<p class='text-center'>Sem avisos.</p>";
    d.forEach((a, i) => {
        c.innerHTML += `<div class="aviso-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <h3>${a.titulo}</h3>
                <button onclick="compartilharAviso(${i})" class="icon-btn" style="color: var(--primary); margin-top: -5px; padding: 4px;" title="Compartilhar Aviso">
                    <span class="material-icons-round">share</span>
                </button>
            </div>
            <p>${a.mensagem}</p>
        </div>`;
    });
}

async function compartilharTexto(titulo, texto) {
    if (navigator.share) {
        try {
            await navigator.share({ title: titulo, text: texto });
        } catch (err) { console.log('O usuário fechou a aba de compartilhar.'); }
    } else {
        navigator.clipboard.writeText(titulo + "\n\n" + texto);
        showToast("Texto copiado para a área de transferência!");
    }
}

function compartilharAviso(index) {
    let avisos = JSON.parse(strDadosMural);
    let avisoClicado = avisos[index];
    
    let textoFormatado = `📢 *${avisoClicado.titulo}*\n\n${avisoClicado.mensagem}\n\n_Enviado via App Igreja Digital_`;
    compartilharTexto(avisoClicado.titulo, textoFormatado);
}

function compartilharAgendaSemana() {
    if(!strDadosAgenda || strDadosAgenda === "[]") return showToast("Aguarde a agenda carregar.");
    
    let dados = JSON.parse(strDadosAgenda);
    let texto = "🗓️ *AGENDA DA SEMANA - Igreja Digital*\n\n";
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    dados.forEach(e => {
        let objData = parseDataSegura(e.data);
        let nomeDia = diasSemana[objData.getDay()];
        let h = formatarHoraGoogle(e.hora);
        texto += `🔹 *${nomeDia}, ${objData.toLocaleDateString('pt-BR')} às ${h}*\n${e.evento}\nDirigentes: ${e.dirigentes}\n\n`;
    });
    
    texto += "Acesse nosso App para mais detalhes e programação completa!";
    compartilharTexto("Agenda da Semana", texto);
}

async function entrarMembro() {
    const n = document.getElementById('inputNome').value;
    const e = document.getElementById('inputEmail').value;
    
    if(!n || !e) return showToast("Preencha tudo.");
    
    showToast("Verificando acesso...");
    
    const res = await fetchData('cadastrarMembro', { nome: n, email: e });
    
    if (res && (res.success || (res.erro && res.msg === "E-mail já cadastrado."))) {
        localStorage.setItem('id_membro_nome', n);
        localStorage.setItem('id_membro_email', e);
        location.reload();
    } else {
        showToast("Erro ao tentar salvar os dados.");
        console.error(res);
    }
}
async function verificarAcessoMembro() {
    const n = localStorage.getItem('id_membro_nome');
    const e = localStorage.getItem('id_membro_email');
    
    if(n) {
        document.getElementById('loginSection').classList.add('hidden');
        document.getElementById('memberArea').classList.remove('hidden');
        document.getElementById('userNameDisplay').innerText = "Paz, " + n.split(' ')[0];
        document.getElementById('userInfo').classList.remove('hidden');

        if (e && !localStorage.getItem('id_membro_sincronizado')) {
            const res = await fetchData('cadastrarMembro', { nome: n, email: e });
            if (res && (res.success || (res.erro && res.msg === "E-mail já cadastrado."))) {
                localStorage.setItem('id_membro_sincronizado', 'true');
            }
        }
    }
}
function sairMembro() { localStorage.removeItem('id_membro_nome'); localStorage.removeItem('id_membro_email'); location.reload(); }
function toggleAdminLogin() { document.getElementById('loginModal').classList.toggle('hidden'); }
async function validarAdmin() {
    const p = document.getElementById('adminPassword').value;
    const res = await fetchData('login', { senha: p });
    if(res.success) { localStorage.setItem('churchAdminPass', p); location.reload(); }
    else showToast("Senha incorreta.");
}
function verificarSessaoAdmin() {
    if(localStorage.getItem('churchAdminPass')) {
        document.getElementById('adminPanel').classList.remove('hidden');
        document.getElementById('loginSection').classList.add('hidden');
        document.getElementById('memberArea').classList.add('hidden');
    }
}
function logoutAdmin() { localStorage.removeItem('churchAdminPass'); location.reload(); }

let itensEscalaTemp = [];
function adicionarItemEscala() {
    itensEscalaTemp.push({
        data: document.getElementById('dataEscala').value,
        hora: document.getElementById('horaEscala').value,
        evento: document.getElementById('eventoEscala').value,
        dirigentes: document.getElementById('dirigentesEscala').value,
        porteiros: document.getElementById('porteirosEscala').value
    });
    atualizarPreview();
}

function atualizarPreview() {
    const lista = document.getElementById('listaPreview');
    const box = document.getElementById('previewEscala');
    
    lista.style.listStyle = "none";
    lista.style.padding = "0";
    lista.innerHTML = "";

    if(itensEscalaTemp.length > 0) {
        box.classList.remove('hidden');
        
        itensEscalaTemp.forEach((it, i) => {
            lista.innerHTML += `
                <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px; margin-bottom: 12px; position: relative; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <button onclick="removerItemPreview(${i})" class="icon-btn" style="position: absolute; top: 8px; right: 8px; color: #ef4444; background: rgba(239, 68, 68, 0.1); padding: 4px;" title="Remover este evento">
                        <span class="material-icons-round" style="font-size: 18px;">delete</span>
                    </button>
                    <h4 style="font-size: 0.9rem; color: var(--primary); margin-bottom: 8px; margin-right: 30px;">
                        Evento ${i + 1}
                    </h4>
                    <div class="form-grid" style="margin-bottom: 6px;">
                        <input type="date" value="${it.data}" onchange="atualizarItemTemp(${i}, 'data', this.value)" class="input-modern" style="padding: 8px; margin: 0;">
                        <input type="time" value="${it.hora}" onchange="atualizarItemTemp(${i}, 'hora', this.value)" class="input-modern" style="padding: 8px; margin: 0;">
                    </div>
                    <input type="text" value="${it.evento}" placeholder="Evento" onchange="atualizarItemTemp(${i}, 'evento', this.value)" class="input-modern" style="padding: 8px; margin-bottom: 6px;">
                    <input type="text" value="${it.dirigentes}" placeholder="Dirigentes" onchange="atualizarItemTemp(${i}, 'dirigentes', this.value)" class="input-modern" style="padding: 8px; margin-bottom: 6px;">
                    <input type="text" value="${it.porteiros}" placeholder="Porteiros" onchange="atualizarItemTemp(${i}, 'porteiros', this.value)" class="input-modern" style="padding: 8px; margin-bottom: 0;">
                </div>
            `;
        });
    } else {
        box.classList.add('hidden');
    }
}

function atualizarItemTemp(index, campo, valor) {
    itensEscalaTemp[index][campo] = valor;
}

function removerItemPreview(index) {
    itensEscalaTemp.splice(index, 1);
    atualizarPreview();
}

async function submitEscalaSemana() {
    const btn = document.getElementById('btnPublicarTudo');
    btn.innerText = "Publicando...";
    btn.disabled = true;

    const res = await fetchData('salvarEscalaLote', { 
        senha: localStorage.getItem('churchAdminPass'), 
        itens: itensEscalaTemp 
    });

    if(res && res.success) { 
        itensEscalaTemp = []; 
        atualizarPreview(); 
        carregarDados(); 
        showToast("Publicado!"); 
    } else {
        alert("O clique foi registrado, mas houve um erro ao processar. Abra o console (F12) para depurar o retorno do servidor.");
        showToast("Erro na publicação.");
    }

    btn.innerText = "Publicar Tudo";
    btn.disabled = false;
}

async function submitAviso() {
    const res = await fetchData('salvarAviso', {
        senha: localStorage.getItem('churchAdminPass'),
        titulo: document.getElementById('tituloAviso').value,
        mensagem: document.getElementById('msgAviso').value
    });
    if(res.success) { document.getElementById('tituloAviso').value=''; document.getElementById('msgAviso').value=''; carregarDados(); showToast("Enviado!"); }
}

function parseDataSegura(s) {
    if(!s) return new Date();
    let d = new Date(s);
    if(isNaN(d.getTime())) {
        const p = s.split('-');
        d = new Date(p[0], p[1]-1, p[2]);
    }
    return d;
}

function formatarHoraGoogle(h) {
    if(!h || !h.includes('T')) return h || "";
    const t = h.split('T')[1];
    let [hrs, min] = t.split(':').map(Number);
    let tot = (hrs * 60) + min - 186;
    if(tot < 0) tot += 1440;
    return `${Math.floor(tot/60).toString().padStart(2,'0')}:${(tot%60).toString().padStart(2,'0')}`;
}

function showToast(m) {
    const t = document.getElementById('toast');
    t.innerText = m; t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 3000);
}
function fecharModalPix() { document.getElementById('modalPix').classList.add('hidden'); }
function abrirModalPix() { document.getElementById('modalPix').classList.remove('hidden'); }
function copiarPix() { navigator.clipboard.writeText(document.getElementById('chavePixTexto').innerText); showToast("Copiado!"); }

let deferredPrompt;

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW Registrado!'))
            .catch(err => console.error('Erro no SW:', err));
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const banner = document.getElementById('installBanner');
    if (!localStorage.getItem('pwa_dismissed') && banner) {
        banner.classList.remove('hidden');
    }
});

function instalarApp() {
    const banner = document.getElementById('installBanner');
    if (deferredPrompt) {
        banner.classList.add('hidden');
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('App instalado com sucesso!');
            }
            deferredPrompt = null;
        });
    }
}

function fecharBannerInstalacao() {
    document.getElementById('installBanner').classList.add('hidden');
    localStorage.setItem('pwa_dismissed', 'true');
}

document.addEventListener("DOMContentLoaded", () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone === true; 
    const banner = document.getElementById('installBanner');
    const installBtn = document.getElementById('installBtn');
    const installMsg = document.getElementById('installMessage');

    if (isIOS && !isStandalone && !localStorage.getItem('pwa_dismissed') && banner) {
        installMsg.innerHTML = "Para instalar no iPhone: toque em <b>Compartilhar</b> <span class='material-icons-round' style='font-size:12px; vertical-align:middle;'>ios_share</span> e depois <b>'Adicionar à Tela de Início'</b>.";
        installBtn.style.display = 'none'; 
        banner.classList.remove('hidden');
    }
});

function renderizarEscalaCards(id, dados) {
    const c = document.getElementById(id); c.innerHTML = "";
    if(!dados.length) { c.innerHTML = "<p class='text-center'>Sem agenda.</p>"; return; }
    
    const agora = new Date(); 
    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    const diasAgrupados = {};

    dados.forEach(e => {
        let objData = parseDataSegura(e.data);
        let nomeDia = diasSemana[objData.getDay()];
        let dataString = `${nomeDia}, ${objData.toLocaleDateString('pt-BR')}`;
        
        if (!diasAgrupados[dataString]) {
            diasAgrupados[dataString] = []; 
        }
        diasAgrupados[dataString].push(e); 
    });

    for (const [dataChave, eventosDoDia] of Object.entries(diasAgrupados)) {
        
        let htmlEventos = "";
        let temEventoHoje = false; 

        eventosDoDia.forEach(e => {
            let h = formatarHoraGoogle(e.hora);
            let objData = parseDataSegura(e.data);
            
            let [horas, minutos] = (h || "00:00").split(':').map(Number);
            let dataHoraEvento = new Date(objData.getFullYear(), objData.getMonth(), objData.getDate(), horas, minutos, 0);
            let dataHoraFim = new Date(dataHoraEvento.getTime() + (90 * 60000)); 
            
            let classeExtra = "";
            
            if (dataHoraFim.getTime() < agora.getTime()) {
                classeExtra = "passado"; 
            } else if (objData.getFullYear() === agora.getFullYear() && 
                       objData.getMonth() === agora.getMonth() && 
                       objData.getDate() === agora.getDate()) {
                classeExtra = "hoje"; 
                temEventoHoje = true; 
            }

            htmlEventos += `
            <div class="evento-item ${classeExtra}">
                <div class="evento-hora">${h}</div>
                <div class="evento-info">
                    <h4 class="evento-titulo">${e.evento}</h4>
                    <p class="evento-equipe"><b>D:</b> ${e.dirigentes}</p>
                    <p class="evento-equipe"><b>P:</b> ${e.porteiros}</p>
                </div>
            </div>`;
        });

        let idAttr = temEventoHoje ? 'id="card-hoje"' : '';

        c.innerHTML += `
        <div class="app-card dia-card" ${idAttr}>
            <div class="dia-header">
                <span class="material-icons-round">event</span> ${dataChave}
            </div>
            <div class="dia-body">
                ${htmlEventos}
            </div>
        </div>`;
    }

    setTimeout(rolarParaHoje, 500);
}

function rolarParaHoje() {
    const tabAgenda = document.getElementById('tabAgenda');
    const cardHoje = document.getElementById('card-hoje');
    
    if (tabAgenda.classList.contains('active') && cardHoje) {
        cardHoje.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function filtrarSemanaAtual(l) {
    const h = new Date(); 
    h.setHours(0, 0, 0, 0);
    
    let diaSemana = h.getDay(); 
    let diffParaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
    
    const seg = new Date(h); 
    seg.setDate(h.getDate() + diffParaSegunda); 
    
    const dom = new Date(seg); 
    dom.setDate(seg.getDate() + 6); 
    dom.setHours(23, 59, 59, 999);
    
    return l.filter(i => {
        const di = parseDataSegura(i.data);
        return di >= seg && di <= dom;
    });
}

function repetirEscalaAnterior() {
    if (!strDadosAgenda || strDadosAgenda === "[]") {
        return showToast("Aguarde a agenda carregar ou verifique se há eventos.");
    }

    const escalaAnterior = JSON.parse(strDadosAgenda);
    
    itensEscalaTemp = [];

    escalaAnterior.forEach(item => {
        let dataAntiga = parseDataSegura(item.data);
        dataAntiga.setDate(dataAntiga.getDate() + 7);

        let ano = dataAntiga.getFullYear();
        let mes = String(dataAntiga.getMonth() + 1).padStart(2, '0');
        let dia = String(dataAntiga.getDate()).padStart(2, '0');
        let novaDataString = `${ano}-${mes}-${dia}`;

        let horaFormatada = formatarHoraGoogle(item.hora) || item.hora;

        itensEscalaTemp.push({
            data: novaDataString,
            hora: horaFormatada,
            evento: item.evento,
            dirigentes: item.dirigentes,
            porteiros: item.porteiros
        });
    });

    atualizarPreview();
    document.getElementById('previewEscala').scrollIntoView({ behavior: 'smooth' });
    showToast("Escala copiada! Você pode apagar eventos indesejados no 'X' antes de publicar.");
}
