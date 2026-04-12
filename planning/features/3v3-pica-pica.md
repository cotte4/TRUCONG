# 3v3 + PICA PICA Feature

**Status:** 🟡 In Progress  
**Created:** 2026-04-11  
**Priority:** High  
**Project:** TRUCONG / DIMADONG

---

## Problem Statement

El juego actualmente soporta 1v1 y 2v2. Se quiere agregar el modo **3v3** (6 jugadores, 3 por equipo) con una mecánica nueva: **PICA PICA**, un mini-juego que se juega **una ronda de por medio** dentro de la misma partida (alternando con las manos de Truco normales).

---

## Current State

### Lo que existe hoy

| Componente | Estado |
|---|---|
| `allow3v3` flag en `RoomSnapshot` y `MutableRoom` | ✅ Existe, siempre `false` |
| `maxPlayers` acepta `2` o `4` | Necesita agregar `6` |
| Team assignment `seatIndex % 2` | Funciona para N jugadores (generalizable) |
| `hasValidTeams` solo valida para `maxPlayers === 4` | Necesita caso `6` |
| Seat positioning (UI) | Solo maneja 2 y 4 posiciones |
| `CreateRoomRequest` acepta `maxPlayers?: 2 | 4` | Necesita `6` |
| PICA PICA | ❌ No existe en ningún lado |
| Lógica de alternancia de modos por ronda | ❌ No existe |

### Arquitectura base (fuerte)

- Game engine puro y determinístico en `packages/game-engine`
- Estado manejado por servidor con eventos bien definidos
- Contratos tipados en `packages/contracts`
- Seat-based identity — escala a N jugadores naturalmente
- El flujo de fases (lobby → dealing → action_turn → trick_resolution → hand_scoring) es reutilizable

---

## Proposed Solution

### Fase A — 3v3 Truco (habilitar el feature flag)

Extender el juego existente para soportar 6 jugadores en el mismo flujo de Truco.  
La lógica de equipos (A/B por índice par/impar) ya escala. El cambio es principalmente en validación, UI, y configuración de sala.

### Fase B — PICA PICA (mini-juego nuevo)

> ⚠️ **Acción requerida antes de implementar:** Confirmar las reglas exactas de PICA PICA con el equipo de producto.  
> El diseño técnico propuesto abajo asume una mecánica de "carta más alta gana" (ver sección de diseño). Ajustar según definición final.

PICA PICA es un mini-juego que se juega en las rondas pares de la partida 3v3 (ronda 2, 4, 6...). Usa el mismo mazo pero reglas simplificadas. Su resultado suma puntos al marcador de la partida principal.

### Fase C — Alternancia de modos por ronda

El sistema de `handNumber` ya existe. Se agrega un selector de modo: `handNumber % 2 === 0` → PICA PICA, `handNumber % 2 !== 0` → Truco normal.

---

## Diseño de PICA PICA (propuesto — confirmar reglas)

> Si las reglas reales son distintas, este diseño sirve como template arquitectónico.

### Concepto propuesto

PICA PICA es una ronda rápida de **"carta más alta gana"** por equipo:

1. Se reparten **1 carta** a cada jugador (en lugar de 3).
2. Todos juegan su carta **sin opción de canto** (no hay Truco ni Envido en PICA PICA).
3. La carta más alta de cada equipo se compara entre sí.
4. El equipo con la carta más alta **gana 1 punto** para el marcador de la partida.
5. En empate: nadie suma punto (o se puede definir regla especial).
6. Duración estimada: ~30 segundos por ronda PICA PICA.

### Variante temática (Area 51)

Dado el tema alien, PICA PICA podría tener un twist visual:  
- Las cartas se revelan simultáneamente (no por turno).
- Animación de "intercepción alienígena" al comparar.

---

## Implementation Plan

### Fase A — 3v3 Truco

#### A1. Contratos (`packages/contracts/src/index.ts`)
- [ ] Ampliar `CreateRoomRequest.maxPlayers` a `2 | 4 | 6`
- [ ] Asegurar que `RoomSnapshot.maxPlayers` soporte `6` (ya es `number`, ok)
- [ ] Agregar `gameMode: 'truco' | 'pica_pica'` a `MatchProgressState` (para Fase B)
- [ ] Agregar evento `pica_pica:started` y `pica_pica:resolved` (para Fase B)

