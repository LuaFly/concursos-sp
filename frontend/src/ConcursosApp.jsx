import { useEffect, useState } from "react";
import "./concursos.css";

const API_BASE_URL = "http://localhost:3000";

const MENU_ITEMS = [
  {
    id: "pcsp",
    label: "Polícia Civil SP",
    endpoint: "/concursos/policia-civil-sp",
    description: "Concursos abertos da Polícia Civil do Estado de São Paulo.",
  },
  {
    id: "pf",
    label: "Polícia Federal (SP)",
    endpoint: "/concursos/policia-federal",
    description: "Concursos da Polícia Federal com foco em SP (quando houver).",
  },
  {
    id: "abin",
    label: "ABIN (SP)",
    endpoint: "/concursos/abin",
    description: "Concursos da ABIN com vagas previstas ou lotação em SP.",
  },
  {
    id: "ti",
    label: "Vagas TI / Forense",
    endpoint: "/concursos/ti-sp",
    description:
      "Concursos em SP com vagas de TI, forense digital, programador, analista de T.I, etc.",
  },
  {
    id: "sp",
    label: "Todos em SP",
    endpoint: "/concursos/sp",
    description: "Lista geral de concursos em SP (abertos e previstos).",
  },
  {
    id: "novos",
    label: "Novos",
    endpoint: "/concursos/novos",
    description:
      "Concursos que apareceram pela primeira vez em relação ao banco de dados.",
  },
];

export default function ConcursosApp() {
  const [activeMenu, setActiveMenu] = useState("pcsp");
  const [concursos, setConcursos] = useState([]);
  const [tipoLista, setTipoLista] = useState("abertos");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const menuAtual = MENU_ITEMS.find((m) => m.id === activeMenu);

  useEffect(() => {
    if (!menuAtual) return;

    async function fetchConcursos() {
      setLoading(true);
      setError("");
      setConcursos([]);

      try {
        const res = await fetch(API_BASE_URL + menuAtual.endpoint);
        if (!res.ok) {
          throw new Error("Erro ao buscar dados da API");
        }

        const data = await res.json();

        if (menuAtual.id === "sp" || menuAtual.id === "novos") {
          const lista =
            tipoLista === "abertos" ? data.abertos || [] : data.previstos || [];
          setConcursos(lista);
        } else {
          setConcursos(Array.isArray(data) ? data : []);
        }

      } catch (err) {
        console.error(err);
        setError(err.message || "Erro inesperado ao buscar concursos");
      } finally {
        setLoading(false);
      }
    }

    fetchConcursos();
  }, [menuAtual, tipoLista]);

  return (
    <div className="concursos-layout">
      {/* MENU LATERAL */}
      <aside className="concursos-sidebar">
        <h1 className="concursos-title">Concursos SP</h1>
        

        <nav className="concursos-menu">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              className={
                "concursos-menu-item" +
                (item.id === activeMenu ? " concursos-menu-item--active" : "")
              }
              onClick={() => setActiveMenu(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {(menuAtual?.id === "sp" || menuAtual?.id === "novos") && (
          <div className="concursos-toggle-container">
            <span className="concursos-toggle-label">Mostrar:</span>
            <div className="concursos-toggle-buttons">
              <button
                className={
                  "concursos-toggle-btn" +
                  (tipoLista === "abertos"
                    ? " concursos-toggle-btn--active"
                    : "")
                }
                onClick={() => setTipoLista("abertos")}
              >
                Concursos abertos
              </button>
              <button
                className={
                  "concursos-toggle-btn" +
                  (tipoLista === "previstos"
                    ? " concursos-toggle-btn--active"
                    : "")
                }
                onClick={() => setTipoLista("previstos")}
              >
                Concursos previstos
              </button>
            </div>
          </div>
        )}
      </aside>

      <main className="concursos-main">
        <header className="concursos-header">
          <h2 className="concursos-header-title">{menuAtual?.label}</h2>
          <p className="concursos-header-desc">{menuAtual?.description}</p>
        </header>

        {loading && (
          <div className="concursos-status">
            <span className="concursos-loader" />
            <span>Carregando concursos...</span>
          </div>
        )}

        {error && !loading && (
          <div className="concursos-status concursos-status--error">
            {error}
          </div>
        )}

        {!loading && !error && concursos.length === 0 && (
          <div className="concursos-status">
            Nenhum concurso encontrado para esse filtro agora.
            <br />
            (Pode ser que não haja edital aberto ou previsto no momento.)
          </div>
        )}

        {!loading && !error && concursos.length > 0 && (
          <section className="concursos-grid">
            {concursos.map((concurso, idx) => (
              <ConcursoCard key={idx} concurso={concurso} />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

function ConcursoCard({ concurso }) {
  const orgao =
    concurso["Órgão"] ||
    concurso["Orgao"] ||
    concurso["orgão"] ||
    concurso["orgao"] ||
    "Órgão não informado";

  const cargo =
    concurso["Cargo"] ||
    concurso["cargo"] ||
    concurso["Cargo/Função"] ||
    concurso["Função"] ||
    "Cargo não informado";

  const vagas = concurso["Vagas"] || concurso["vagas"] || "—";
  const situacao =
    concurso["Situação"] || concurso["Situacao"] || concurso["status"] || "";

  const link =
    concurso["Link"] ||
    concurso["link"] ||
    concurso["Edital"] ||
    concurso["URL"] ||
    concurso["url"];

  const salario =
    concurso["Salário"] ||
    concurso["salario"] ||
    concurso["Remuneração"] ||
    concurso["remuneracao"];

  return (
    <article className="concursos-card">
      <header className="concursos-card-header">
        <h3 className="concursos-card-orgao">{orgao}</h3>
        {situacao && (
          <span className="concursos-card-badge">{situacao}</span>
        )}
      </header>

      <div className="concursos-card-body">
        <p className="concursos-card-cargo">{cargo}</p>

        <div className="concursos-card-info-row">
          <span className="concursos-card-label">Vagas:</span>
          <span>{vagas}</span>
        </div>

        {salario && (
          <div className="concursos-card-info-row">
            <span className="concursos-card-label">Remuneração:</span>
            <span>{salario}</span>
          </div>
        )}
      </div>

      <footer className="concursos-card-footer">
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="concursos-card-link"
          >
            Ver edital / mais detalhes
          </a>
        ) : (
          <span className="concursos-card-link concursos-card-link--disabled">
            Sem link de edital disponível
          </span>
        )}
      </footer>
    </article>
  );
}
