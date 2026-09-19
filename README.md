# API CEP

API REST para consulta de endereços a partir de um CEP.

A solução combina **Round Robin, fallback, Circuit Breaker e timeout** para evitar que uma falha isolada de um serviço externo interrompa necessariamente a API.

O `CepService` coordena o fluxo, o `RoundRobinService` distribui as consultas, cada provider possui seu próprio Circuit Breaker e o `HttpService` centraliza a comunicação HTTP e os timeouts.

Com isso, quando um provider falha ou fica temporariamente indisponível, a aplicação pode utilizar outro provider. Caso nenhum consiga atender à consulta, a API retorna `503 Service Unavailable` de forma controlada.

---

A API disponibiliza o endpoint:

```http
GET /cep/{cep}
```

As consultas são realizadas utilizando dois provedores:

* ViaCEP
* BrasilAPI

Ambos seguem o mesmo contrato e têm suas respostas mapeadas para o modelo `CepAddress`, mantendo as particularidades de cada API isoladas em seus respectivos providers.

---

## Tecnologias utilizadas

* **Node.js**
* **TypeScript**
* **NestJS**
* **Jest**
* **Fetch API**
* **ES Modules**

A aplicação utiliza a injeção de dependências do NestJS e separa responsabilidades entre controllers, services, providers, infraestrutura e modelos.

---

## Arquitetura

```text
src/
├── config/
│   └── app.config.ts
├── controllers/
│   └── cep.controller.ts
├── infra/
│   ├── circuit-breaker/
│   │   ├── circuit-breaker.ts
│   │   ├── circuit-breaker.service.ts
│   │   └── circuit-breaker.spec.ts
│   └── http/
│       ├── http.service.ts
│       └── http.service.spec.ts
├── models/
│   └── cep-address.model.ts
├── pipes/
│   └── cep-validation.pipe.ts
├── providers/
│   ├── base/
│   │   ├── cep.provider.ts
│   │   └── cep.provider.config.ts
│   ├── brasilapi.provider.ts
│   └── viacep.provider.ts
└── services/
    ├── cep/
    │   └── cep.service.ts
    └── round-robin/
        └── round-robin.service.ts
```

### Principais responsabilidades

* **CepController:** recebe a requisição e encaminha o CEP para o serviço.
* **CepValidationPipe:** valida e padroniza o CEP.
* **CepService:** coordena providers, Round Robin, Circuit Breaker e fallback.
* **Providers:** encapsulam as particularidades de cada API externa e mapeiam suas respostas para `CepAddress`.
* **HttpService:** centraliza as requisições HTTP, timeouts internos e tratamento de respostas.
* **RoundRobinService:** controla a ordem dos providers.
* **CircuitBreakerService:** mantém um Circuit Breaker independente para cada provider.

---

## Fluxo de uma consulta

```text
Cliente
   │
   ▼
CepController
   │
   ▼
Validação do CEP
   │
   ▼
CepService
   │
   ▼
Round Robin
   │
   ▼
Circuit Breaker
   │
   ├── OPEN ──► provider ignorado
   │
   └── permitido
          │
          ▼
      Provider
          │
          ▼
      HttpService
          │
          ▼
      API externa
```

Se um provider falhar, o `CepService` tenta o próximo provider disponível.

---

## Validação do CEP

São aceitos os formatos:

```text
80020000
80020-000
```

O hífen é removido antes da consulta aos providers.

Um CEP inválido resulta em:

```http
400 Bad Request
```

---

## Round Robin

Os providers são selecionados de forma circular.

Com dois providers:

```text
ViaCEP → BrasilAPI → ViaCEP → BrasilAPI → ...
```

Com três:

```text
A → B → C → A → B → C → ...
```

O mecanismo utiliza apenas o índice atual e o tamanho da lista, permitindo adicionar novos providers sem alterar a lógica do `CepService`.

---

## Fallback

O Round Robin define o provider inicial. Caso a consulta falhe, o `CepService` tenta o próximo provider disponível.

```text
ViaCEP
   │
   X falhou
   │
   ▼
BrasilAPI
   │
   ✓ sucesso
```

Providers com Circuit Breaker aberto são ignorados e não recebem novas requisições até que o tempo
pré definido no timeout do Circuit Breaker tenha sido excedido.

---

## CepService

O `CepService` coordena todo o fluxo de consulta.

Antes de iniciar as tentativas, verifica se existe pelo menos um provider cujo Circuit Breaker permita uma execução.

Para cada provider:

1. Seleciona o próximo provider pelo Round Robin.
2. Obtém seu Circuit Breaker.
3. Verifica se a execução é permitida.
4. Executa a consulta.
5. Em caso de sucesso, retorna o endereço.
6. Em caso de falha, registra o erro e tenta o próximo provider.

O número máximo de tentativas de provedores corresponde à quantidade de providers configurados.

---

## Circuit Breaker

Cada provider possui seu próprio Circuit Breaker, com três estados:

```text
CLOSED
OPEN
HALF_OPEN
```

### CLOSED

Estado normal. As requisições são permitidas e as falhas consecutivas são contabilizadas.

Após **5 falhas consecutivas**, o circuito passa para `OPEN`.

### OPEN

Novas requisições para o provider são bloqueadas.

O tempo de espera é de:

```text
120000 ms = 2 minutos
```
(Esse valor é parametrizado e pode ser alterado se for necessário.)

