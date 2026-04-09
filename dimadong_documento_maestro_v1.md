# DIMADONG — Documento maestro de producto y reglas exhaustivas v1

## 1. Definición del producto

DIMADONG es un juego web multijugador privado, inspirado en el Truco Argentino clásico, con identidad temática alien/Area 51, dos comodines y una capa social adicional llamada BONGS.

No busca reemplazar el Truco tradicional. Busca ofrecer una versión digital, social, temática y algo más caótica, manteniendo el espíritu del juego pero permitiendo ciertas rupturas controladas.

## 2. Objetivo del producto

Objetivos principales:
- diversión social entre amigos
- experiencia temática memorable
- versión online privada de Truco con personalidad propia
- base suficientemente robusta para desarrollo serio

## 3. Audiencia objetivo

Usuario principal:
- jugadores argentinos que ya conocen Truco
- grupos de amigos que quieren jugar remoto

El juego no está pensado como producto educativo para principiantes. El manual explica diferencias y reglas de esta versión, no enseña Truco desde cero como prioridad.

## 4. Alcance del v1

### Incluye
- salas privadas por código
- host de sala
- 1v1
- 2v2
- 3v3 condicionado a claridad de UX
- envido
- real envido
- falta envido
- truco
- retruco
- vale cuatro
- irse al mazo
- 2 comodines
- sistema de BONGS
- manual DIMADONG
- reconexión
- reemplazo de jugador
- mobile responsive
- animaciones
- chat/emotes/reacciones básicos
- pantalla final de partida
- analytics mínimas: partidas iniciadas y terminadas

### No incluye
- login en v1
- ranking
- matchmaking público
- bots
- historial persistente avanzado
- perfil de usuario
- tutorial interactivo
- revancha estructurada
- economía real
- chat de voz

## 5. Reglas base del juego

### 5.1 Base del reglamento

DIMADONG usa como base el Truco Argentino clásico, con modificaciones.

#### Decisiones cerradas
- mazo español base
- 42 cartas totales
- jerarquía clásica del Truco Argentino
- sin flor
- con real envido
- con falta envido
- con irse al mazo
- puntaje objetivo configurable
- mano rotativa clásica
- reglas validadas por sistema

### 5.2 Mazo

El mazo total del juego está compuesto por:
- 40 cartas del mazo español
- 2 comodines

Los comodines se agregan al mazo. No reemplazan cartas existentes.

### 5.3 Puntaje objetivo

El puntaje objetivo es configurable por sala.

El documento técnico deberá fijar:
- valores permitidos
- default de sala
- si cambia o no según modo

## 6. Comodines — reglas exhaustivas

Esta es la feature más sensible del sistema.

### 6.1 Principio general

El comodín puede representar cualquier carta del mazo, con restricciones temporales.

### 6.2 Restricciones del comodín

Un comodín:
- sí puede representar cualquier carta, incluso top-tier
- sí puede usarse en envido
- sí puede usarse en bazas
- no puede representar una carta ya jugada previamente por cualquier jugador en esa misma mano
- sí puede duplicar funcionalmente una carta que todavía no fue jugada
- sí puede coincidir con una carta que el mismo jugador todavía tiene en mano
- solo puede usarse **un comodín por mano**, aunque a un jugador le toquen dos

### 6.3 Regla de no repetición temporal

La restricción importante no es “no duplicar cartas existentes”, sino:

> El comodín no puede convertirse en una carta que ya haya sido jugada en alguna baza previa o en la baza actual antes de su declaración.

Ejemplo:
- si alguien ya tiró 1 de espada en esa mano, ningún comodín puede convertirse en 1 de espada después
- si nadie lo tiró todavía, sí puede hacerlo, aunque otro jugador aún tenga ese 1 de espada en mano

### 6.4 Duplicación funcional permitida

Esto queda legal en DIMADONG:

- jugador tiene 1 de espada real
- jugador tiene comodín
- nadie jugó 1 de espada todavía
- jugador usa el comodín como 1 de espada
- luego juega su 1 de espada real

Esto es deliberado y debe explicarse en el manual.

### 6.5 Selección del valor del comodín

El valor del comodín lo elige el jugador manualmente.

