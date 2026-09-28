# eval-harness-insurance

Harness de regressão para um agente de IA de subscrição de sinistros de seguro auto. Ele envia cada caso do Golden Dataset para a IA, valida o JSON de resposta contra um contrato estrito, aplica regras atuariais e encerra com código de saída próprio para CI/CD.

Especificação de referência: `openspec/specs/prd.md`.

## Requisitos

- Node.js 24 (ESM)
- `npm install`

## Uso

```bash
cp .env.example .env         # preencha AI_MODEL e a chave do provedor
npm run eval                 # executa o harness (lê .env se existir)
DATASET_PATH=test/fixtures/valid.csv MAX_CASES=5 npm run eval   # execução curta
```

Código de saída: `0` quando a acurácia é maior ou igual a `ACCURACY_THRESHOLD` e ao menos um caso foi avaliado. `1` em qualquer outro caso, incluindo configuração inválida, CSV inexistente ou coluna obrigatória ausente. Linhas inválidas do CSV aparecem no relatório, mas não alteram o código de saída.

## Dataset

`data/AutoInsuranceClaims2024.csv`: 9134 clientes, 34 colunas, UTF-8, finais de linha CRLF, datas em `M/D/YYYY` ou `M/D/YY` (ano com 2 dígitos → 20YY). As colunas `* Index` e `Response` são ignoradas.

O dataset **não tem rótulo de fraude**. O gabarito é derivado de forma determinística e nunca é enviado à IA:

- **Alto risco:** `Number of Open Complaints ≥ HIGH_RISK_MIN_COMPLAINTS` **ou** `Total Claim Amount / Monthly Premium Auto > HIGH_RISK_CLAIM_PREMIUM_RATIO`. Com os valores padrão, isso marca 730 casos (≈ 8%).
- **Severidade real:** `round(min(claim, SEVERITY_CAP) / SEVERITY_CAP × 100)`.

O harness mede a aderência da IA a essa política de risco, não a detecção de fraude real.

## Regras avaliadas

| Motivo | Quando falha |
|---|---|
| `CRITICAL_FALSE_NEGATIVE` | caso de alto risco com `claimStatus = APPROVED` |
| `SCORE_DEVIATION` | `abs(fraudRiskScore − severidade real) > SCORE_TOLERANCE` |
| `CONTRACT_VIOLATION` | resposta que não é JSON, fora do schema ou recusada pelo modelo |
| `RUNTIME_ERROR` | timeout, erro de rede ou erro do provedor |

Contrato de resposta: `{"claimStatus": "APPROVED" | "DENIED" | "MANUAL_REVIEW", "fraudRiskScore": <inteiro 0-100>}`. Campos extras são ignorados. O prompt de sistema é versionado em `src/core/evaluation/infrastructure/prompts/underwriting.v1.md`.

## Configuração

| Variável | Padrão | Descrição |
|---|---|---|
| `DATASET_PATH` | `data/AutoInsuranceClaims2024.csv` | CSV do Golden Dataset |
| `AI_PROVIDER` | `anthropic` | `anthropic` ou `openai` |
| `AI_MODEL` | obrigatório | modelo do provedor |
| `ANTHROPIC_API_KEY` | obrigatória se `AI_PROVIDER=anthropic` | chave da Anthropic |
| `OPENAI_API_KEY` | obrigatória se `AI_PROVIDER=openai` | chave da OpenAI |
| `SEVERITY_CAP` | `2000` | teto da severidade real |
| `HIGH_RISK_MIN_COMPLAINTS` | `3` | reclamações abertas que tornam o caso de alto risco |
| `HIGH_RISK_CLAIM_PREMIUM_RATIO` | `10` | razão sinistro/prêmio mensal acima da qual o caso é de alto risco |
| `SCORE_TOLERANCE` | `15` | desvio máximo aceito entre score e severidade |
| `ACCURACY_THRESHOLD` | `1.0` | acurácia mínima para sair com código 0 |
| `MAX_CASES` | sem limite | avalia só os N primeiros casos válidos |
| `CONCURRENCY` | `1` | chamadas simultâneas à IA |
| `AI_TIMEOUT_MS` | `30000` | timeout por chamada |
| `AI_TEMPERATURE` | não enviada | enviada só se definida (os modelos Claude atuais recusam o parâmetro) |

## Desenvolvimento

```bash
npm test            # Vitest, sem rede
npm run test:cov    # cobertura (exige ≥ 90% em src/core/**/domain)
npm run typecheck   # tsc --noEmit
```

Arquitetura DDD com dois contextos: `dataset`, que carrega o CSV e contém a ACL, e `evaluation`, que contém as regras, os ports e os adapters de IA. `evaluation/domain` não importa `dataset`. A tradução entre os dois acontece só em `evaluation/infrastructure/dataset-case-source.ts`. Só `src/interface/runner.ts` acessa `process`.
# eval-harness-insurance