#### A2. Backend — Room Store (`apps/realtime/src/rooms/room-store.service.ts`)
- [ ] `createRoom()`: Activar `allow3v3: true` cuando `maxPlayers === 6`
- [ ] `hasValidTeams()`: Agregar caso `maxPlayers === 6` → `countA === 3 && countB === 3`
- [ ] `parseCreateRoomRequest()`: Aceptar `maxPlayers: 6`
- [ ] Validar que el deck de 40 cartas alcanza para 6 jugadores × 3 cartas = 18 cartas (sí alcanza)
- [ ] Verificar `createInitialMatch()`: El deal loop ya itera `occupiedSeats`, funciona para 6

#### A3. Backend — Room Controller (`apps/realtime/src/rooms/rooms.controller.ts`)
- [ ] Actualizar validación de `maxPlayers` para aceptar `6`

#### A4. Frontend — Home (`apps/web/components/home-client.tsx`)
- [ ] Agregar opción `6` en el selector de `maxPlayers`
- [ ] UI para mostrar la opción "3v3" con indicación de PICA PICA

#### A5. Frontend — Lobby (`apps/web/components/lobby-client.tsx`)
- [ ] Agregar 6 posiciones de asientos en `getSeatPosition()`:
  ```
       Seat 2 (A)    Seat 4 (B)
      /                        \
  Seat 0 (A)              Seat 1 (B)
      \                        /
       Seat 3 (B)    Seat 5 (A)  <-- hexágono
  ```
  Layout sugerido para mobile (columna vertical con 3 filas):
  - Top: Seat 4, Seat 5
  - Middle: Seat 2, Seat 3
  - Bottom: Seat 0 (yo), Seat 1
- [ ] Actualizar lógica de `relativeOffset` para 6 asientos
- [ ] Score panel: sin cambios (ya muestra A vs B)

#### A6. Activar feature flag
- [ ] Cambiar default de `allow3v3` en `createRoom()` cuando `maxPlayers === 6`

---

### Fase B — PICA PICA (mini-juego)

> Requiere confirmación de reglas antes de implementar.

#### B1. Game Engine (`packages/game-engine/`)
- [ ] Crear `packages/game-engine/src/pica-pica.ts`:
  - `dealPicaPica(deck, seats)` → 1 carta por jugador
  - `resolvePicaPica(playedCards)` → retorna `winnerTeamSide | 'tie'`
  - `scorePicaPica(result)` → retorna `{ A: number, B: number }` (1 punto al ganador)
- [ ] Agregar `PicaPicaResult` type al engine

#### B2. Contratos (`packages/contracts/src/index.ts`)
- [ ] `PicaPicaStartedEvent`: incluye cartas de cada seat (solo la propia al cliente)
- [ ] `PicaPicaCardPlayedEvent`: seat + carta jugada
- [ ] `PicaPicaResolvedEvent`: cartas reveladas de todos + equipo ganador + puntos

#### B3. Estado de sesión de PICA PICA
- [ ] Agregar a `MutableMatchState`:
  ```typescript
  picaPicaCards: Record<string, Card | null>; // seatId → carta jugada
  ```
- [ ] Agregar a `MatchProgressState` (contratos):
  ```typescript
  gameMode: 'truco' | 'pica_pica';
  picaPicaPhase?: 'dealing' | 'playing' | 'revealing';
  ```

#### B4. Backend — Room Store (fases PICA PICA)
- [ ] Detectar inicio de PICA PICA: `if (room.match.handNumber % 2 === 0 && room.maxPlayers === 6)`
- [ ] Handler `startPicaPicaRound()`:
  - Repartir 1 carta a cada jugador
  - Emitir `pica_pica:started`
  - Cambiar phase a `pica_pica_playing`
- [ ] Handler `playPicaPicaCard(seatId, card)`:
  - Validar turno (en PICA PICA todos juegan simultáneamente → aceptar de cualquier jugador)
  - Guardar carta en `picaPicaCards[seatId]`
  - Cuando todos jugaron → resolver y emitir `pica_pica:resolved`