La UI de selección debe ser visual, clara y explícita.

La validación real ocurre del lado del servidor.

### 6.6 Comodín en envido

El comodín sí entra en el cálculo de envido.

Reglas:
- el jugador decide qué carta representa para el envido
- si el comodín se fija para envido, queda fijado para toda la mano
- no puede contarse como una carta para envido y luego jugarse como otra distinta en baza
- el sistema no debe elegir automáticamente la mejor combinación
- el jugador puede equivocarse
- la app puede ayudar visualmente, pero no corrige su decisión

### 6.7 Caso de dos comodines

Puede tocarle a un jugador:
- 2 comodines
- 1 carta real

En esa mano:
- para envido puede usar ambos como parte de la combinación declarada, porque entran en envido y forman parte de su mano
- para bazas solo podrá usar **un comodín en toda la mano**
- el otro queda inutilizado para uso activo en bazas si la regla final del desarrollo mantiene esta interpretación

#### Nota crítica

Acá hay una tensión real entre:
- “solo un comodín por mano”
- “el comodín sí sirve para envido”
- “si te tocan dos comodines, los tenés en la mano”

Para mantener consistencia operativa, la recomendación final de producto es:

> Los comodines pueden computar como cartas de la mano para envido, pero la restricción “solo un comodín por mano” aplica al uso activo en bazas.

Esto evita contradicción total y es la interpretación más estable.

### 6.8 Comodín y visualización

El valor declarado del comodín debe quedar visible:
- en la mesa, cuando corresponda
- y en el flujo de resolución correspondiente

No hace falta un feed exhaustivo, pero sí claridad de qué carta fue declarada.

### 6.9 Comodín no usado

Si el comodín no llega a jugarse, no se revela automáticamente al terminar la mano.

### 6.10 Dos comodines enfrentados

Si dos comodines se enfrentan en la misma baza:
- la baza empata automáticamente

No se comparan los valores declarados.

### 6.11 Autoplay con timer

Si el timer fuerza una jugada y la carta elegible es un comodín no declarado:
- el sistema lo convierte en 4 de copas

Esta es una convención fija de fallback.

## 7. BONGS — reglas exhaustivas

BONGS es una capa paralela social. No toca el score principal.

### 7.1 Naturaleza

Un BONG equivale a una prenda o consecuencia definida por los jugadores fuera de la app.

La app:
- registra
- muestra
- acumula
- resume

La app no:
- cobra
- penaliza
- monetiza
- convierte BONGS en puntos internos

### 7.2 Dónde puede aplicarse

Puede activarse junto con:
- TRUCOBONG
- Retruco con BONG
- Vale Cuatro con BONG
- Falta Envido con BONG

### 7.3 Nombre

La variante específica del Truco con BONG se llama:
- **TRUCOBONG**

### 7.4 Regla numérica final

Aunque varios cantos de una misma mano lleven BONG, la mano suma solo **1 BONG efectivo**.

Ejemplos:
- TrucoBong + Retruco con BONG + Vale Cuatro con BONG = 1 BONG efectivo en esa mano
- Falta Envido con BONG + TrucoBong = 1 BONG efectivo en esa mano

### 7.5 Contadores

El sistema lleva:
- contador de BONG por mano: binario, 0 o 1
- contador total de BONGS por partida: suma de manos con BONG activo

### 7.6 Log

Aunque la mano solo sume 1 BONG efectivo:
- todos los cantos con BONG sí quedan registrados en el log de partida

### 7.7 Visualización

BONGS no va en el score principal.

Se maneja como indicador aparte.

En la pantalla final se muestra:
- total de BONGS de la partida

## 8. Modos de juego

### 8.1 Modos previstos
- 1v1
- 2v2
- 3v3

### 8.2 Condición para 3v3

3v3 entra al v1 solo si queda claro, jugable y no rompe la UX mobile.

Si no, debe quedar como v1 opcional condicionado o pasar a v1.1.

### 8.3 Equipos

En 2v2 y 3v3:
- existen equipos definidos en sala
- el host o el flujo de asientos define la estructura inicial según configuración

## 9. Salas y lobby

### 9.1 Sala
- privada
- por código
- con host

