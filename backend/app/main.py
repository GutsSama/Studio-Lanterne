"""Point d'entrée FastAPI — Le Beffroi Central (Studio Lanterne) + Dashboard Observabilité LiteLLM."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from app.api.routes import router as api_router
from app.api.websocket import ws_router
from app.config import settings

app = FastAPI(
    title="Studio Lanterne — Créatures de la Nuit vs IA",
    description=(
        "Moteur de jeu déterministe anti-triche et orchestrateur multi-modèles LiteLLM "
        "(Groq, Mistral, Gemini) conforme RGPD & AI Act."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(ws_router)


@app.get("/health", tags=["systeme"])
async def healthcheck() -> dict[str, str]:
    return {"statut": "ok", "service": "studio-lanterne-backend"}


DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="fr" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Studio Lanterne — Dashboard Observabilité LiteLLM</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen font-sans p-6">
  <div class="max-w-7xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div>
        <div class="flex items-center gap-3">
          <span class="text-2xl">🌙</span>
          <h1 class="text-2xl font-bold bg-gradient-to-r from-amber-300 via-purple-400 to-sky-400 bg-clip-text text-transparent">
            Studio Lanterne — Dashboard Observabilité LiteLLM
          </h1>
        </div>
        <p class="text-slate-400 text-sm mt-1">
          Suivi en temps réel des coûts (USD), tokens, latences et statut multi-fournisseurs (Groq, Mistral AI, Google Gemini)
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <button id="btn-simuler" onclick="simulerTourDirect(false)" class="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition shadow-lg shadow-purple-900/40">
          ⚡ Tester un tour des 5 IA en direct
        </button>
        <button onclick="simulerTourDirect(true)" class="px-4 py-2.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 text-white font-medium text-sm transition">
          🆕 Nouvelle Partie
        </button>
        <button onclick="verifierCles()" class="px-4 py-2.5 rounded-xl bg-amber-600/80 hover:bg-amber-500 text-white font-medium text-sm transition">
          🔑 Diagnostiquer mes clés API
        </button>
        <button onclick="chargerMetriques()" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm border border-slate-700 transition">
          🔄 Rafraîchir
        </button>
        <a href="/docs" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 font-medium text-sm border border-slate-700 transition">
          Swagger /docs ↗
        </a>
      </div>
    </div>

    <!-- Bandeau statut simulation -->
    <div id="statut-sim" class="hidden rounded-xl border border-purple-500/40 bg-purple-950/30 px-4 py-3 text-sm text-purple-200"></div>

    <!-- KPI Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div class="text-xs uppercase tracking-wider text-slate-400">Coût Total Cumulé (LiteLLM)</div>
        <div id="kpi-cout" class="text-3xl font-bold text-amber-400 mt-2">$0.000000</div>
        <div class="text-xs text-slate-500 mt-1">Cible Low-Cost : &lt; $0.003 / partie</div>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div class="text-xs uppercase tracking-wider text-slate-400">Tokens Consommés</div>
        <div id="kpi-tokens" class="text-3xl font-bold text-sky-400 mt-2">0</div>
        <div class="text-xs text-slate-500 mt-1">Plafond d'urgence : 50 000 tokens / partie</div>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div class="text-xs uppercase tracking-wider text-slate-400">Latence Moyenne</div>
        <div id="kpi-latence" class="text-3xl font-bold text-emerald-400 mt-2">0 ms</div>
        <div class="text-xs text-slate-500 mt-1">Timeout coupe-circuit fixé à 3 500 ms</div>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div class="text-xs uppercase tracking-wider text-slate-400">Appels LLM &amp; Résilience</div>
        <div id="kpi-appels" class="text-3xl font-bold text-purple-400 mt-2">0</div>
        <div id="kpi-taux" class="text-xs text-slate-400 mt-1">Succès : 0 | Fallbacks : 0</div>
      </div>
    </div>

    <!-- Tableaux Par Modèle & Par Agent -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Par Modèle -->
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 class="text-lg font-semibold text-white mb-4">📊 Répartition par Modèle &amp; Fournisseur</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th class="py-2">Modèle LiteLLM</th>
                <th class="py-2">Appels (OK/FB)</th>
                <th class="py-2">Latence</th>
                <th class="py-2">Tokens</th>
                <th class="py-2">Coût USD</th>
              </tr>
            </thead>
            <tbody id="table-modeles" class="divide-y divide-slate-800/60">
              <tr><td colspan="5" class="py-4 text-center text-slate-500">Aucun appel enregistré pour le moment.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Par Agent IA -->
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 class="text-lg font-semibold text-white mb-4">🎭 Consommation par Personnalité IA</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th class="py-2">Agent IA</th>
                <th class="py-2">Modèle</th>
                <th class="py-2">Appels</th>
                <th class="py-2">Tokens</th>
                <th class="py-2">Coût USD</th>
              </tr>
            </thead>
            <tbody id="table-agents" class="divide-y divide-slate-800/60">
              <tr><td colspan="5" class="py-4 text-center text-slate-500">Aucun appel enregistré pour le moment.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Journal des derniers appels -->
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <h2 class="text-lg font-semibold text-white mb-4">📜 Journal en direct des requêtes LiteLLM (30 dernières)</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th class="py-2">Heure (UTC)</th>
              <th class="py-2">Agent IA</th>
              <th class="py-2">Modèle</th>
              <th class="py-2">Phase</th>
              <th class="py-2">Statut</th>
              <th class="py-2">Latence</th>
              <th class="py-2">Tokens (In/Out)</th>
              <th class="py-2">Coût</th>
              <th class="py-2">Diagnostic / Erreur</th>
            </tr>
          </thead>
          <tbody id="table-logs" class="divide-y divide-slate-800/60">
            <tr><td colspan="9" class="py-6 text-center text-slate-500">Cliquez sur « ⚡ Tester un tour des 5 IA en direct » pour générer des appels LLM.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    let partieTestId = null;

    async function chargerMetriques() {
      const res = await fetch('/api/metrics/llm');
      const data = await res.json();
      const g = data.resume_global;

      document.getElementById('kpi-cout').textContent = '$' + g.cout_total_usd.toFixed(6);
      document.getElementById('kpi-tokens').textContent = g.total_tokens.toLocaleString('fr-FR');
      document.getElementById('kpi-latence').textContent = g.latence_moyenne_ms + ' ms';
      document.getElementById('kpi-appels').textContent = g.total_appels + ' (' + g.taux_succes_pct + '%)';
      document.getElementById('kpi-taux').textContent = `Succès : ${g.appels_succes} | Fallbacks : ${g.appels_fallback}`;

      const tbodyM = document.getElementById('table-modeles');
      if (data.par_modele.length > 0) {
        tbodyM.innerHTML = data.par_modele.map(m => `
          <tr>
            <td class="py-2.5 font-mono text-xs text-sky-300">${m.modele}</td>
            <td class="py-2.5"><span class="text-emerald-400 font-semibold">${m.succes}</span> / <span class="text-rose-400">${m.fallbacks}</span></td>
            <td class="py-2.5">${m.latence_moyenne_ms} ms</td>
            <td class="py-2.5">${m.total_tokens}</td>
            <td class="py-2.5 font-mono text-amber-300">$${m.cout_usd.toFixed(6)}</td>
          </tr>
        `).join('');
      }

      const tbodyA = document.getElementById('table-agents');
      if (data.par_agent.length > 0) {
        tbodyA.innerHTML = data.par_agent.map(a => `
          <tr>
            <td class="py-2.5 font-medium text-white">${a.agent_nom}</td>
            <td class="py-2.5 font-mono text-xs text-slate-400">${a.modele}</td>
            <td class="py-2.5">${a.appels}</td>
            <td class="py-2.5">${a.total_tokens}</td>
            <td class="py-2.5 font-mono text-amber-300">$${a.cout_usd.toFixed(6)}</td>
          </tr>
        `).join('');
      }

      const tbodyL = document.getElementById('table-logs');
      if (data.derniers_appels.length > 0) {
        tbodyL.innerHTML = data.derniers_appels.map(l => `
          <tr>
            <td class="py-2 font-mono text-xs text-slate-400">${l.horodatage}</td>
            <td class="py-2 font-medium">${l.agent_nom}</td>
            <td class="py-2 font-mono text-xs text-sky-300">${l.modele}</td>
            <td class="py-2 text-xs">${l.phase}</td>
            <td class="py-2">
              ${l.statut === 'succes'
                ? '<span class="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">SUCCÈS</span>'
                : '<span class="px-2 py-0.5 rounded-full text-xs bg-rose-500/20 text-rose-300 border border-rose-500/30">FALLBACK</span>'}
            </td>
            <td class="py-2 font-mono text-xs">${l.latence_ms} ms</td>
            <td class="py-2 font-mono text-xs">${l.total_tokens} (${l.prompt_tokens}/${l.completion_tokens})</td>
            <td class="py-2 font-mono text-xs text-amber-300">$${l.cout_usd.toFixed(6)}</td>
            <td class="py-2 text-xs text-rose-300 max-w-xs truncate" title="${l.erreur || ''}">${l.erreur || '—'}</td>
          </tr>
        `).join('');
      }
    }

    async function simulerTourDirect(forcerNouvelle = false) {
      const btn = document.getElementById('btn-simuler');
      const bandeau = document.getElementById('statut-sim');
      btn.disabled = true;
      btn.textContent = '⏳ Interrogation des IA en cours...';
      bandeau.classList.remove('hidden');

      try {
        if (!partieTestId || forcerNouvelle) {
          const rCreate = await fetch('/api/parties', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({nom_humain: 'Sarah', consentement_ai_act: true})
          });
          const p = await rCreate.json();
          partieTestId = p.id;
        }
        const rSim = await fetch(`/api/parties/${partieTestId}/simuler-tour`, {method: 'POST'});
        const res = await rSim.json();
        bandeau.textContent = `✅ Phase "${res.phase_executee}" exécutée → Nouvelle phase : "${res.nouvelle_phase}" | Événements : ${(res.evenements || []).join(' • ')}`;
        if (res.nouvelle_phase === 'terminee') partieTestId = null;
        await chargerMetriques();
      } catch (e) {
        bandeau.textContent = '❌ Erreur : ' + e;
      } finally {
        btn.disabled = false;
        btn.textContent = '⚡ Tester un tour des 5 IA en direct';
      }
    }

    async function verifierCles() {
      const bandeau = document.getElementById('statut-sim');
      bandeau.classList.remove('hidden');
      bandeau.innerHTML = '⏳ Vérification des clés Groq, Mistral et Gemini en cours...';
      const r = await fetch('/api/diagnostic-cles');
      const d = await r.json();
      bandeau.innerHTML = '<pre class="text-xs whitespace-pre-wrap font-mono">' + JSON.stringify(d, null, 2) + '</pre>';
    }

    chargerMetriques();
    setInterval(chargerMetriques, 5000);
  </script>
</body>
</html>
"""