Durante esse período, o `CepService` ignora o provider e tenta outro disponível.

### HALF_OPEN

Após os 120000 ms, o circuito passa para HALF_OPEN e permite uma única requisição de recuperação.

Se a requisição funcionar:

```text
HALF_OPEN → CLOSED
```

O contador de falhas é resetado.

Se falhar:

```text
HALF_OPEN → OPEN
```

O período de espera é iniciado novamente.

Enquanto a requisição de recuperação estiver em andamento, novas tentativas são bloqueadas.

---

## Timeout

O `HttpService` possui um timeout padrão de:

```text
10000 ms = 10 segundos
```

Esse valor é centralizado na configuração da aplicação e pode ser alterado.

Um provider também pode definir um timeout específico se necessário.

Por exemplo, a BrasilAPI utiliza atualmente, para fins de demonstração:

```text
2000 ms = 2 segundos
```

Nesse caso:

```ts
httpService.get(url, 2000);
```

O timeout específico substitui o padrão apenas naquela requisição.

### Implementação

O `HttpService` utiliza `AbortController` para cancelar requisições que ultrapassarem o tempo configurado.

Quando o timeout ocorre, um erro específico é gerado:

```text
HTTP request timed out after 2000ms.
```

Erros que não foram causados pelo timeout são propagados normalmente.

---

## Tratamento de respostas HTTP

O `HttpService` verifica se a resposta HTTP foi bem-sucedida.

Respostas como:

```text
HTTP 404: Not Found
HTTP 500: Internal Server Error
```

são transformadas em erros e retornam ao fluxo do provider.

O `CepService` considera a tentativa como uma falha e executa o fallback quando houver outro provider disponível.

---

## Falha e indisponibilidade dos providers

### Um provider falha

O erro é registrado, o Circuit Breaker contabiliza a falha e o próximo provider disponível é utilizado.

```text
ViaCEP → falha → BrasilAPI → sucesso
```

No caso de 5 falhas consecutivas, o Circuit Breaker é aberto e o provedor fica bloqueado por um tempo.

### Um provider está indisponível

Se o Circuit Breaker estiver `OPEN`, nenhuma requisição é enviada para ele. O provider é ignorado e outro disponível é utilizado.

### Todos estão indisponíveis

Se todos os Circuit Breakers estiverem impedindo novas execuções, o `CepService` não realiza chamadas externas e retorna:

```http
503 Service Unavailable
```

```text
No providers are currently available.
```

### Todos estão disponíveis, mas falham

Os providers são tentados conforme o fluxo de fallback. Se todos falharem:

```http
503 Service Unavailable
```

```text
Unable to retrieve address with available providers.
```

---

## Logs

A aplicação utiliza o `Logger` do NestJS para registrar os principais eventos do fluxo.

São registrados eventos como:

```text
Trying provider ViaCEP for CEP 80020000.
Provider ViaCEP successfully returned the CEP 80020000.
Provider ViaCEP failed for CEP 80020000: Provider error.
Falling back to the next provider.
Skipping provider ViaCEP because its circuit is OPEN.
All providers failed for CEP 80020000.
No providers available for CEP 80020000.
```

O Circuit Breaker também registra suas transições:

```text
Circuit Breaker Opened after 5 consecutive failures.
Circuit Breaker transitioned from OPEN to HALF_OPEN.
Circuit Breaker Reopened after HALF_OPEN attempt failed.
Circuit Breaker transitioned from HALF_OPEN to CLOSED.
```

---

## Tratamento de erros

| Situação                       |                      HTTP |
| ------------------------------ | ------------------------: |
| CEP inválido                   |         `400 Bad Request` |
| Nenhum provider disponível     | `503 Service Unavailable` |
| Todos os providers falharam    | `503 Service Unavailable` |
| Consulta realizada com sucesso |                  `200 OK` |

Erros dos providers são tratados internamente, registrados nos logs e utilizados para acionar o fallback e o Circuit Breaker.

Quando um provider retorna um erro HTTP, o **status HTTP e a mensagem retornada pelo provider são registrados nos logs** para fins de diagnóstico e observabilidade.

Exemplo:

```text
Provider ViaCEP failed for CEP 80020000: HTTP 500: Internal Server Error
```

Essas informações **não são retornadas diretamente ao cliente**. Quando possível, o fluxo de fallback continua com outro provider disponível.

Quando nenhum provider consegue atender à consulta, a API retorna `503 Service Unavailable` sem expor detalhes internos dos serviços externos.

Quando todos os providers falham, a mensagem retornada ao cliente é:

```text
Unable to retrieve address with available providers.
```

Quando todos os providers estão indisponíveis devido ao Circuit Breaker, a mensagem retornada ao cliente é:

```text
No providers are currently available.
```

---

## Testes

A aplicação utiliza **Jest** para validar os principais comportamentos:

* Round Robin e ciclo de providers;
* fallback;
* sucesso e falha dos providers;
* Circuit Breaker por provider;
* abertura após cinco falhas;
* recuperação em `HALF_OPEN`;
* bloqueio de requisições concorrentes;
* timeout padrão e específico;
* tratamento de respostas HTTP;
* comportamento quando nenhum provider está disponível;
* providers com Circuit Breaker `OPEN` não recebem requisições;
* logs principais.

---