### 9.2 Host
Puede:
- crear sala
- configurar reglas
- iniciar partida

No necesita poderes más complejos en v1.

### 9.3 Inicio de partida

Debe poder ser:
- automático
- manual

El PRD técnico deberá fijar default.

### 9.4 Fin de partida y destrucción de sala

Cuando la partida termina:
- se entra a pantalla final
- luego todos vuelven al home
- la sala se destruye

No hay revancha estructurada ni recreación directa de la misma sala.

## 10. Flujo de partida

### 10.1 Flujo macro
1. crear sala
2. configurar partida
3. compartir código
4. ingresar jugadores
5. asignar nombres/asientos/equipos
6. iniciar partida
7. repartir cartas
8. jugar mano
9. resolver cantos y bazas
10. asignar puntos
11. repetir hasta puntaje objetivo
12. pantalla final
13. volver al home
14. destruir sala

### 10.2 Acciones permitidas
- jugar carta
- usar comodín
- seleccionar carta de comodín
- cantar envido
- cantar real envido
- cantar falta envido
- cantar truco
- cantar retruco
- cantar vale cuatro
- cantar versiones con BONG cuando corresponda
- responder quiero / no quiero
- irse al mazo
- usar chat/emotes/reacciones

## 11. Prioridad de eventos y resolución de conflictos

### 11.1 Prioridad cerrada
Orden de prioridad:
1. cantar
2. responder canto
3. jugar carta
4. declarar comodín

### 11.2 Respuesta pendiente
Si hay una respuesta pendiente:
- no se puede jugar carta

### 11.3 Selector de comodín abierto y nuevo canto
Si alguien abre selector de comodín y otro canto entra válidamente:
- el canto espera según la preferencia de usuario
- pero a nivel técnico la recomendación de estabilidad es que el servidor invalide cualquier flujo que ya no sea consistente con el nuevo estado confirmado

#### Decisión operativa recomendada
Para evitar bugs:
- el cliente puede mostrar selector abierto
- pero si cambia el estado del servidor, el selector se invalida y debe rehacerse

Esto mantiene coherencia con “manda el servidor”.

## 12. Timer y AFK

### 12.1 Timer configurable
El timer es configurable por sala.

### 12.2 Recomendación de tiempos default
Para el PRD técnico:
- jugar carta: 10 s
- responder canto: 12 s
- seleccionar comodín: 15 s

Eso respeta tu preferencia de tiempos diferenciados sin hacerlos excesivos.

### 12.3 Expiración del timer
- si expira al responder canto: auto “no quiero”
- si expira al jugar carta: autoplay
- si expira en comodín no declarado: 4 de copas

### 12.4 AFK
Se recomienda registrar AFK prolongado y, si se repite muchas veces, activar mecanismos de continuidad o reemplazo.

## 13. Reconexión y reemplazo

### 13.1 Reconexión
- si un jugador se desconecta durante decisión crítica: pausa breve
- duración recomendada: 10 s
- la desconexión se muestra en grande
- si vuelve a tiempo, recupera el control

### 13.2 Reemplazo
- puede ocurrir en cualquier momento
- el sistema debe modelarse por asientos
- el reemplazante ocupa temporalmente el asiento
- si el original vuelve:
  - recupera el control del asiento
  - no deshace acciones ya realizadas
- si vuelve durante una decisión crítica pendiente:
  - el original responde, si alcanzó a reconectar antes del cierre real de la acción

### 13.3 Historial
El historial debe preservar:
- asiento
- ocupante real en ese momento
- acción ejecutada

## 14. Modelo conceptual por asientos

Esta es la forma correcta de pensar el sistema.

La sala tiene:
- asientos
- equipos
- estado de partida

Los usuarios:
- entran
- ocupan asientos
- pueden ser reemplazados
- pueden reconectar

Esto ordena muchísimo:
- turnos
- reemplazos
- historial
- ownership
- reconexión

## 15. Pantallas

Pantallas del v1:
- Home
- Manual DIMADONG
- Crear sala
- Unirse a sala
- Lobby
- Configuración
- Mesa de juego
- Error / reconexión
- Pantalla final

### 15.1 Manual
Debe explicar:
- cambios de esta versión
- comodines
- BONGS