- [ ] Handler `resolvePicaPicaRound()`:
  - Revelar todas las cartas
  - Calcular ganador
  - Sumar punto al marcador
  - Verificar si la partida terminó
  - Si no → iniciar nueva mano (Truco, handNumber impar siguiente)

#### B5. Nuevas fases en el state machine
- [ ] Agregar `pica_pica_dealing` y `pica_pica_playing` a `MatchPhase` (contratos)
- [ ] Manejar estas fases en el frontend

#### B6. Frontend — Tabla de juego para PICA PICA
- [ ] Detectar `gameMode === 'pica_pica'` en la UI
- [ ] Mostrar banner "PICA PICA" con animación temática
- [ ] Simplificar UI: solo mostrar 1 carta en mano, sin botones de canto
- [ ] Revelar cartas simultáneamente con animación de "flip"
- [ ] Mostrar ganador con animación

---

### Fase C — Alternancia de modos

- [ ] Lógica en `prepareNextHand()`: si `maxPlayers === 6 && handNumber % 2 === 0` → llamar `startPicaPicaRound()`
- [ ] Indicador visual en el scoreboard: mostrar "próxima ronda: PICA PICA" o "próxima ronda: TRUCO"
- [ ] El `handNumber` ya se incrementa en `prepareNextHand()` — no hay cambios en esa lógica

---

## Technical Details

### Seat Layout para 3v3 (6 jugadores)

```
Layout hexagonal (desktop):

         [Seat 4 - B]    [Seat 2 - A]
        /                              \
[Seat 0 - A]                    [Seat 5 - B]
        \                              /
         [Seat 1 - B]    [Seat 3 - A]

Yo (Seat 0) siempre abajo-izquierda.
```

```
Layout móvil (vertical):

   [Seat 5 - B] [Seat 4 - A]   ← top row
   [Seat 3 - B] [Seat 2 - A]   ← middle row  
   [Seat 0 - A] [Seat 1 - B]   ← bottom (yo + compañero de enfrente)
```

Fórmula de team para 3v3:
- Seat 0 → A
- Seat 1 → B
- Seat 2 → A
- Seat 3 → B
- Seat 4 → A
- Seat 5 → B

La fórmula `seatIndex % 2 === 0 ? 'A' : 'B'` ya funciona correctamente para este caso.

### Validación de equipos para 3v3

```typescript
if (room.maxPlayers === 6) {
  return countA === 3 && countB === 3;
}
```

### Deal verification (3 cartas × 6 jugadores = 18 cartas)

El deck español de 40 cartas (sin 8s ni 9s) soporta esto holgadamente.  
Para PICA PICA: 1 carta × 6 jugadores = 6 cartas usadas.

### Envido en 3v3

En Truco de 3v3 argentino, el Envido funciona por equipo:
- Cualquier jugador del equipo puede cantar Envido
- El jugador con mayor puntaje de Envido en el equipo "canta" su valor
- El servidor debe calcular el mejor puntaje de Envido por equipo, no por jugador individual
- **Cambio necesario en el engine:** `calculateEnvidoScore` actualmente es por jugador; en 3v3 hay que agregar `getBestTeamEnvidoScore(seats, teamSide)` que retorna el máximo entre los 3 jugadores del equipo.

### BONGS en 3v3

BONGS aplica igual que en 2v2 — cualquier jugador puede tirar un BONG, máximo 1 efectivo por mano.  
No hay cambios en la lógica de BONGS.

### Persistencia

El modelo de datos actual (`match_teams`, `room_seats`, `seat_occupancies`) ya es seat-based y soporta N seats sin cambio de schema.  
Solo verificar que la columna `maxPlayers` en `rooms` no tiene constraint de `CHECK IN (2, 4)`.

---

## Files to Change

