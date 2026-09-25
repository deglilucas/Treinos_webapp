# Treinos

PWA pessoal de treino de academia. HTML/CSS/JS puro (ES modules, sem build),
dados 100% locais em IndexedDB, funciona offline e roda no GitHub Pages.

## Rodando local

Qualquer servidor estático serve (service worker exige `http://localhost` ou HTTPS):

```sh
npx http-server -c-1 .
```

## Publicando no GitHub Pages

O workflow `.github/workflows/pages.yml` publica a cada push na `main`
(Settings → Pages → Source: *GitHub Actions*). Todos os caminhos são relativos,
então funciona em `usuario.github.io/Treinos_webapp/`.

No deploy, o `VERSAO` do `sw.js` vira o hash do commit, então o cache offline
se renova sozinho. Arquivo novo do app precisa entrar em `APP_SHELL`. O app
mostra "Nova versão disponível" quando o service worker novo assume.

## Estrutura

```
index.html            shell do app (tabbar + área das telas)
manifest.json         instalação como app
sw.js                 cache offline: app shell, fontes e GIFs
sw-treino.js          notificação do treino com botões (importado pelo sw.js)
css/tokens.css        cores, fontes, raios, espaçamentos
css/app.css           componentes e telas
icons/                ícones do app (svg + png)
js/app.js             boot: abre banco, seed, rotas, service worker
js/router.js          rotas por hash (#/inicio, #/treinar/...)
js/db/schema.js       esquema e migrações do IndexedDB
js/db/db.js           helpers de transação
js/db/biblioteca.js   biblioteca de exercícios (~225, pt-BR, com apelidos)
js/db/seed.js         grava a biblioteca e os treinos A/B/C iniciais
js/db/repo.js         consultas e ciclo de vida da sessão
js/lib/timer.js       timers por timestamp
js/lib/datas.js       datas locais em 'YYYY-MM-DD' e rótulos pt-BR
js/lib/midia.js       GIFs do ExerciseDB com fallback
js/ui/                ícones SVG e utilidades de DOM
js/screens/           uma tela por arquivo
```

## Modelo de dados

| store | campos | índices |
|---|---|---|
| `exercicios` | id, nome, apelidos[], grupo_muscular, equipamento, tipo_registro (`peso_reps`\|`tempo`), ativo, duracao_alvo?, personalizado?, nome_en?, gif_url? | grupo_muscular, equipamento |
| `treinos` | id, nome, sigla, ordem | ordem |
| `treino_exercicios` | id, treino_id, exercicio_id, ordem, series, descanso_padrao, duracao_alvo? | treino_id, exercicio_id |
| `sessoes` | id, treino_id, data, hora_inicio, hora_fim, status (`em_andamento`\|`concluida`), pausado_em, tempo_pausado_ms, descanso_inicio, descanso_duracao_ms | data, status, treino_id |
| `series_registradas` | id, sessao_id, exercicio_id, numero_serie, peso, reps, duracao, registrada_em | sessao_id, exercicio_id |
| `medidas_corporais` | id, data, peso_corporal, medidas{} | data |
| `config` | chave, valor | — |

`data` é sempre a data local `YYYY-MM-DD`; horários são epoch em ms.

## Timers

Nenhum timer conta tempo. A sessão guarda `hora_inicio`, `pausado_em`,
`tempo_pausado_ms` e `descanso_inicio`; o valor exibido é sempre calculado a
partir de `Date.now()`. O `setInterval` só redesenha a tela, e ela também é
redesenhada ao voltar do segundo plano (`visibilitychange`/`pageshow`). Como
tudo fica no IndexedDB, o cronômetro sobrevive até ao app ser fechado.

Nenhuma fase termina sozinha. Série de tempo e descanso contam o tempo que
passou e apitam quando cruzam o alvo, que é só referência. Toda série
terminada abre um descanso, inclusive entre exercícios; só a última do treino
não abre, e o app pergunta se quer concluir. O descanso vai até o toque em
"Iniciar série" (ou até registrar a próxima) e a duração real fica em
`descanso_seg` da série que o abriu.

## Notificação do treino

Ativada em Ajustes (ou no convite do primeiro treino). Com um treino rodando e
o app em segundo plano, o service worker (`sw-treino.js`) mostra a fase atual
com um botão: no descanso, **Iniciar série**; numa série, **Concluir série**
(registra com o que está digitado na tela, ou com a sugestão). Ele lê e grava
direto no IndexedDB, seguindo as mesmas regras da tela, e avisa o app para
redesenhar quando você volta. O bipe do alvo vem pela notificação, com
vibração, enquanto o navegador deixa o SW acordado (uns 5 minutos). Feito
para Android/Chrome; no iPhone a notificação não tem botões.

## GIFs dos exercícios

Cada exercício da biblioteca tem um termo em inglês (`nome_en`) usado na busca
da API aberta do ExerciseDB (`js/lib/midia.js`). A URL encontrada é salva no
banco e a imagem é guardada pelo service worker no cache `treinos-midia`. Sem
cache e sem internet aparece o ícone com o nome do exercício.

Ícone de engrenagem baseado no [Lucide](https://lucide.dev) (ISC).
