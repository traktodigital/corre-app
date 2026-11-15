# ADR-0007 — Minha Moto (oficina de IA)

| | |
|---|---|
| **Status** | Proposto. Construção começa agora (decisão do Léo) |
| **Data** | 2026-11-15 |
| **Fonte** | `CORRE_Rota_Copiloto_Ligeirin_DiogoDev` §5.2 |

## 1. Contexto

O módulo traz:
- ficha da moto;
- manutenção prevista **pelo km real** (não pelo calendário);
- documentos com alerta de vencimento;
- multas;
- desgaste de pneu por foto;
- alerta de consumo anômalo cruzado com os abastecimentos da jornada.

## 2. Decisões

| # | Decisão | Por quê |
|---|---|---|
| D1 | Tabela **`motos`** (dono, modelo, ano, placa, combustível). O **km atual** não é digitado: é o maior odômetro confirmado (abastecimentos + painel da jornada) | Uma fonte só de km, a mesma da ADR-0002 |
| D2 | **Manutenção por km** com uma tabela de intervalos por **modelo** (`manutencao_intervalos`: item, a cada X km). Começa com valores genéricos **validados por um mecânico parceiro** e pode ser ajustada por modelo | Não inventar intervalo de fábrica. Depois, a tabela pode vir do manual de cada modelo |
| D3 | **Documentos** (CRLV, seguro, licenciamento, IPVA): foto em bucket próprio `moto-docs` (RLS do dono) + data de vencimento confirmada pelo entregador. Licenciamento e IPVA podem ser **sugeridos pelo final da placa** (calendário do DETRAN-GO e da SEFAZ-GO), sem API | Alerta útil sem integração frágil |
| D4 | **Multas: cadastro manual** na v1 | Não há API pública aberta. Raspar portal do DETRAN é frágil e arriscado. Serviço pago de consulta veicular é uma opção futura, com custo por consulta |
| D5 | **Pneu por foto: só indicativo.** A resposta é sempre "parece gasto, confira com o mecânico", **nunca** "pode rodar" | É segurança. Um falso "está bom" é um risco que o produto não pode assumir |
| D6 | **Consumo anômalo**: km/l entre dois abastecimentos **com cupom e odômetro**. Alerta quando cai mais de X% abaixo da mediana dos últimos N abastecimentos daquela moto | Cálculo determinístico (como na ADR-0005 D5). O Ligeirin só avisa, em modo sério |
| D7 | **Oficinas parceiras** indicadas pela mesma regra dos 10% + desempate por nível (ADR-0005 §6.4) | A mesma regra de confiança vale para tudo |

## 3. Pontos limitantes

- **L1:** a manutenção só fica boa se houver odômetro frequente. Sem fotos, a previsão perde
  precisão. Mostrar "último km confirmado em DD/MM".
- **L2:** a leitura de pneu por foto varia com a luz, o ângulo e a sujeira. Precisa de um
  conjunto de avaliação antes de ligar.
- **L3:** sem fonte oficial de multas, a lista depende do entregador cadastrar.
- **L4:** documentos (CRLV) são dado pessoal sensível. Ficam fora do escopo do Ligeirin,
  que só recebe "vence em N dias".

## 4. Pendências

| Pendência | Quem |
|---|---|
| Mecânico parceiro para validar os intervalos genéricos | Léo |
| Limiar do consumo anômalo (X%, N abastecimentos) | Léo + mecânico |
| Consulta de multas paga: vale o custo? | Léo |