| Archivo | Tipo | Cambio |
|---|---|---|
| `packages/contracts/src/index.ts` | Contratos | `maxPlayers: 2\|4\|6`, nuevas phases y eventos PICA PICA |
| `apps/realtime/src/rooms/room-store.service.ts` | Backend | Validación 3v3, PICA PICA handlers, alternancia |
| `apps/realtime/src/rooms/rooms.controller.ts` | Backend | Aceptar `maxPlayers: 6` |
| `packages/game-engine/src/pica-pica.ts` | Engine | Nuevo archivo — lógica PICA PICA |
| `packages/game-engine/src/hand.ts` | Engine | Envido 3v3 (best team score) |
| `apps/web/components/home-client.tsx` | Frontend | Selector 3v3 |
| `apps/web/components/lobby-client.tsx` | Frontend | 6 posiciones de asiento |
| `apps/web/components/surfaces/score-panel.tsx` | Frontend | Indicador de modo (Truco/PICA PICA) |
| *(nuevo)* `apps/web/components/surfaces/pica-pica-table.tsx` | Frontend | UI del mini-juego |
| `prisma/schema.prisma` | DB | Verificar constraint de maxPlayers |

---

## Open Questions (requieren respuesta antes de Fase B)

1. **Reglas de PICA PICA:** ¿Cuáles son las reglas exactas? ¿Es "carta más alta gana"? ¿Hay algún canto? ¿Se juegan simultáneamente o por turno?
2. **Puntuación de PICA PICA:** ¿Cuántos puntos suma al marcador? ¿1? ¿Los mismos que una mano de Truco sin canto?
3. **PICA PICA y BONGS:** ¿Se pueden tirar BONGS en PICA PICA?
4. **PICA PICA en 1v1/2v2:** ¿Es exclusivo del 3v3 o también aplica a otros modos?
5. **Primera ronda:** ¿La ronda 1 siempre es Truco? ¿O puede empezar con PICA PICA?
6. **Empate en PICA PICA:** ¿Nadie suma punto, o hay regla de desempate?
7. **Envido en 3v3:** ¿El Envido se canta individualmente o el equipo "junta" su mejor puntaje?

---

## Testing Plan

### Fase A — 3v3 Truco
- [ ] Unit: `hasValidTeams` con 3+3 jugadores
- [ ] Unit: Deal de 18 cartas (6 × 3) sin repetición
- [ ] Unit: Envido best-team-score en 3v3
- [ ] Integration: Crear sala con `maxPlayers: 6`, llenar asientos, arrancar partida
- [ ] E2E: Flujo completo 3v3 hasta fin de partida

### Fase B — PICA PICA
- [ ] Unit: `dealPicaPica` reparte exactamente 1 carta por jugador
- [ ] Unit: `resolvePicaPica` retorna ganador correcto / tie
- [ ] Unit: Alternancia de modos en mano 1, 2, 3, 4
- [ ] Integration: Ronda PICA PICA completa (todos juegan → revelar → puntuar)
- [ ] E2E: Partida 3v3 con alternancia Truco/PICA PICA hasta fin

---

## Success Criteria

### Fase A — 3v3 Truco
- [ ] Se puede crear una sala de 6 jugadores
- [ ] Los asientos se asignan correctamente (A/B alternando)
- [ ] La partida inicia solo cuando hay 3+3 jugadores
- [ ] El Truco fluye igual que en 2v2 pero con 6 jugadores
- [ ] La UI es legible en mobile con 6 asientos
- [ ] El marcador funciona igual (Team A vs Team B)

### Fase B — PICA PICA
- [ ] Las rondas pares automáticamente activan PICA PICA
- [ ] Todos los jugadores pueden jugar su carta en PICA PICA
- [ ] El resultado se revela simultáneamente al finalizar
- [ ] El equipo ganador suma el punto correcto
- [ ] La UI distingue visualmente PICA PICA de una mano de Truco normal

---

## Notes

- El feature flag `allow3v3` ya existe — solo hay que activarlo cuando `maxPlayers === 6`
- El PRD técnico ya menciona 3v3 como Phase 4 del delivery plan
- La lógica de equipos (`seatIndex % 2`) es genérica y funciona para cualquier N par
- PICA PICA es netamente nuevo y requiere confirmar reglas de producto antes de codificar la Fase B
- Prioridad de implementación: Fase A (3v3) → confirmar reglas PICA PICA → Fase B → Fase C
