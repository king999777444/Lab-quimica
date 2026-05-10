import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const MM  = { agua: 18.0, anidrido: 102.1, acido: 60.0 };
const RHO = { agua: 1000, anidrido: 1080, acido: 1050 };
const CP_COEF = {
  agua:     { a: 92.1101, b: -4.00e-2, c: -2.21e-4, d:  5.35e-7 },
  anidrido: { a: 71.8,    b:  8.89e-1, c: -2.65e-3, d:  3.35e-6 },
  acido:    { a: -18.9,   b:  1.10,    c: -2.89e-3, d:  2.93e-6 },
};
const DELTA_HR_J = -14.4 * 4187;

const SCENARIO_MODIFIERS = {
  isolado_rapida_semVent:       { tmax_frac: 0.97, tau: 3.5, noise: 0.4 },
  isolado_rapida_comVent:       { tmax_frac: 0.90, tau: 3.2, noise: 0.5 },
  isolado_lenta_semVent:        { tmax_frac: 0.92, tau: 5.0, noise: 0.6 },
  isolado_lenta_comVent:        { tmax_frac: 0.85, tau: 4.5, noise: 0.7 },
  semIsolamento_rapida_semVent: { tmax_frac: 0.70, tau: 2.5, noise: 0.8 },
  semIsolamento_rapida_comVent: { tmax_frac: 0.58, tau: 2.2, noise: 0.9 },
  semIsolamento_lenta_semVent:  { tmax_frac: 0.62, tau: 4.0, noise: 1.0 },
  semIsolamento_lenta_comVent:  { tmax_frac: 0.50, tau: 3.8, noise: 1.1 },
};
const SCENARIO_LABELS = {
  isolado_rapida_semVent:       "Isolado | Agit. Rápida | Sem Ventilação",
  isolado_rapida_comVent:       "Isolado | Agit. Rápida | Com Ventilação",
  isolado_lenta_semVent:        "Isolado | Agit. Lenta  | Sem Ventilação",
  isolado_lenta_comVent:        "Isolado | Agit. Lenta  | Com Ventilação",
  semIsolamento_rapida_semVent: "Sem Iso | Agit. Rápida | Sem Ventilação",
  semIsolamento_rapida_comVent: "Sem Iso | Agit. Rápida | Com Ventilação",
  semIsolamento_lenta_semVent:  "Sem Iso | Agit. Lenta  | Sem Ventilação",
  semIsolamento_lenta_comVent:  "Sem Iso | Agit. Lenta  | Com Ventilação",
};

// ─── CÁLCULO ─────────────────────────────────────────────────────────────────
function cpVal(subst, T_K) {
  const { a, b, c, d } = CP_COEF[subst];
  return a + b * T_K + c * T_K ** 2 + d * T_K ** 3;
}

function calcularComposicao(V_agua_mL, V_ani_mL) {
  const m_agua_g = V_agua_mL * RHO.agua     / 1000;
  const m_ani_g  = V_ani_mL  * RHO.anidrido / 1000;
  const n_agua = m_agua_g / MM.agua;
  const n_ani  = m_ani_g  / MM.anidrido;
  const n_total_ini = n_agua + n_ani;
  const n_ani_reagido = Math.min(n_ani, n_agua);
  const n_agua_final  = n_agua - n_ani_reagido;
  const n_acido_final = 2 * n_ani_reagido;
  const n_total_fin   = n_agua_final + n_acido_final;
  return {
    ini: {
      agua:     { m: m_agua_g, n: n_agua, x: n_agua / n_total_ini },
      anidrido: { m: m_ani_g,  n: n_ani,  x: n_ani  / n_total_ini },
      n_total: n_total_ini,
    },
    fin: {
      agua:  { m: n_agua_final  * MM.agua,  n: n_agua_final,  x: n_agua_final  / n_total_fin },
      acido: { m: n_acido_final * MM.acido, n: n_acido_final, x: n_acido_final / n_total_fin },
      n_total: n_total_fin,
    },
    n_ani_reagido,
    limitante: n_ani <= n_agua ? "anidrido" : "água",
  };
}