No hace falta cargarlo con teoría completa de Truco si eso estorba.

### 15.2 Ubicación del manual
Recomendación final:
- disponible en Home
- disponible en sala/lobby
- no prioritario dentro de partida salvo acceso discreto

## 16. Pantalla final

### 16.1 Duración
- máximo 1 minuto
- saltable
- si todos salen antes, termina antes
- si alguien queda AFK, al terminar el tiempo también sale

### 16.2 Contenido
- ganador
- score final
- total de BONGS
- nombres y avatares
- contador regresivo
- botón volver al home

### 16.3 Naturaleza
- pantalla pasiva
- sin persistencia posterior

## 17. UX y mobile

### 17.1 Prioridad visual
En mobile, la UI debe priorizar:
- mano propia
- mesa central
- acciones disponibles

### 17.2 Chat y feed
Deben estar ocultos por defecto o colapsables.

### 17.3 Focus turn
Cuando le toca al usuario:
- crece su mano
- se simplifica el resto
- aparecen solo acciones relevantes

### 17.4 Animaciones
- adaptadas según dispositivo
- idealmente saltable/cancelables

### 17.5 Principio de diseño
Equilibrio entre:
- personalidad
- claridad
- impacto visual

## 18. Máquina de estados recomendada

Esta parte es la más importante para evitar bugs.

### 18.1 Estados base recomendados
- `lobby`
- `ready_check`
- `dealing`
- `action_turn`
- `canto_pending`
- `response_pending`
- `wildcard_selection`
- `trick_resolution`
- `hand_scoring`
- `reconnect_hold`
- `match_end`
- `post_match_summary`

### 18.2 Regla estructural
Fuera del estado actual:
- no existe acción válida

### 18.3 Autoridad
- el servidor es la fuente de verdad
- el cliente asiste
- el cliente no manda

## 19. Validación de UI y sincronización

### 19.1 Regla de oro
No mostrar una jugada como definitiva hasta confirmación del servidor.

### 19.2 Feedback visual recomendado
El cliente puede mostrar:
- seleccionada
- enviando
- procesando

Pero no debe comprometer estado final sin confirmación.

### 19.3 Doble click y duplicados
- cliente bloquea tras el primer intento
- servidor ignora duplicados

### 19.4 Desincronización
Prioridad:
- recargar estado completo desde servidor

No intentar corregir localmente estados complejos si eso arriesga inconsistencias.

## 20. Mapa de riesgos

### Riesgo 1 — Máquina de estados mal definida
Impacto:
- bugs de turnos
- bugs de puntaje
- acciones inválidas colándose

Mitigación:
- estados estrictos
- servidor autoritativo
- rechazo duro fuera de estado

### Riesgo 2 — Comodín ambiguo
Impacto:
- malentendidos de usuarios
- bugs de balance
- contradicción en envido/bazas

Mitigación:
- manual explícito
- selector legal
- validación del servidor
- criterios cerrados de fijación

### Riesgo 3 — 3v3 ilegible en mobile
Impacto:
- producto visualmente roto
- abandono
- confusión táctica

Mitigación:
- focus turn
- chat/feed colapsables
- animaciones adaptadas
- 3v3 condicionado a claridad real

### Riesgo 4 — Reemplazo contaminando integridad
Impacto:
- discusiones entre jugadores
- ownership difuso

Mitigación:
- modelo por asiento
- historial con ocupante real
- reglas claras de recuperación de control

### Riesgo 5 — BONGS demasiado difuso
Impacto:
- UX confusa
- código innecesariamente complejo

Mitigación:
- BONG binario por mano
- contador total por partida
- log detallado pero numeración simple

### Riesgo 6 — Desconexiones en momentos críticos
Impacto:
- doble acción
- pérdida de turno
- estados corruptos

Mitigación:
- reconnect_hold
- pausa breve
- resolución autoritativa de servidor
- recarga total de estado

## 21. Contradicciones históricas detectadas y cómo quedaron resueltas

### Contradicción: comodín sí/no en envido
Resuelta:
- sí entra en envido

### Contradicción: sirve para todo pero solo una carta
Resuelta:
- sí puede servir para envido y bazas
- pero si se fija en envido, queda fijo para la mano

