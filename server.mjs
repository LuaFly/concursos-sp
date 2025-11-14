import express from "express";
import axios from "axios";
import cors from "cors";
import sqlite3 from "sqlite3";

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = "https://concursos-api.deno.dev";

app.use(cors());
app.use(express.json());

// SQLite
const db = new sqlite3.Database("./concursos.db");

db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS concursos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash_id TEXT UNIQUE,
      orgao TEXT,
      cargo TEXT,
      vagas TEXT,
      situacao TEXT,
      salario TEXT,
      link TEXT,
      is_ti INTEGER DEFAULT 0,
      fonte TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`
  );
});

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}


const ORGAOS = {
  pcsp: /pol[ií]cia civil|pc[- ]?sp/i,
  pf: /pol[ií]cia federal|dpf\b/i,
  abin: /\babin\b|ag[êe]ncia brasileira de intelig[êe]ncia/i,
};

const TI_KEYWORDS = [
  /\bTI\b/i,
  /t\.?i\.?/i,
  /tecnologia da informa[cç][aã]o/i,
  /tecnologia/i,
  /analista de sistemas?/i,
  /analista de t\.?i/i,
  /analista de tecnologia/i,
  /analista de informa[tç][aã]o/i,
  /analista de infraestrutura/i,
  /analista de suporte/i,
  /administrador de redes?/i,
  /seguran[cç]a da informa[cç][aã]o/i,
  /cyberseguran[cç]a/i,
  /ciberseguran[cç]a/i,
  /programador/i,
  /desenvolvedor(a)?/i,
  /software/i,
  /full[- ]?stack/i,
  /backend/i,
  /front[- ]?end/i,
  /engenheiro de software/i,
  /devops/i,
  /cientista de dados?/i,
  /analista de dados?/i,
  /data scientist/i,
  /data engineer/i,
  /forense digital/i,
  /forense/i,
  /per[ií]cia digital/i,
  /per[ií]cia forense/i,
  /perito/i,
  /per[ií]to criminal/i,
  /per[ií]to em inform[aá]tica/i,
];

function getOrgao(c) {
  return (
    c["Órgão"] ||
    c["Orgao"] ||
    c["orgão"] ||
    c["orgao"] ||
    ""
  );
}

function getCargo(c) {
  return (
    c["Cargo"] ||
    c["cargo"] ||
    c["Cargo/Função"] ||
    c["Função"] ||
    ""
  );
}

function getVagas(c) {
  return c["Vagas"] || c["vagas"] || "";
}

function getSalario(c) {
  return (
    c["Salário"] ||
    c["salario"] ||
    c["Remuneração"] ||
    c["remuneracao"] ||
    ""
  );
}

function getLink(c) {
  return (
    c["Link"] ||
    c["link"] ||
    c["Edital"] ||
    c["URL"] ||
    c["url"] ||
    ""
  );
}

function getConcursoId(c) {
  return `${getOrgao(c)} | ${getCargo(c)} | ${getVagas(c)}`;
}

function isConcursoTI(concurso) {
  const texto = Object.values(concurso)
    .filter((v) => typeof v === "string")
    .join(" ");
  return TI_KEYWORDS.some((re) => re.test(texto));
}

async function buscarConcursosSP() {
  const url = `${BASE_URL}/sp`;
  const { data } = await axios.get(url);
  return {
    abertos: data.concursos_abertos || [],
    previstos: data.concursos_previstos || [],
  };
}

function filtrarPorOrgao(concursos, regex) {
  return concursos.filter((c) => regex.test(getOrgao(c)));
}

function filtrarTI(concursos) {
  return concursos.filter(isConcursoTI);
}

async function upsertConcurso(concurso, { isTI, fonte }) {
  const hashId = getConcursoId(concurso);

  const existing = await dbGet(
    "SELECT id FROM concursos WHERE hash_id = ?",
    [hashId]
  );

  const orgao = getOrgao(concurso);
  const cargo = getCargo(concurso);
  const vagas = getVagas(concurso);
  const situacao =
    concurso["Situação"] || concurso["Situacao"] || concurso["status"] || "";
  const salario = getSalario(concurso);
  const link = getLink(concurso);

  if (existing) {
    await dbRun(
      `UPDATE concursos SET updated_at = datetime('now') WHERE id = ?`,
      [existing.id]
    );
    return { isNew: false };
  }

  await dbRun(
    `INSERT INTO concursos
      (hash_id, orgao, cargo, vagas, situacao, salario, link, is_ti, fonte)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      hashId,
      orgao,
      cargo,
      vagas,
      situacao,
      salario,
      link,
      isTI ? 1 : 0,
      fonte,
    ]
  );

  return { isNew: true };
}

async function syncConcursosSP() {
  const { abertos, previstos } = await buscarConcursosSP();

  const novosAb = [];
  const novosPr = [];

  for (const c of abertos) {
    const { isNew } = await upsertConcurso(c, {
      isTI: isConcursoTI(c),
      fonte: "aberto",
    });
    if (isNew) novosAb.push(c);
  }

  for (const c of previstos) {
    const { isNew } = await upsertConcurso(c, {
      isTI: isConcursoTI(c),
      fonte: "previsto",
    });
    if (isNew) novosPr.push(c);
  }

  return {
    abertos,
    previstos,
    novos_abertos: novosAb,
    novos_previstos: novosPr,
  };
}

// ROTAS


app.get("/", (req, res) => {
  res.json({ status: "ok", msg: "API de concursos ativa" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/concursos/sp", async (req, res) => {
  try {
    const data = await syncConcursosSP();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar concursos em SP" });
  }
});

app.get("/concursos/novos", async (req, res) => {
  try {
    const { novos_abertos, novos_previstos } = await syncConcursosSP();
    res.json({
      abertos: novos_abertos,
      previstos: novos_previstos,
    });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar concursos novos" });
  }
});

app.get("/concursos/policia-civil-sp", async (req, res) => {
  try {
    const { abertos } = await buscarConcursosSP();
    res.json(filtrarPorOrgao(abertos, ORGAOS.pcsp));
  } catch (err) {
    res.status(500).json({ error: "Erro PC-SP" });
  }
});

app.get("/concursos/policia-federal", async (req, res) => {
  try {
    const { abertos } = await buscarConcursosSP();
    res.json(filtrarPorOrgao(abertos, ORGAOS.pf));
  } catch (err) {
    res.status(500).json({ error: "Erro PF" });
  }
});

app.get("/concursos/abin", async (req, res) => {
  try {
    const { abertos } = await buscarConcursosSP();
    res.json(filtrarPorOrgao(abertos, ORGAOS.abin));
  } catch (err) {
    res.status(500).json({ error: "Erro ABIN" });
  }
});

app.get("/concursos/ti-sp", async (req, res) => {
  try {
    const { abertos } = await buscarConcursosSP();
    res.json(filtrarTI(abertos));
  } catch (err) {
    res.status(500).json({ error: "Erro TI" });
  }
});

// app.get("/concursos/db", async (req, res) => {
//   db.all("SELECT * FROM concursos ORDER BY id DESC", (err, rows) => {
//     if (err) return res.status(500).json({ error: "Erro ao ler banco" });
//     res.json(rows);
//   });
// });

// Start
app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