function calcularCpDetalhado(comp, T_C, estado) {
  const T_K = T_C + 273.15;
  if (estado === "ini") {
    const cp_agua = cpVal("agua",     T_K);
    const cp_ani  = cpVal("anidrido", T_K);
    const cp_mix  = comp.ini.agua.x * cp_agua + comp.ini.anidrido.x * cp_ani;
    return { cp_agua, cp_ani, cp_acido: null, cp_mix };
  } else {
    const cp_agua  = cpVal("agua",  T_K);
    const cp_acido = cpVal("acido", T_K);
    const cp_mix   = comp.fin.agua.x * cp_agua + comp.fin.acido.x * cp_acido;
    return { cp_agua, cp_ani: null, cp_acido, cp_mix };
  }
}

function calcularQ_Tmax(comp, T_ini_C) {
  const Q = -comp.n_ani_reagido * DELTA_HR_J;
  const cp_ini = calcularCpDetalhado(comp, T_ini_C, "ini").cp_mix;
  let T_max_C = T_ini_C + 30;
  for (let i = 0; i < 25; i++) {
    const cp_fin = calcularCpDetalhado(comp, T_max_C, "fin").cp_mix;
    T_max_C = T_ini_C + Q / (comp.fin.n_total * (cp_ini + cp_fin) / 2);
  }
  return { Q, T_max_C };
}

function seededRng(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function gerarCurva(T_ini, T_max, tau, noise, seed) {
  const dT = T_max - T_ini, rng = seededRng(seed);
  return Array.from({ length: 51 }, (_, t) => ({
    t,
    T: +Math.max(T_ini, T_ini + dT * (t / tau) * Math.exp(1 - t / tau) + (rng() - 0.5) * noise * 2).toFixed(2),
  }));
}

function calcularResultado(V_agua, V_ani, T_ar, sk, curvaManual = null) {
  const comp = calcularComposicao(V_agua, V_ani);
  const { Q, T_max_C } = calcularQ_Tmax(comp, T_ar);
  const mod = SCENARIO_MODIFIERS[sk];
  const T_max_real = T_ar + (T_max_C - T_ar) * mod.tmax_frac;
  const curva = curvaManual || gerarCurva(T_ar, T_max_real, mod.tau * 4, mod.noise, Math.floor(T_ar * 100 + V_ani * 10));
  const pico  = curva.reduce((a, b) => b.T > a.T ? b : a, curva[0]);
  const cpIni = calcularCpDetalhado(comp, T_ar,        "ini");
  const cpFin = calcularCpDetalhado(comp, T_max_real,  "fin");
  const cpMed = (cpIni.cp_mix + cpFin.cp_mix) / 2;
  return { comp, Q, T_max_C, T_max_real, cpIni, cpFin, cpMed, curva, pico, label: SCENARIO_LABELS[sk], T_ar, V_agua, V_ani };
}

// ─── UI HELPERS ──────────────────────────────────────────────────────────────
function Badge({ children, color = "#00e5ff" }) {
  return <span style={{ background: color+"22", border:`1px solid ${color}66`, color, borderRadius:4, padding:"2px 8px", fontSize:11, fontFamily:"monospace" }}>{children}</span>;
}
function Card({ children, style }) {
  return <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:20, ...style }}>{children}</div>;
}
function SLabel({ children }) {
  return <div style={{ fontSize:11, color:"#555", letterSpacing:2, marginBottom:10 }}>{children}</div>;
}
function NumInput({ label, value, onChange, unit, min, max }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
      <label style={{ fontSize:11, color:"#777", letterSpacing:1, textTransform:"uppercase" }}>{label}</label>
      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
        <input type="number" value={value} onChange={e=>onChange(e.target.value)} min={min} max={max} step="any"
          style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:6, padding:"8px 12px", color:"#fff", fontSize:14, width:"100%", outline:"none", fontFamily:"monospace" }} />
        {unit && <span style={{ color:"#555", fontSize:12, whiteSpace:"nowrap" }}>{unit}</span>}
      </div>
    </div>
  );
}