### Contradicción: BONG acumulable
Resuelta:
- log acumulable
- efecto numérico de BONG: máximo 1 por mano

### Contradicción: reemplazo libre vs integridad
Resuelta:
- continuidad prioritaria
- control por asiento
- historial conserva ocupante real

## 22. Decisiones recomendadas finales para PRD técnico

Estas ya te las cierro para que no queden “a debatir” más tarde.

### 22.1 Base de datos
Sí conviene usar persistencia desde v1.

Como mínimo para:
- salas
- asientos
- estado de partida
- reconexión
- logs mínimos
- resultado de match

### 22.2 Selector de comodín
Debe mostrar solo opciones legales o, como mínimo, marcar ilegales claramente.

Recomendación fuerte:
- mostrar solo legales
- así reducís error de usuario y complejidad visual

### 22.3 Confirmaciones
No recargar con confirmaciones innecesarias.

Recomendación:
- click simple para jugadas normales
- confirmación ligera solo en acciones de alto costo o alta ambigüedad

### 22.4 Defaults útiles
Recomendación para defaults:
- inicio manual de partida
- timer activado por defecto
- BONGS activado por defecto pero configurable
- 3v3 desactivado si el layout final no pasa prueba de claridad

## 23. Criterios de aceptación iniciales

Estos son primeros criterios que ya podés usar luego.

### 23.1 Turnos
- un jugador no puede ejecutar acción fuera de turno
- si hay respuesta pendiente, no puede jugarse carta
- el servidor rechaza cualquier acción fuera de estado

### 23.2 Comodín
- no puede elegirse una carta ya jugada en la mano
- puede elegirse una carta aún no jugada aunque el mismo jugador la tenga en mano
- si se fijó en envido, se mantiene fija para la mano
- si dos comodines se enfrentan en la misma baza, la baza empata

### 23.3 BONGS
- la mano registra como máximo 1 BONG efectivo
- la partida acumula total de manos con BONG
- el log conserva todos los cantos con BONG

### 23.4 Reconexión
- si un jugador vuelve dentro de la ventana, recupera el control
- el estado visible se reconstruye desde servidor
- el historial mantiene consistencia aunque haya reemplazo

### 23.5 Pantalla final
- aparece tras match_end
- dura hasta 1 minuto salvo salida anticipada
- muestra ganador, score final y total de BONGS
- luego envía al home y destruye la sala

## 24. Qué sigue para el PRD técnico

El próximo documento ya no debería discutir producto. Debería traducir esto a especificación técnica.

Orden correcto:

### Parte 1
Entidades:
- Room
- Seat
- PlayerSession
- Team
- Match
- Hand
- Trick
- Card
- WildcardState
- Action
- ScoreState
- BongState
- ConnectionState
- EventLog

### Parte 2
Máquina de estados:
- transiciones válidas
- acciones permitidas por estado
- eventos del servidor
- timeouts

### Parte 3
Eventos socket:
- room_created
- seat_joined
- player_reconnected
- match_started
- cards_dealt
- canto_opened
- canto_resolved
- wildcard_selection_started
- wildcard_selected
- card_played
- trick_resolved
- hand_scored
- bong_logged
- match_finished
- summary_started
- room_destroyed

### Parte 4
Criterios de aceptación por feature

### Parte 5
Pantallas y componentes

## 25. Corte de alcance recomendado

Si en desarrollo hay que recortar, el orden correcto es:

1. tutorial interactivo  
2. social más complejo  
3. animaciones menos importantes  
4. 3v3 si no queda claro  
5. refinamientos visuales no críticos  

No recortar:
- máquina de estados
- puntaje
- turnos
- lógica de comodín
- reconexión mínima
- autoridad del servidor

## 26. Veredicto final

Ahora sí hay una base seria. Ya no es “idea divertida escrita por arriba”. Ya es un producto definido con:
- reglas operativas
- decisiones de diseño
- edge cases relevantes
- prioridades técnicas
- mapa de riesgos
- criterio claro para pasar a especificación

El siguiente paso correcto es convertir esto en un **PRD técnico estructurado**, no volver a discutir visión.
