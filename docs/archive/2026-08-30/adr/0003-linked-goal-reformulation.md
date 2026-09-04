# ADR-0003: reformulación vinculada con cierre inmutable

- Estado: Aceptada
- Fecha: 2026-08-25

## Contexto

Reabrir una meta cerrada altera retrospectivamente qué significaba su cierre. El producto necesita reconocer que cambiar de dirección puede ser avance sin borrar la historia anterior.

## Decisión

Una meta cerrada es inmutable en sus campos sustantivos. Reformular ejecuta una transacción que:

1. Cierra la meta original con estado `reformulated`.
2. Añade un evento de cierre.
3. Crea una meta nueva con `reformulated_from_goal_id`.
4. Copia únicamente los campos que la persona confirme.
5. Conserva el historial original y enlaza ambas versiones.

La nueva meta tiene ID, definición de terminada, acciones y ciclo de vida propios.

## Alternativas

- Reabrir y editar: sencillo, pero reescribe la historia. Rechazada.
- Duplicar sin vínculo: conserva datos, pero pierde continuidad explicable. Rechazada.
- Versionar todas las ediciones como metas nuevas: excesivo para cambios ordinarios. Rechazada.

## Consecuencias

- Se requiere RPC/transacción remota para evitar cierre sin sucesora o sucesora sin cierre.
- La UI mostrará “Esta meta continúa de una versión anterior”.
- El árbol de reformulaciones debe evitar ciclos.
- El cierre original puede anotarse, pero no convertirse de nuevo en activo.

## Integridad

- `reformulated_from_goal_id != id`.
- La meta referenciada pertenece al mismo usuario.
- Sólo una meta cerrada como `reformulated` puede ser origen.
- No se permite crear ciclos en la cadena.