function ComposicaoTable({ comp }) {
  const thS = { textAlign:"left", padding:"4px 8px", borderBottom:"1px solid #1a1a1a", color:"#444", fontSize:11 };
  const tdS = { padding:"6px 8px", fontFamily:"monospace", color:"#888" };
  return (
    <div style={{ display:"grid", gap:16 }}>
      <div>
        <SLabel>ESTADO INICIAL</SLabel>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead><tr>{["Substância","Massa (g)","n (mol)","x_i molar"].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
          <tbody>
            {[
              ["Água",         comp.ini.agua.m.toFixed(4),     comp.ini.agua.n.toFixed(4),     comp.ini.agua.x.toFixed(4),     null],
              ["Anidrido Ac.", comp.ini.anidrido.m.toFixed(4), comp.ini.anidrido.n.toFixed(4), comp.ini.anidrido.x.toFixed(4), null],
              ["SOMA",         (comp.ini.agua.m+comp.ini.anidrido.m).toFixed(4), comp.ini.n_total.toFixed(4), "1.0000", "#00e5ff"],
            ].map(([s,m,n,x,c])=>(
              <tr key={s} style={{ borderBottom:"1px solid #0f0f0f" }}>
                <td style={{ ...tdS, color:c||"#bbb", fontWeight:c?700:400 }}>{s}</td>
                <td style={tdS}>{m}</td><td style={tdS}>{n}</td><td style={tdS}>{x}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <SLabel>ESTADO FINAL (reação completa)</SLabel>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead><tr>{["Substância","Massa (g)","n (mol)","x_i molar"].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
          <tbody>
            {[
              ["Água",      comp.fin.agua.m.toFixed(4),  comp.fin.agua.n.toFixed(4),  comp.fin.agua.x.toFixed(4),  null],
              ["Ácido Ac.", comp.fin.acido.m.toFixed(4), comp.fin.acido.n.toFixed(4), comp.fin.acido.x.toFixed(4), null],
              ["SOMA",      (comp.fin.agua.m+comp.fin.acido.m).toFixed(4), comp.fin.n_total.toFixed(4), "1.0000", "#a8ff3e"],
            ].map(([s,m,n,x,c])=>(
              <tr key={s} style={{ borderBottom:"1px solid #0f0f0f" }}>
                <td style={{ ...tdS, color:c||"#bbb", fontWeight:c?700:400 }}>{s}</td>
                <td style={tdS}>{m}</td><td style={tdS}>{n}</td><td style={tdS}>{x}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize:12, color:"#444", marginTop:6 }}>
          Limitante: <Badge color="#ffe600">{comp.limitante}</Badge>
          &nbsp;| n reagido: <span style={{ fontFamily:"monospace", color:"#777" }}>{comp.n_ani_reagido.toFixed(4)} mol</span>
        </div>
      </div>
    </div>
  );
}

function CpEnergia({ r }) {
  const rowS = { display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid #0f0f0f", fontSize:13 };
  const lbl = t => <span style={{ color:"#666" }}>{t}</span>;
  const val = (v, u, c="#00e5ff") => <span style={{ fontFamily:"monospace", color:c }}>{v} <span style={{ color:"#333", fontSize:11 }}>{u}</span></span>;
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
      {/* Cp detalhado — estado inicial e final */}
      <Card>
        <SLabel>Cp (J/mol·K)</SLabel>
        <div style={{ fontSize:11, color:"#3a4a3a", marginBottom:5 }}>— Estado inicial ({r.T_ar} °C)</div>
        <div style={rowS}>{lbl("Água")}           {val(r.cpIni.cp_agua.toFixed(3), "J/mol·K")}</div>
        <div style={rowS}>{lbl("Anidrido Ac.")}   {val(r.cpIni.cp_ani.toFixed(3),  "J/mol·K")}</div>
        <div style={{ ...rowS, marginBottom:12 }}>{lbl("Mistura ini")} {val(r.cpIni.cp_mix.toFixed(3), "J/mol·K", "#ffe600")}</div>

        <div style={{ fontSize:11, color:"#3a4a3a", marginBottom:5 }}>— Estado final ({r.T_max_real.toFixed(1)} °C)</div>
        <div style={rowS}>{lbl("Água")}           {val(r.cpFin.cp_agua.toFixed(3),  "J/mol·K")}</div>
        <div style={rowS}>{lbl("Ácido Ac.")}      {val(r.cpFin.cp_acido.toFixed(3), "J/mol·K")}</div>
        <div style={{ ...rowS, marginBottom:12 }}>{lbl("Mistura fin")} {val(r.cpFin.cp_mix.toFixed(3), "J/mol·K", "#ffe600")}</div>

        <div style={{ ...rowS, borderBottom:"none" }}>{lbl("Cp médio")} {val(r.cpMed.toFixed(3), "J/mol·K", "#a8ff3e")}</div>
      </Card>

      {/* Energia */}
      <Card>
        <SLabel>ENERGIA & TEMPERATURA</SLabel>
        {[
          ["Q liberado",     (r.Q/1000).toFixed(3),           "kJ",  "#ff6b35"],
          ["T_max teórica",  r.T_max_C.toFixed(2),            "°C",  "#ff6b35"],
          ["T_max simulada", r.T_max_real.toFixed(2),         "°C",  "#ff6b35"],
          ["ΔT real",        (r.T_max_real-r.T_ar).toFixed(2),"°C",  "#ff6b35"],
          ["t_pico",         String(r.pico.t),                "min", "#ffe600"],
          ["T_pico",         r.pico.T.toFixed(2),             "°C",  "#ffe600"],
        ].map(([l,v,u,c])=>(
          <div key={l} style={rowS}>{lbl(l)} {val(v, u, c)}</div>
        ))}
      </Card>
    </div>
  );
}

const ttS = { contentStyle:{ background:"#090c10", border:"1px solid #1a1a1a", borderRadius:6, fontSize:12 } };

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode]   = useState("menu");
  const [vAgua, setVAgua] = useState(50);
  const [vAni,  setVAni]  = useState(5);
  const [tAr,   setTAr]   = useState(25);
  const [sk,    setSk]    = useState("isolado_rapida_semVent");
  const [manualRows, setManualRows] = useState(
    Array.from({ length: 50 }, (_, i) => ({ t: i, T: "" }))
  );
  const [manualResult, setManualResult] = useState(null);
  const [simResults,   setSimResults]   = useState([]);
  const [selectedSim,  setSelectedSim]  = useState(null);
  const [simTAr, setSimTAr] = useState([20, 30]);

  const S = {
    app:  { minHeight:"100vh", background:"#080c0f", color:"#e0e0e0", fontFamily:"'IBM Plex Mono','Courier New',monospace" },
    hdr:  { borderBottom:"1px solid rgba(0,229,255,0.1)", padding:"16px 28px", display:"flex", alignItems:"center", gap:14, background:"rgba(0,229,255,0.02)" },
    ttl:  { fontSize:16, fontWeight:700, color:"#00e5ff", letterSpacing:3, textTransform:"uppercase", margin:0 },
    sub:  { fontSize:10, color:"#1e2a30", letterSpacing:2 },
    body: { padding:"22px 28px", maxWidth:1200, margin:"0 auto" },
    back: { background:"transparent", border:"1px solid #1e1e1e", color:"#555", borderRadius:6, padding:"6px 14px", cursor:"pointer", fontSize:11, fontFamily:"inherit" },
    run:  { background:"rgba(0,229,255,0.07)", border:"1px solid rgba(0,229,255,0.45)", color:"#00e5ff", borderRadius:8, padding:"10px 22px", cursor:"pointer", fontSize:12, letterSpacing:2, textTransform:"uppercase", fontFamily:"inherit" },
  };

  const runManual = () => {
    const curva = manualRows.filter(r => r.T !== "").map(r => ({ t: +r.t, T: +r.T }));
    if (curva.length < 2) return alert("Preencha ao menos 2 pontos de temperatura.");
    setManualResult(calcularResultado(+vAgua, +vAni, +tAr, sk, curva));
  };

  const runSim = () => {
    const tArs = [+simTAr[0], (+simTAr[0] + +simTAr[1]) / 2, +simTAr[1]];
    const res = Object.keys(SCENARIO_MODIFIERS).flatMap(k => tArs.map(t => calcularResultado(+vAgua, +vAni, t, k)));
    setSimResults(res);
    setSelectedSim(res[0]);
  };

  const ParamsBar = () => (
    <Card style={{ marginBottom:16 }}>
      <SLabel>PARÂMETROS EXPERIMENTAIS</SLabel>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
        <NumInput label="V_água"     value={vAgua} onChange={setVAgua} unit="mL" min={1} />
        <NumInput label="V_anidrido" value={vAni}  onChange={setVAni}  unit="mL" min={1} />
        <NumInput label="T_ar"       value={tAr}   onChange={setTAr}   unit="°C" min={15} max={40} />
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          <label style={{ fontSize:11, color:"#777", letterSpacing:1, textTransform:"uppercase" }}>Cenário</label>
          <select value={sk} onChange={e=>setSk(e.target.value)}
            style={{ background:"#0c1014", border:"1px solid rgba(255,255,255,0.08)", borderRadius:6, padding:"8px 10px", color:"#ccc", fontSize:11, fontFamily:"inherit" }}>
            {Object.entries(SCENARIO_LABELS).map(([k,l])=><option key={k} value={k}>{l}</option>)}
          </select>
        </div>
      </div>
    </Card>
  );

  // ── MENU ──
  if (mode === "menu") return (
    <div style={S.app}>
      <div style={S.hdr}><div><p style={S.ttl}>⚗ Lab Reação Exotérmica</p><p style={S.sub}>PQI-3140 · Hidrólise do Anidrido Acético · Poli-USP</p></div></div>
      <div style={{ ...S.body, display:"flex", flexDirection:"column", alignItems:"center", paddingTop:70, gap:14 }}>
        <div style={{ fontSize:11, color:"#1a1a1a", letterSpacing:4, marginBottom:20 }}>SELECIONE O MODO</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18, width:"100%", maxWidth:520 }}>
          {[["📋 Entrada Manual","Preencha sua tabela t/T","manual","#00e5ff"],
            ["🔬 Simulação","8 cenários × variações T_ar","simulacao","#ff6b35"]].map(([t,s,m,c])=>(
            <button key={m} onClick={()=>setMode(m)}
              style={{ background:c+"12", border:`1px solid ${c}30`, color:c, borderRadius:10, padding:"20px 24px", cursor:"pointer", fontSize:13, letterSpacing:2, textTransform:"uppercase", fontFamily:"inherit" }}>
              {t}<br/><span style={{ fontSize:10, color:"#1e2a30", marginTop:4, display:"block" }}>{s}</span>
            </button>
          ))}
        </div>
        <div style={{ marginTop:50, fontSize:11, color:"#181818", maxWidth:440, textAlign:"center", lineHeight:2 }}>
          ΔH_r = –14,4 kcal/mol · (CH₃CO)₂O + H₂O → 2 CH₃COOH<br/>
          Cp = a + bT + cT² + dT³ (T em K, Cp em J/mol·K)
        </div>
      </div>
    </div>
  );

  // ── MANUAL ──
  if (mode === "manual") return (
    <div style={S.app}>
      <div style={S.hdr}>
        <button onClick={()=>setMode("menu")} style={S.back}>← voltar</button>
        <div><p style={S.ttl}>📋 Entrada Manual</p><p style={S.sub}>Dados medidos no laboratório</p></div>
      </div>
      <div style={S.body}>
        <ParamsBar />
        <div style={{ display:"grid", gridTemplateColumns:"290px 1fr", gap:18 }}>

          {/* Tabela 50 linhas */}
          <Card style={{ display:"flex", flexDirection:"column" }}>
            <SLabel>TABELA t × T (50 entradas)</SLabel>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:3, marginBottom:8 }}>
              <div style={{ fontSize:11, color:"#2a2a2a", textAlign:"center" }}>t (min)</div>
              <div style={{ fontSize:11, color:"#2a2a2a", textAlign:"center" }}>T (°C)</div>
            </div>
            <div style={{ overflowY:"auto", maxHeight:560, display:"flex", flexDirection:"column", gap:3 }}>
              {manualRows.map((row, i) => (
                <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4 }}>
                  <input type="number" value={row.t}
                    onChange={e=>{const r=[...manualRows];r[i]={...r[i],t:e.target.value};setManualRows(r);}}
                    style={{ background:"#0a0e12", border:"1px solid #141a20", borderRadius:4, padding:"4px 7px", color:"#444", fontSize:12, fontFamily:"monospace" }} />
                  <input type="number" placeholder="—" value={row.T}
                    onChange={e=>{const r=[...manualRows];r[i]={...r[i],T:e.target.value};setManualRows(r);}}
                    style={{ background:"#0a0e12", border:"1px solid #141a20", borderRadius:4, padding:"4px 7px", color:"#00e5ff", fontSize:12, fontFamily:"monospace" }} />
                </div>
              ))}
            </div>
            <button onClick={runManual} style={{ ...S.run, marginTop:14, width:"100%" }}>▶ Calcular</button>
          </Card>

          {/* Resultados */}
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {manualResult ? (
              <>
                <Card>
                  <SLabel>GRÁFICO T × t</SLabel>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={manualResult.curva}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#0d0d0d" />
                      <XAxis dataKey="t" stroke="#1e1e1e" tick={{ fontSize:10 }} label={{ value:"t (min)", position:"insideBottom", offset:-2, fill:"#333", fontSize:10 }} />
                      <YAxis stroke="#1e1e1e" tick={{ fontSize:10 }} label={{ value:"T (°C)", angle:-90, position:"insideLeft", fill:"#333", fontSize:10 }} />
                      <Tooltip {...ttS} />
                      <Line type="monotone" dataKey="T" stroke="#00e5ff" strokeWidth={2} dot={{ r:2, fill:"#00e5ff" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
                <Card><ComposicaoTable comp={manualResult.comp} /></Card>
                <CpEnergia r={manualResult} />
                <Card>
                  <SLabel>DISCUSSÃO TERMODINÂMICA</SLabel>
                  <div style={{ fontSize:13, lineHeight:2.1, color:"#666" }}>
                    <div>• <span style={{ color:"#00e5ff" }}>Isobárica</span>: béquer aberto → P = P_atm constante → ΔH = Q</div>
                    <div>• <span style={{ color:"#00e5ff" }}>Não isotérmica</span>: T varia com o tempo (visível no gráfico)</div>
                    <div>• <span style={{ color:"#00e5ff" }}>Não isocórica</span>: ΔV ≈ 0 em fase líquida (desprezível)</div>
                    <div>• <span style={{ color:"#ff6b35" }}>Trabalho</span>: W = –P·ΔV ≈ 0 → ΔU ≈ ΔH</div>
                    <div>• <span style={{ color:"#a8ff3e" }}>ΔH_r = –14,4 kcal/mol → reação exotérmica</span></div>
                  </div>
                </Card>
              </>
            ) : (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:260, color:"#1a1a1a", fontSize:13 }}>
                Preencha a tabela e clique em Calcular
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ── SIMULAÇÃO ──
  if (mode === "simulacao") return (
    <div style={S.app}>
      <div style={S.hdr}>
        <button onClick={()=>setMode("menu")} style={S.back}>← voltar</button>
        <div><p style={S.ttl}>🔬 Simulação de Cenários</p><p style={S.sub}>8 condições × variações de T_ar</p></div>
      </div>
      <div style={S.body}>
        <Card style={{ marginBottom:16 }}>
          <SLabel>PARÂMETROS DA SIMULAÇÃO</SLabel>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:14, alignItems:"end" }}>
            <NumInput label="V_água"     value={vAgua}     onChange={setVAgua}                    unit="mL" />
            <NumInput label="V_anidrido" value={vAni}      onChange={setVAni}                     unit="mL" />
            <NumInput label="T_ar mín"   value={simTAr[0]} onChange={v=>setSimTAr([v,simTAr[1]])} unit="°C" min={15} max={40} />
            <NumInput label="T_ar máx"   value={simTAr[1]} onChange={v=>setSimTAr([simTAr[0],v])} unit="°C" min={15} max={40} />
            <button onClick={runSim} style={S.run}>▶ Simular</button>
          </div>
        </Card>

        {simResults.length > 0 && (
          <div style={{ display:"grid", gridTemplateColumns:"280px 1fr", gap:18 }}>
            <div style={{ display:"flex", flexDirection:"column", gap:5, maxHeight:700, overflowY:"auto" }}>
              {simResults.map((r,i)=>(
                <div key={i} onClick={()=>setSelectedSim(r)} style={{
                  background: selectedSim===r ? "rgba(0,229,255,0.05)" : "rgba(255,255,255,0.01)",
                  border:`1px solid ${selectedSim===r ? "#00e5ff2a" : "#111"}`,
                  borderRadius:8, padding:"8px 12px", cursor:"pointer",
                }}>
                  <div style={{ fontSize:10, color:selectedSim===r?"#00e5ff":"#3a3a3a", marginBottom:5 }}>{r.label}</div>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    <Badge color="#ffe600">T_ar={r.T_ar}°C</Badge>
                    <Badge color="#ff6b35">ΔT={+(r.T_max_real-r.T_ar).toFixed(1)}°C</Badge>
                    <Badge color="#a8ff3e">Tpk={r.pico.T.toFixed(1)}°C</Badge>
                  </div>
                </div>
              ))}
            </div>

            {selectedSim && (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <Card>
                  <SLabel>CURVA T × t — {selectedSim.label}</SLabel>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={selectedSim.curva}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#0d0d0d" />
                      <XAxis dataKey="t" stroke="#1e1e1e" tick={{ fontSize:10 }} />
                      <YAxis stroke="#1e1e1e" tick={{ fontSize:10 }} />
                      <Tooltip {...ttS} />
                      <Line type="monotone" dataKey="T" stroke="#00e5ff" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
                <Card>
                  <SLabel>COMPARATIVO T_max POR CENÁRIO (T_ar = {selectedSim.T_ar}°C)</SLabel>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={simResults.filter(r=>r.T_ar===selectedSim.T_ar).map(r=>({
                      name: r.label.slice(0,20),
                      T_max: +r.T_max_real.toFixed(2),
                      T_pk:  +r.pico.T.toFixed(2),
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#0d0d0d" />
                      <XAxis dataKey="name" stroke="#1e1e1e" tick={{ fontSize:8 }} />
                      <YAxis stroke="#1e1e1e" tick={{ fontSize:10 }} />
                      <Tooltip {...ttS} />
                      <Legend wrapperStyle={{ fontSize:11 }} />
                      <Line type="monotone" dataKey="T_max" stroke="#ff6b35" strokeWidth={2} dot={{ r:4 }} name="T_max simulada" />
                      <Line type="monotone" dataKey="T_pk"  stroke="#00e5ff" strokeWidth={2} dot={{ r:4 }} name="T_pico" />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
                <Card><ComposicaoTable comp={selectedSim.comp} /></Card>
                <CpEnergia r={selectedSim} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