from pathlib import Path

PLATEAU_HTML_PATH = (
    Path(__file__).resolve().parent.parent.parent
    / "roadmap"
    / "studio_lantern"
    / "maquette_stitch_plateau.html"
)


@app.get("/", response_class=HTMLResponse, tags=["interface"])
@app.get("/plateau", response_class=HTMLResponse, tags=["interface"])
async def afficher_plateau_jeu() -> HTMLResponse:
    """Affiche l'interface 2D du jeu (maquette interactive Stitch)."""
    if PLATEAU_HTML_PATH.exists():
        return HTMLResponse(content=PLATEAU_HTML_PATH.read_text(encoding="utf-8"))
    alt_path = (
        Path(__file__).resolve().parent.parent.parent
        / "studio_lantern"
        / "maquette_stitch_plateau.html"
    )
    if alt_path.exists():
        return HTMLResponse(content=alt_path.read_text(encoding="utf-8"))
    return HTMLResponse(
        content="<h1 style='color:white;background:#0f172a;padding:2rem;'>Fichier maquette_stitch_plateau.html non trouvé.</h1>",
        status_code=404,
    )


@app.get("/dashboard-llm", response_class=HTMLResponse, tags=["observabilite"])
async def afficher_dashboard_llm() -> HTMLResponse:
    """Page web interactive de suivi des coûts, tokens et latence LiteLLM."""
    return HTMLResponse(content=DASHBOARD_HTML)
